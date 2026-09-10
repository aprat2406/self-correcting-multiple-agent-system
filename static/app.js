const topicInput = document.getElementById("topic");
const runButton = document.getElementById("runButton");
const btnLabel = runButton.querySelector(".btn-label");
const statusBox = document.getElementById("status");
const statusText = statusBox.querySelector(".status-text");
const results = document.getElementById("results");
const timeline = document.getElementById("timeline");
const finalAnswer = document.getElementById("finalAnswer");
const finalDecision = document.getElementById("finalDecision");
const summaryBadge = document.getElementById("summaryBadge");

function escapeHtml(value = "") {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
}

function setButtonLabel(text) {
    btnLabel.textContent = text;
}

function setStatus(message, isError = false) {
    statusText.textContent = message;
    statusBox.classList.remove("hidden", "error");
    if (isError) statusBox.classList.add("error");
}

function agentGlyph(agent) {
    if (agent === "writer") return "W";
    if (agent === "reviewer") return "R";
    if (agent === "reviser") return "V";
    return String(agent).slice(0, 1).toUpperCase();
}

function renderEvent(event, index) {
    const agent = event.agent || "agent";
    const isReview = agent === "reviewer";
    const decision = event.decision || "";
    const revisionText = event.revision_count > 0 ? `Revision ${event.revision_count}` : "Initial draft";
    const modelText = event.model ? ` · ${event.model}` : "";

    let body = "";
    if (isReview) {
        const feedback = event.feedback || "No changes needed — all review rules passed.";
        body = `<div class="feedback">${escapeHtml(feedback)}</div>`;
    } else {
        body = `<div class="answer">${escapeHtml(event.draft)}</div>`;
    }

    const decisionBadge = decision
        ? `<span class="decision ${decision.toLowerCase()}">${escapeHtml(decision)}</span>`
        : "";

    return `
        <article class="event" data-agent="${escapeHtml(agent)}" style="--i:${index}">
            <div class="event-dot" title="${escapeHtml(agent)}">${agentGlyph(agent)}</div>
            <div class="event-card">
                <div class="event-top">
                    <div>
                        <div class="event-name">${escapeHtml(agent)} Agent</div>
                        <div class="event-meta">${escapeHtml(revisionText + modelText)}</div>
                    </div>
                    ${decisionBadge}
                </div>
                ${body}
            </div>
        </article>
    `;
}

async function runAgentLoop() {
    const topic = topicInput.value.trim();
    if (!topic) {
        setStatus("Please enter a topic first.", true);
        return;
    }

    runButton.disabled = true;
    setButtonLabel("Agents are working…");
    results.classList.add("hidden");
    setStatus("Running Writer → Reviewer → Reviser through DigitalOcean Serverless Inference…");

    try {
        const response = await fetch("/api/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Something went wrong.");

        timeline.innerHTML = data.events.map(renderEvent).join("");
        finalAnswer.textContent = data.final_answer;
        finalDecision.textContent = data.final_decision || "DONE";
        finalDecision.className = `decision ${(data.final_decision || "pass").toLowerCase()}`;

        const routing = data.router_enabled
            ? ` · router:${data.router}`
            : ` · ${data.writer_model}`;
        summaryBadge.textContent = `${data.revision_count} revision${data.revision_count === 1 ? "" : "s"} used${routing}`;

        statusBox.classList.add("hidden");
        results.classList.remove("hidden");
        results.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
        setStatus(error.message, true);
    } finally {
        runButton.disabled = false;
        setButtonLabel("Run Agent Loop");
    }
}

runButton.addEventListener("click", runAgentLoop);

topicInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runAgentLoop();
});

document.querySelectorAll(".pill[data-topic]").forEach((pill) => {
    pill.addEventListener("click", () => {
        topicInput.value = pill.dataset.topic;
        topicInput.focus();
    });
});
