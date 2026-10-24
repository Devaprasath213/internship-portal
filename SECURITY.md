# Security Checklist

| Control | Where | Evidence |
|---|---|---|
| Parameterized queries (no string-built SQL) | `app.js`, `db.js` | Named/positional bindings everywhere; injection test in `test/applications.test.js` |
| Server-side validation (name, email, URL scheme, lengths, internship ID) | `validate.js` | 400 tests for each rule |
| Client-side validation (UX only; server is authoritative) | `public/main.js` | Mirrors the same rules |
| Duplicate applications rejected | `UNIQUE(internship_id, email)` in schema | 409 test |
| Rate limiting: 100 req/15 min on `/api`, 10 applications/15 min | `app.js` (express-rate-limit) | 429 test |
| Secure headers (CSP, nosniff, frame protection, HSTS, no `X-Powered-By`) | `helmet()` in `app.js` | Header test |
| Request body limit (10 kb) | `express.json({ limit })` | 413 test |
| Unsafe URL schemes blocked (`javascript:`, `data:`, `ftp:`) | `validate.js` | URL test |
| XSS: API data rendered with `textContent`, no inline scripts (CSP-compatible) | `public/main.js` | No `innerHTML` used |
| No sensitive data in logs (only the internship ID is logged) | `app.js` | Code review |
| Generic 500 errors, no stack traces to clients | `app.js` error handler | Code review |
| No secrets in repo; `.env.example` only | `.env.example`, `.gitignore` | Repo review |

## Known limitations
- Rate limits are per-IP and in memory (fine for one server; use a shared store like Redis when scaling).
- No authentication: this is a public application form by design.
- Emails are not verified.
