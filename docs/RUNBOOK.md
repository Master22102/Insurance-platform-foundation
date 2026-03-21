# Operations runbook (starter)

**Purpose:** Minimal “who does what” and links when something breaks. Expand per environment (staging / prod).

## Deployments

| Step | Owner | Reference |
|------|--------|-----------|
| Apply SQL migrations in order | DBA / founder-ops | **`docs/MIGRATIONS_APPLY_ORDER.md`** |

**Production-era tracking (§A + §B1):** progress score and checklist — **`docs/BLOCK_AB_PRODUCTION_TRACKER.md`**. Repo CI checks pass12–14 **files exist** (`npm run verify:migration-chain`); **remote apply** is always human/CI with DB access.
| Verify app revision | Eng | **`GET /api/health`** (`commit` when deploy env sets SHA) |
| Optional DB RPC check | Eng | **Actions → Verify optional (DB)** — **`docs/VERIFY_OPTIONAL.md`** |
| Optional browser contracts | Eng | **Actions → E2E contracts (optional)** — enable **Require Playwright storage state** when you need real runs — **`docs/CI_E2E_SAMPLE.md`** |

## Rollback

1. **App:** revert deployment / previous Vercel/Git SHA; confirm **`/api/health`** returns `ok: true`.
2. **Database:** avoid destructive rollback without a plan — prefer forward fix migrations; if you must revert, use provider backup + documented SQL (ticket required).

## Abuse / rate limits (application)

| Surface | Mitigation |
|---------|------------|
| **`POST /api/marketing/subscribe`** | In-process window limit per IP (best effort); tune with **`MARKETING_SUBSCRIBE_RATE_LIMIT_MAX`**, **`MARKETING_SUBSCRIBE_RATE_LIMIT_WINDOW_MS`**. For production scale, add **CDN/WAF** or Redis. |
| **`POST /api/quick-scan`** | Per-IP window before auth/file work — **`QUICK_SCAN_POST_RATE_LIMIT_MAX`** (default 40), **`QUICK_SCAN_POST_RATE_LIMIT_WINDOW_MS`** (default 15m). |
| **`POST /api/itinerary/normalize`** | Per-IP window before auth — **`ITINERARY_NORMALIZE_POST_RATE_LIMIT_MAX`**, **`ITINERARY_NORMALIZE_POST_RATE_LIMIT_WINDOW_MS`**. |
| Auth / uploads | Ship bar **F2** — treat WAF + provider limits as primary; extend this doc when new caps ship. |

## Incident handoff

- **Security / tenant issues:** `docs/SECURITY_BROWSER_HARDENING.md`, `docs/SHIP_BAR.md` (gate **A1**).
- **Founder / legal items:** `lib/FOUNDER_DIRECT_INVOLVEMENT_LEDGER.md`.

---

*Last updated: 2026-03-18 (session 20).*
