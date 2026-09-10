# Self-Correcting Multi-Agent System

A beginner-friendly explanation engine where three specialized AI agents collaborate in a loop: **Writer → Reviewer → Reviser**. The reviewer checks every draft against clear rules; if anything fails, the reviser improves it and the cycle repeats until the answer passes (or a revision limit is hit).

Powered by **LangGraph** for the agent workflow and **DigitalOcean Gradient™ AI Serverless Inference** for model calls.

---

## What it does

You enter a topic (for example, *“What is an AI agent?”* or *“Explain recursion”*). The system:

1. **Writes** a short, beginner-friendly explanation (analogy + tiny example).
2. **Reviews** that draft against fixed quality rules.
3. **Revises** when the reviewer says `REVISE`, then reviews again.
4. Returns the **accepted answer** plus a full **execution trace** so you can watch the correction loop.

Use it from the browser UI or the CLI.

---

## How it works

### Agent roles

| Agent | Role |
| --- | --- |
| **Writer** | Creates the first draft: ~120–160 words, simple language, one everyday analogy, one tiny example. |
| **Reviewer** | Scores the draft with four rules only: beginner-friendly, has analogy, has concrete example, stays on topic. Returns strict JSON: `{"decision":"PASS\|REVISE","feedback":"..."}`. |
| **Reviser** | Rewrites the draft using reviewer feedback, then sends it back to the reviewer. |

### Self-correction loop

```
START
  → Writer (draft)
  → Reviewer
       ├─ PASS  → END (final answer)
       ├─ REVISE and revisions < MAX_REVISIONS → Reviser → Reviewer (again)
       └─ REVISE but max revisions reached → END (best-effort answer)
```

The loop is implemented as a LangGraph `StateGraph` with conditional edges after the reviewer (`route_after_review`). Shared state includes `topic`, `draft`, `feedback`, `decision`, and `revision_count`.

Default maximum revisions: **3** (configurable via `MAX_REVISIONS`).

---

## How it is built

### Architecture

```
Browser / CLI
     │
     ▼
FastAPI (app.py)          ← HTML UI, /api/run, /api/config
     │
     ▼
LangGraph workflow (backend.py)
     │
     ├── Writer  ──┐
     ├── Reviewer  ├── ChatOpenAI → DigitalOcean Serverless Inference
     └── Reviser ──┘
```

- **`app.py`** — FastAPI web app: serves the Jinja2 page, static assets, and JSON APIs.
- **`backend.py`** — Agent logic, LangGraph graph, DigitalOcean inference client, CLI demo.
- **`templates/index.html`** + **`static/`** — Front end that posts a topic and renders the agent timeline.
- **`requirements.txt`** — Python dependencies.

### Tech stack

| Layer | Technology |
| --- | --- |
| Orchestration | [LangGraph](https://github.com/langchain-ai/langgraph) `StateGraph` |
| LLM client | LangChain `ChatOpenAI` (OpenAI-compatible API) |
| Inference | DigitalOcean Serverless Inference (`https://inference.do-ai.run/v1`) |
| Optional routing | DigitalOcean Inference Router (`router:<name>`) |
| API / UI | FastAPI, Jinja2, vanilla JS + CSS |
| Config | `python-dotenv` + environment variables |
| Validation | Pydantic (`Review` schema for reviewer JSON) |

### Inference configuration

Agents call DigitalOcean’s OpenAI-compatible endpoint with a **Model Access Key**.

- By default each agent uses the model in `DO_MODEL` (default: `kimi-k3`).
- You can override per role with `DO_WRITER_MODEL`, `DO_REVIEWER_MODEL`, `DO_REVISER_MODEL`.
- If `DO_INFERENCE_ROUTER` is set, every agent calls `router:<name>`. Distinct system prompts help the router pick an appropriate model from its pool for writer / reviewer / reviser workloads.

Models are created **lazily** so the UI can start even before credentials are configured; the first run returns a clear error if `MODEL_ACCESS_KEY` is missing.

---

## Project structure

```
.
├── app.py                 # FastAPI entrypoint (web UI + API)
├── backend.py             # Agents, LangGraph graph, CLI demo
├── requirements.txt       # Dependencies
├── templates/
│   └── index.html         # Main page
├── static/
│   ├── app.js             # Run loop + timeline rendering
│   └── style.css          # Styles
├── .env                   # Local secrets (not committed)
├── .gitignore
├── LICENSE                # Apache 2.0
└── README.md
```

---

## Prerequisites

- Python 3.10+ recommended
- A [DigitalOcean](https://www.digitalocean.com/) account with **Gradient AI / Serverless Inference** access
- A **Model Access Key** for the inference API

---

## Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/aprat2406/self-correcting-multiple-agent-system.git
   cd self-correcting-multiple-agent-system
   ```

2. **Create a virtual environment and install dependencies**

   ```bash
   python -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Configure environment variables**

   Create a `.env` file in the project root (this file is gitignored):

   ```env
   MODEL_ACCESS_KEY=your_digitalocean_model_access_key
   DO_INFERENCE_BASE_URL=https://inference.do-ai.run/v1
   DO_MODEL=kimi-k3
   # Optional: route all agents through an Inference Router
   # DO_INFERENCE_ROUTER=your-router-name
   # Optional per-agent model overrides (ignored when router is set)
   # DO_WRITER_MODEL=kimi-k3
   # DO_REVIEWER_MODEL=kimi-k3
   # DO_REVISER_MODEL=kimi-k3
   MAX_REVISIONS=3
   ```

   | Variable | Required | Description |
   | --- | --- | --- |
   | `MODEL_ACCESS_KEY` | Yes | DigitalOcean Model Access Key |
   | `DO_INFERENCE_BASE_URL` | No | Inference API base URL (default above) |
   | `DO_MODEL` | No | Default model id (default: `kimi-k3`) |
   | `DO_WRITER_MODEL` / `DO_REVIEWER_MODEL` / `DO_REVISER_MODEL` | No | Per-agent model overrides |
   | `DO_INFERENCE_ROUTER` | No | If set, agents call `router:<name>` |
   | `MAX_REVISIONS` | No | Cap on revise loops (default: `3`) |

---

## Run the app

### Web UI

```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000), enter a topic, and click **Run Agent Loop**. The page shows:

- Live inference / routing config
- Step-by-step timeline (writer drafts, reviewer decisions, reviser updates)
- Final accepted answer and revision count

### CLI demo

```bash
python backend.py
```

You will be prompted for a topic; the same workflow prints to the terminal.

---

## API

### `GET /`

Serves the HTML UI (includes non-secret runtime info for the inference strip).

### `GET /api/config`

Returns safe runtime metadata (never secrets):

```json
{
  "provider": "DigitalOcean Serverless Inference",
  "endpoint": "https://inference.do-ai.run/v1",
  "router_enabled": false,
  "router": null,
  "writer_model": "kimi-k3",
  "reviewer_model": "kimi-k3",
  "reviser_model": "kimi-k3",
  "max_revisions": 3
}
```

### `POST /api/run`

Request body:

```json
{ "topic": "What is RAG?" }
```

Response includes `events` (per-agent updates), `final_answer`, `final_decision`, `revision_count`, and the same runtime fields as `/api/config`.

Example:

```bash
curl -s -X POST http://127.0.0.1:8000/api/run \
  -H "Content-Type: application/json" \
  -d '{"topic":"What is an AI agent?"}'
```

---

## Review rules (what “PASS” means)

The reviewer only accepts a draft when all of the following hold:

1. Easy for a beginner  
2. Contains an everyday analogy  
3. Contains a tiny concrete example  
4. Stays focused on the requested topic  

Otherwise it returns `REVISE` with short, specific feedback for the reviser.

---

## Deploy notes

The app is suitable for platforms that run ASGI apps (for example DigitalOcean App Platform). Set the same environment variables in the platform’s secrets/config. Use `PORT` from the host when binding, for example:

```bash
uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}
```

Do not commit `.env` or Model Access Keys.

---

## License

Apache License 2.0 — see [LICENSE](LICENSE).
