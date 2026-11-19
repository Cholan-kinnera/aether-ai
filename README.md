# AETHER – Urban Air Quality Assistant

[![CI](https://github.com/Cholan-kinnera/aether-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/Cholan-kinnera/aether-ai/actions)

> Generic AQI apps show one number for everyone. **AETHER tells *you* whether the air is
> right for *your* plans** – a child's playground trip, an asthmatic's evening jog, a cyclist's
> commute – and when today's cleanest window is.

**Challenge:** PromptWars Virtual – Challenge 6, *Urban Air Quality Assistant*.

## Chosen vertical and persona
Urban residents who are sensitive to air pollution or exercise outdoors: people with asthma or
heart conditions, parents of young children, older adults, pregnant people, runners, cyclists and
commuters. Each gets a decision tailored to their own context instead of a raw number.

## How it works
```
Browser form ──▶ POST /api/advice ──▶ profile (form + note parsing)
                                  ──▶ Open-Meteo geocoding + air quality (cached)
                                  ──▶ rule engine: verdict, reasons, actions, best window
                                  ──▶ Gemini explains the verdict (falls back to rules)
```
1. **Context in.** Location (name or GPS), sensitive groups, planned activity and an optional
   free-text note such as *"I have asthma and want to jog this evening"*. The note is parsed
   deterministically (with negation handling: "no asthma" is respected). Explicit form fields
   always win over the note.
2. **Live data.** Current US AQI, per-pollutant sub-indices (PM2.5, PM10, NO₂, O₃, SO₂, CO) and a
   24-hour forecast from the free [Open-Meteo](https://open-meteo.com/) APIs (no key needed).
3. **Decision logic (`rules.py`).** An *exposure-adjusted AQI* = measured AQI × multiplier, where the
   multiplier adds +25% per sensitive group (capped at +50%) and an activity bonus (commute +5%,
   cycling +10%, running +15%). It is mapped to the EPA bands: **go** ≤ 50, **caution** ≤ 100,
   **limit** ≤ 150, **avoid** > 150. The same air gives different verdicts to different people.
4. **Actionable output.** Reasons ("PM2.5 is the main pollutant"), concrete actions (N95 mask,
   inhaler within reach, move exercise indoors, quieter streets for NO₂, mornings for ozone) and
   the cleanest 2-hour window in the next 24 hours.
5. **Gen AI explanation.** Gemini turns the structured decision into 2–3 friendly sentences that
   reflect the user's note. If there is no key, the call fails or the output fails validation, a
   deterministic explanation is used, so the app never breaks.

## Design decisions
- **The LLM never decides safety.** The verdict is rule-based, transparent and unit-tested; Gemini
  only explains it. A prompt-injection attempt in the note cannot change the verdict (tested).
- **Graceful degradation.** Works without any API key and survives upstream outages with clear
  errors (404 unknown place, 502 data service down, 429 rate limited).
- **Small and fast.** Async HTTP, a bounded TTL cache (10 min), no front-end build step, repo well
  under 10 MB.

## Security
- Secrets only via environment variables (`.env.example` provided, `.env` git-ignored).
- Strict input validation with Pydantic (`extra="forbid"`, length limits, enum-restricted fields).
- Per-client sliding-window rate limit on the API; bounded in-memory state.
- Security headers on every response: CSP (no inline scripts or styles), `nosniff`,
  `no-referrer`, `frame-ancestors 'none'`, `Permissions-Policy`; `no-store` on API responses.
- The front end writes to the DOM only with `textContent` (no `innerHTML`), so no XSS sink.
- LLM safety: user note is delimited and marked untrusted; output must be JSON, ≤ 600 characters
  and link-free or it is discarded.
- Runs as a non-root user in the container; CI uses read-only permissions.

## Accessibility
Semantic landmarks and a skip link; every control has a visible label; fieldset/legend for the
group choices; verdicts use **text + icon, never colour alone**; WCAG AA contrast in light and
dark mode; `aria-live` results region that receives focus after submit; errors announced with
`role="alert"` and `aria-invalid`; forecast as a real data table (not only a chart); 44 px touch
targets; visible focus rings; respects `prefers-reduced-motion`; works fully by keyboard.

## Testing
75 tests, ~99% coverage (CI fails under 85%): AQI band boundaries, every verdict threshold,
persona rules, best-window selection with missing data, the note parser (incl. negations), the
Open-Meteo client (mocked HTTP, caching, error mapping), Gemini success and every failure path,
prompt-injection, rate limiting, security headers and input validation.

```bash
pip install -r requirements-dev.txt
ruff check .
pytest
```

## Run locally
```bash
pip install -r requirements.txt
cp .env.example .env            # optional: add GEMINI_API_KEY
export $(grep -v '^#' .env | xargs)   # or set variables your own way
PYTHONPATH=src uvicorn aether.api:app --reload
# open http://localhost:8000
```

## Deploy (Google Cloud Run)
```bash
gcloud run deploy aether-ai --source . --region asia-south1 --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest
```

## Project layout
```
src/aether/   api.py (routes) · rules.py (decision engine) · airdata.py (Open-Meteo)
              advisor.py (Gemini + fallback) · profiles.py (note parsing) · security.py
              models.py · aqi.py · config.py · static/ (HTML, CSS, JS)
tests/        pytest suite     .github/workflows/ci.yml     Dockerfile
```

## Assumptions and limits
- AQI follows the US EPA scale as reported by Open-Meteo (modelled, not a street-level sensor).
- Multipliers are a simple, documented heuristic for prioritising caution, not clinical thresholds.
- Guidance is general and **not medical advice**; users with conditions should follow their doctor.
- The rate limiter and cache are per process; use a shared store if scaling to many instances.
