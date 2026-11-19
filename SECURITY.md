# Security

## Reporting a vulnerability
Please open a private report through GitHub's "Report a vulnerability" (Security tab) instead of a
public issue. Expect a reply within 7 days.

## How AETHER is protected
| Threat | Control | Where |
|---|---|---|
| Malformed or oversized input | Pydantic models with `extra="forbid"` and bounds on every field | `src/aether/models.py` |
| Prompt injection via the free-text note | Note passed to Gemini as delimited untrusted data; Gemini can only phrase the briefing, never change verdicts or numbers; output must be JSON, ≤ 700 chars, link-free | `src/aether/advisor.py` |
| XSS | CSP with no inline scripts or styles; DOM written only with `textContent` | `src/aether/security.py`, `static/js/app.js` |
| Clickjacking, sniffing, referrer leaks | `frame-ancestors 'none'`, COOP `same-origin`, `nosniff`, `no-referrer`, HSTS, `Permissions-Policy` | `src/aether/security.py` |
| Abuse / cost exhaustion | Per-client sliding-window rate limit; global Gemini calls-per-minute cap; bounded caches | `src/aether/security.py`, `advisor.py`, `airdata.py` |
| Rate-limit bypass via spoofed `X-Forwarded-For` | Header ignored unless `TRUSTED_PROXY_HOPS` is set, then only that many hops are trusted | `src/aether/security.py` |
| Briefing replay | One-time, unguessable `briefing_id` (128-bit), expires after 5 minutes | `src/aether/api.py` |
| Upstream hangs | Bounded timeouts on every outbound call | `src/aether/api.py`, `advisor.py` |
| Secret leaks | Secrets only from environment variables; logs carry request IDs, never bodies or keys | `src/aether/config.py`, `api.py` |
| Vulnerable dependencies | Exact locked versions, `pip-audit` + `npm audit` in CI, Dependabot weekly | `.github/` |
| Container escape impact | Image runs as a non-root user | `Dockerfile` |
