# AETHER – Urban Air Quality Assistant

[![CI](https://github.com/Cholan-kinnera/aether-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/Cholan-kinnera/aether-ai/actions)

> One AQI number tells nobody what to do. **AETHER plans a household's day around the smog:**
> who in the family should go out and when, how to keep the air at home clean, and what a greener
> commute changes, with every number's source and age shown.

**Challenge:** PromptWars Virtual – Challenge 6, *Urban Air Quality Assistant*.

## Who it is for
Families in smog-affected cities, especially households with someone sensitive: asthma or a lung
condition, children, older adults, pregnancy or a heart condition. One person's details are enough;
up to eight members can be added, and the household gets the strictest member's verdict.

## What it does
| Problem-statement need | How AETHER answers it |
|---|---|
| Health guidance for sensitive groups | A verdict per member (**Go / Take care / Limit / Stay indoors**) from the EPA AQI category descriptions; sensitive groups are treated one category stricter, and hard exercise one step stricter again. |
| Low-emission daily routine | Each planned activity is placed in its cleanest forecast hours within the member's own time limits. If the air is bad all day, the app says so and suggests doing it indoors. |
| Indoor air | Purifier sizing (EPA chart), clean-air changes per hour, time to cut particles by 90%, the best hour to air the home, and smog-season habits. |
| Greener commute | kg CO2e per week for each travel mode (UK DESNZ 2026 factors), **kept separate from** the PM2.5 you breathe in per trip (EPA Exposure Factors Handbook). On a smoggy day cycling cuts emissions but raises your exposure, and the app shows both. |
| Personal, plain-language briefing | Google Gemini (`gemini-3.5-flash-lite`) writes a short briefing from the computed plan. The page shows a rule-based briefing at once and replaces it when Gemini answers. |

## How it works
```
Browser ──▶ POST /api/plan ──▶ Open-Meteo geocoding + CAMS air quality + weather (TTL cache)
                           ──▶ rules.py / planner.py / indoor.py / commute.py (deterministic)
                           ◀── plan + rule-based briefing + one-time briefing_id
        ──▶ POST /api/briefing/{id} ──▶ Gemini rewrites the briefing (never the numbers)
```

## Data honesty
- Values are **model estimates** (Copernicus CAMS via Open-Meteo), labelled as such, with source,
  observation time, retrieval time and data age. Data older than 3 hours is flagged as stale.
- Missing values stay missing; nothing is filled in or invented.
- Emissions (macro impact) and inhaled dose (personal exposure) are separate fields and labels.
- No medical claims: guidance points to the person's doctor and local health authority.

## Design decisions
- **The LLM never decides.** Verdicts, schedules and numbers are deterministic and unit-tested.
  Gemini only phrases the briefing. Its output must be JSON of at most 700 characters with no links,
  or it is discarded. The user's note is passed as delimited, untrusted data.
- **Fast first paint.** The plan returns without waiting for Gemini, which can take 5–25 s.
  Gemini calls have a 25 s timeout and a global per-minute cap.
- **No build step, no database.** FastAPI serves one static page. Household details are kept only
  in the browser's localStorage and can be removed with "Forget saved household".

## Security
- Secrets only in environment variables (`.env.example` holds placeholders; `.env` is ignored).
- Pydantic validation with `extra="forbid"` and bounds on every field.
- Per-client rate limit. `X-Forwarded-For` is ignored unless `TRUSTED_PROXY_HOPS` is set, and then
  only that many hops are trusted, so set it to the real number of proxies in front of the app.
- CSP without inline scripts, `nosniff`, `no-referrer`, `frame-ancestors 'none'`, HSTS,
  `Permissions-Policy`, and `no-store` on API responses. The DOM is written only with
  `textContent`.
- Structured logs with request IDs; user text and secrets are never logged.
- The container runs as a non-root user; CI has read-only permissions.

## Accessibility
Skip link, landmarks and headings; every control is labelled; fieldsets for grouped choices;
verdicts and AQI shown as number + text + icon, never colour alone; an `aria-live` results region
that receives focus; the forecast is also available as a data table; visible focus;
`prefers-reduced-motion` respected; fully keyboard operable; no horizontal scroll at 375 px.

## Checks
```bash
uv sync
uv run ruff check . && uv run ruff format --check .
uv run mypy            # strict
uv run pytest          # 122 tests, 100% coverage (fails under 90%)
node --test tests/js/  # front-end helpers
```

## Run locally
```bash
cp .env.example .env    # optional: add GEMINI_API_KEY; without it the rule-based briefing is used
uv run --env-file .env uvicorn aether.api:app --reload
# open http://localhost:8000
```

## Deploy (Google Cloud Run)
```bash
gcloud run deploy aether-ai --source . --region asia-south1 --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest --set-env-vars TRUSTED_PROXY_HOPS=1
```
`TRUSTED_PROXY_HOPS=1` matches Cloud Run's single front proxy. Leave it at 0 when nothing sits in
front of the app.

## Project layout
```
src/aether/  api.py (routes) · service.py (orchestration) · rules.py (verdicts)
             planner.py (routine) · indoor.py · commute.py · airdata.py (Open-Meteo)
             advisor.py (Gemini + fallback) · profiles.py (note parsing) · security.py
             models.py · aqi.py · config.py · static/ (HTML, CSS, JS)
tests/       pytest suite + tests/js (node:test)
```

## Limits
- CAMS is a regional forecast model, not a street-level sensor.
- Emission factors are UK averages; local fleets and power grids differ.
- Indoor numbers assume a well-mixed, closed room and are estimates, not measurements.
- The rate limiter and cache live in each process; several instances would need a shared store.
- Guidance is general and **not medical advice**.
