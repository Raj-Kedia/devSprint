# DevSprint — Team Task & Sprint Tracker with AI Standup Summaries

> A full-stack, enterprise-grade project management application where engineering teams manage sprint backlogs, track live task movements with drag-and-drop, leverage **Redis read-through caching with write-invalidation**, and run an **autonomous AI agent loop** that transforms 24-hour activity audit logs into concise daily standup reports.

---

## 🌟 Key Capabilities & Highlights

1. **Sprint Kanban Board & Real-Time State**:
   - Multi-column sprint workflow (**To Do**, **In Progress**, **In Review**, **Done**) with smooth drag-and-drop powered by `@hello-pangea/dnd`.
   - Story point velocity counter and sprint health progression indicators.
   - Comprehensive task modals: edit story points, assignees, priorities, and description criteria.
   - Per-task **Activity Audit Log** and team **Discussion Stream**.

2. **Daily AI Standup Agent Loop**:
   - Autonomous agent pipeline that queries the past 24 hours of PostgreSQL task activity logs (status shifts, PR reviews, reassignments, blocker comments).
   - Generates structured, natural language standup reports:
     - 🚀 **Yesterday Completed**
     - 🎯 **Today's Focus & In-Flight Priorities**
     - ⚠️ **Blockers & Impediments**
     - 📊 **Executive Sprint Velocity Assessment**
   - Direct integration with **Google Gemini API** (`gemini-1.5-flash`), **OpenAI API** (`gpt-4o-mini`), and an intelligent local structured synthesizer fallback.
   - One-click **Copy for Slack / Microsoft Teams** markdown formatting.

3. **High-Performance Redis Caching (Interview Ready)**:
   - **Pattern**: Read-Through Caching on high-read board endpoints (`GET /api/v1/sprints/{id}/board`) with instant write-invalidation.
   - **Diagnostic Headers**: Returns `X-Cache: HIT` (served in ~2ms from Redis) or `X-Cache: MISS` (queried from PostgreSQL and cached with TTL).
   - **Invalidation Strategy**: Any task status movement, title edit, point adjustment, or deletion immediately purges the sprint cache key (`sprint_board:{id}`).
   - **Interactive Live Monitor**: Dedicated Redis diagnostics dashboard with real-time Hit Ratio %, total hits/misses, and an interactive **Live Benchmark Demo** button.

4. **Interactive Burndown & Velocity Analytics**:
   - Built with **Recharts**: compares the **Ideal Story Points Burn Guideline** against **Actual Remaining Story Points** across the sprint timeline.
   - Status distribution breakdown & Team Member Workload analysis table.

5. **Multi-Tenant Workspaces & JWT Auth**:
   - Role-based team membership (**Admin**, **Member**).
   - Instant invite-by-email and copyable workspace invite links.
   - 1-Click Demo Persona Switcher (**Alex - Lead**, **Sam - Frontend**, **Taylor - Backend**, **Jordan - AI**) for testing.

---

## 🏛️ System Architecture

```mermaid
graph TD
    Client["React + TypeScript Frontend (Vite)"]
    Nginx["Nginx Reverse Proxy / Vercel Edge"]
    FastAPI["FastAPI Backend (Python 3.12)"]
    Redis[("Redis 7 (Board Cache + Rate Limiting)")]
    Postgres[("PostgreSQL 16 (Tasks, Sprints, Activity Logs)")]
    LLM["LLM Agent (Gemini / OpenAI / Fallback)"]

    Client -->|API Requests| Nginx
    Nginx -->|Proxy| FastAPI
    FastAPI -->|1. Check Cache (X-Cache: HIT)| Redis
    FastAPI -->|2. Cache Miss / Write (X-Cache: MISS)| Postgres
    FastAPI -->|3. Invalidate on Move/Edit| Redis
    FastAPI -->|4. 24h Activity Log Synthesis| LLM
```

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, Recharts, Lucide Icons, `@hello-pangea/dnd` |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2.0 (Async), aiosqlite / asyncpg, Alembic, Pydantic v2 |
| **Caching** | Redis 7 (`redis.asyncio`), Read-Through caching with automatic write-invalidation |
| **AI Layer** | Autonomous Agent Loop with Google Gemini 1.5, OpenAI GPT-4o-mini, and deterministic synthesizer fallback |
| **Infra & CI** | Docker, Docker Compose, GitHub Actions CI workflow, Nginx |

---

## 🚀 Quickstart (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm
- Docker (optional, for full compose stack)

### 1. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed demo dataset (users, active sprint, tasks, 5-day activity logs)
python -m app.seed

# Start backend server
uvicorn app.main:app --reload --port 8000
```
Backend API will be running at `http://localhost:8000`. Interactive OpenAPI documentation is available at `http://localhost:8000/docs`.

### 2. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Frontend will be running at `http://localhost:5173`.

### 3. Demo Credentials
| Persona | Email | Password | Role |
|---|---|---|---|
| **Alex Rivera** | `alex@devsprint.io` | `password123` | Engineering Lead / Admin |
| **Sam Chen** | `sam@devsprint.io` | `password123` | Senior Frontend Engineer |
| **Taylor Hayes** | `taylor@devsprint.io` | `password123` | Backend & Infra Engineer |
| **Jordan Vance** | `jordan@devsprint.io` | `password123` | AI Agent Engineer |

*(You can also use the 1-click demo switcher directly on the login modal or in the top navigation bar!)*

---

## 🐳 Docker Compose Deployment

To run the complete production-ready stack (PostgreSQL, Redis, FastAPI, and React Nginx) with a single command:

```bash
docker compose up --build
```

- **Frontend App**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **Postgres Database**: `localhost:5432`
- **Redis Cache**: `localhost:6379`

To stop:
```bash
docker compose down
```

---

## 🧪 Automated Testing & CI

A comprehensive test suite verifies authentication, Redis cache hit/miss transitions, daily AI standup agent synthesis, and burndown chart analytics.

```bash
cd backend
pytest tests/test_api.py -v
```

GitHub Actions workflow is located at `.github/workflows/ci.yml` and automatically runs on every push and pull request.

---

## ☁️ Cloud Deployment Guide

### Deploying Backend to Render
1. Create a new **Web Service** on [Render](https://render.com).
2. Connect your Git repository and set Root Directory to `backend`.
3. Set Environment to `Python 3`.
4. Build Command: `pip install -r requirements.txt && python -m app.seed`
5. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Provision a **PostgreSQL** database and **Redis** instance on Render, and set `DATABASE_URL` and `REDIS_URL` in the environment variables.

### Deploying Frontend to Vercel
1. Import your repository into [Vercel](https://vercel.com).
2. Set Root Directory to `frontend`.
3. Framework Preset: `Vite`.
4. Set Build Command: `npm run build` and Output Directory: `dist`.
5. Add an environment variable or proxy rewrite for `/api/:path*` pointing to your deployed Render backend URL.

---

## 📋 API Specification Summary

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Register a new user & create initial workspace |
| `POST` | `/api/v1/auth/login` | Authenticate and obtain JWT access token |
| `GET` | `/api/v1/teams/` | List workspaces for the authenticated user |
| `POST` | `/api/v1/teams/{id}/invite` | Invite team members by email |
| `GET` | `/api/v1/sprints/{id}/board` | **Cached** sprint board query (`X-Cache: HIT/MISS`) |
| `POST` | `/api/v1/tasks/` | Create a new sprint task (invalidates board cache) |
| `POST` | `/api/v1/tasks/{id}/move` | Drag-and-drop task movement (updates activity log) |
| `POST` | `/api/v1/tasks/{id}/comments` | Add discussion comment to task |
| `POST` | `/api/v1/standup/generate` | Autonomous agent loop daily standup synthesis |
| `GET` | `/api/v1/analytics/sprint/{id}`| Burndown chart coordinates and team workload metrics |
| `GET` | `/api/v1/system/cache-stats` | Real-time Redis hit/miss counters and ratio |
| `POST` | `/api/v1/system/cache-clear` | Invalidate all sprint board cache keys |

---

## 📄 License
MIT License. Built for modern software engineering teams.
