# Test Report

**Date:** 2026-11-11
**Command:** `npm test` (Node built-in test runner)
**Result:** 13 tests, 13 passed, 0 failed (about 0.86 s)

| # | Test | What it checks |
|---|------|----------------|
| 1 | GET /api/internships returns envelope with seeded IDs | Response has `status`, `data`, `pagination`; seed IDs (INT-101 to INT-105) preserved |
| 2 | Filters by domain and mode | Search filters return only matching records |
| 3 | SQL injection string in search is treated as plain text | Parameterized queries prevent injection |
| 4 | Accepts a valid application | Happy path returns 201 |
| 5 | Accepts application without optional fields | Portfolio URL and message are optional |
| 6 | Rejects missing name | Server-side validation returns 400 |
| 7 | Rejects invalid email | Server-side validation returns 400 |
| 8 | Rejects unsafe URL schemes | `javascript:` and similar URLs are refused |
| 9 | Rejects unknown internship with 404 | Cannot apply to a non-existent record |
| 10 | Rejects duplicate application with 409 | Same email cannot apply twice to one internship |
| 11 | Rejects malformed JSON and oversized bodies | Returns 400 and 413 with generic messages |
| 12 | Sends secure headers | Helmet headers are present |
| 13 | Rate limit returns 429 after the limit is exceeded | Abuse protection works |

## Manual checks
- `GET /health` returns `{"status":"ok","uptime":...,"db":"connected"}` (screenshot: `../screenshots/health.png`)
- Request logs print method, path, status and duration only (screenshot: `../screenshots/logs.png`)
