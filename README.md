# AETHER: AI-Powered Urban Air Quality Intelligence Platform

> **Google PromptWars Virtual Edition — Challenge 6: Urban Air Quality Assistant**  
> *Secure, Tested, Accessible (WCAG 2.1 AA), Efficient, and Scientifically Defensible.*

---

## 1. Project Overview

AETHER translates complex spatiotemporal air quality data into hyper-personalized, proactive, and actionable health guidance. It features:
- **Spatial AQI Engine**: PostGIS spatial queries (`ST_DWithin`, `ST_Distance`) with Inverse Distance Weighting (IDW) interpolation explicitly tagged as estimated.
- **Context-Grounded GenAI Copilot**: Google Gemini API integration with strict citation guardrails and a zero-dependency **Deterministic Fallback Engine** calibrated to US EPA and WHO 2021 standards.
- **Dose Minimization Routine Planner**: Diurnal curve integration calculating inhaled particulate lung dose ($\mu\text{g}$).
- **Indoor Mass-Balance CADR Optimizer**: Physical differential equations for clean air delivery rates and HEPA filter loading.
- **Sustainable Action Simulator**: Strict mathematical and visual separation of **Emissions Avoided** ($kg\text{ CO}_2\text{e}$) from **Personal Exposure Reduction** ($\mu\text{g/m}^3\cdot h$).
- **Family Health Shield**: Geofenced alerts tailored for sensitive groups (asthmatics, children, elderly, pregnant).
- **Interactive 3D Earth**: WebGL globe powered by React Three Fiber and an optimized 2.57 MB Earth asset with a WCAG-compliant 2D tabular fallback.

---

## 2. Monorepo Structure

```
aether-ai/
├── apps/
│   ├── api/                   # Python FastAPI Backend (uv managed)
│   │   ├── app/
│   │   │   ├── api/v1/        # Endpoints (Health, Info, Modules)
│   │   │   ├── core/          # Config, Circuit Breaker, Security
│   │   │   ├── schemas/       # Pydantic v2 schemas
│   │   │   └── main.py        # FastAPI entrypoint
│   │   ├── tests/             # Pytest suite
│   │   └── pyproject.toml     # uv dependencies
│   │
│   └── web/                   # Next.js 15 App Router Frontend (pnpm)
│       ├── src/app/           # Accessible pages and layout
│       └── package.json
│
├── packages/
│   ├── standards/             # EPA Breakpoints & WHO 2021 Reference Constants
│   └── contracts/             # Shared TypeScript API schemas
│
├── docker/
│   ├── docker-compose.yml     # PostgreSQL 16 + PostGIS & Redis
│   └── init-postgis.sql       # PostGIS extension bootstrap
│
├── pnpm-workspace.yaml        # pnpm workspace definition
├── package.json               # Root monorepo script orchestrator
└── README.md
```

---

## 3. Environment & Prerequisites Inspection Report

| Component | Status | Detected Version | Action Required |
| :--- | :--- | :--- | :--- |
| **Node.js** | Installed | `v26.11.1` | None |
| **npm** | Installed | `12.2.0` | None |
| **pnpm** | **MISSING** | Not in PATH | **Install pnpm** (see instructions below) |
| **Python** | Installed | `3.14.7` | None |
| **uv** | Installed | `0.12.21` | None |
| **Docker** | Installed | System binary present | Start Docker daemon (`systemctl start docker`) |
| **Docker Compose** | Installed | `5.5.1` | None |
| **Git** | Installed | `2.56.0` | Initialized |

### Installing Missing `pnpm`
Per project decisions, system packages are never installed silently. To install `pnpm`, run one of the following in your shell:
```bash
# Recommended via npm:
npm install -g pnpm

# Or via official standalone installer:
curl -fsSL https://get.pnpm.io/install.sh | sh
```

---

## 4. Quickstart Setup Guide

### Step 1: Start Persistence Layer (PostGIS & Redis)
Ensure Docker daemon is running, then launch the database and cache:
```bash
cd docker
docker compose up -d

# Verify PostGIS healthcheck:
docker compose ps
```

### Step 2: Configure Environment Variables
Copy the example environment configuration in the backend:
```bash
cd apps/api
cp .env.example .env

# Edit .env and supply your Gemini API Key:
# GEMINI_API_KEY=your_key_here
```

### Step 3: Backend Setup & Health Check (FastAPI + uv)
```bash
cd apps/api

# Sync dependencies using uv:
uv sync

# Run backend test suite:
uv run pytest

# Launch FastAPI development server:
uv run uvicorn app.main:app --reload --port 8000
```
Test endpoints:
- Liveness Probe: `http://localhost:8000/api/v1/health`
- Readiness Probe: `http://localhost:8000/api/v1/ready`
- System Diagnostics: `http://localhost:8000/api/v1/info`
- Interactive OpenAPI Docs: `http://localhost:8000/docs`

### Step 4: Frontend Setup (Next.js + pnpm)
Once `pnpm` is installed:
```bash
# Install workspace dependencies from repo root:
pnpm install

# Start Next.js development server:
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. 3D Earth GLB Asset Inspection Findings

The candidate 2.57 MB Earth asset (`earth (1).glb`) was inspected:
- **Size**: 2,691,220 bytes (2.57 MB)
- **glTF Specification**: Version 2.0 binary (`GLB`)
- **Extensions**: `extensionsUsed: []`, `extensionsRequired: []` (Standard geometry, no Draco compression applied)
- **Components**: 2 meshes (surface + cloud/atmosphere layer), 6 textures, 2 materials, 1 animation track.
- **Recommendation**: Because standard meshes are low-poly spheres and textures account for ~90% of file size, applying Draco geometry compression would save negligible bandwidth while imposing a ~150ms client-side WebAssembly decompression penalty on mobile devices. We will load the GLB natively via `@react-three/drei`'s `useGLTF` with `frameloop="demand"` for optimal battery and GPU efficiency.

---

## 6. Architecture & Quality Principles

1. **Dual-Encoding Accessibility**: Colors are never the sole indicator of danger; always accompanied by text badges, units ($\mu\text{g/m}^3$), and icons.
2. **Resilient AI**: Circuit breaker trips gracefully to the Deterministic Fallback Engine during rate limits (HTTP 429) or network partitions.
3. **Transparent Science**: Indoor mass balance, integral outdoor dose, and emission avoidance calculations are documented and mathematically defensible.
