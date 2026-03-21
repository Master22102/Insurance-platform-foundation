# Browser security hardening (reference)

Incremental controls shipped in-repo; tune per environment (CDN, Netlify, corporate proxy).

## Response headers (`next.config.js`)

Applied on all routes via `headers()`:

- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), microphone=(self), geolocation=()` — adjust if you add features that need other origins or sensors.

**CSP:** `next.config.js` sets either:

| Build-time env | Header | Behavior |
|----------------|--------|----------|
| *(default)* | `Content-Security-Policy-Report-Only` | Audit only — **does not block** |
| `CSP_MODE=enforce` | `Content-Security-Policy` | **Blocks** violations (same directive string as Report-Only) |

Directive set is intentionally **permissive** for Next 13 (`unsafe-inline` / `unsafe-eval`) and `connect-src https: wss:` for Supabase. **Do not** set `CSP_MODE=enforce` in production until you have triaged Report-Only violations in real traffic (DevTools → Console/Issues). Optional later: tighten directives, add `report-to` / `report-uri`.

`CSP_MODE` is read when **Next.js loads `next.config.js`** (build/start in production). Restart the dev server after changing it locally.

## Middleware auth (`middleware.ts`)

When `NEXT_PUBLIC_SUPABASE_*` is set, protected prefixes use **`@supabase/ssr` `createServerClient` + `auth.getUser()`** so expired or invalid sessions are redirected to `/signin` (cookie name alone is insufficient).

If those env vars are missing, middleware falls back to the legacy **Supabase-shaped cookie name** heuristic so misconfigured local builds do not hard-lock routes.

If `getUser()` **throws** (network / Supabase outage), middleware falls back to the same **cookie-shape** check so users are not entirely blocked; this is a **resilience** tradeoff vs strict validation.

## Marketing / CMS HTML

Blog post body HTML is built from markdown only after **HTML entity escaping** (`app/(marketing)/blog/[slug]/page.tsx`) so raw `<script>` / event handlers from `blog_posts.content` do not execute in the browser.

## Health route

`GET /api/health` returns **`{ ok: true, service: "wayfarer-web" }`** (optional short **`commit`** from deploy env — no secrets, no DB). Safe for load balancer / uptime probes.

## Public API abuse (best effort)

- **`POST /api/marketing/subscribe`** — in-memory **fixed-window** rate limit per client IP (`lib/rate-limit/simple-memory.ts`). Env: **`MARKETING_SUBSCRIBE_RATE_LIMIT_MAX`** (default `20`), **`MARKETING_SUBSCRIBE_RATE_LIMIT_WINDOW_MS`** (default 15 min). **429** + **`Retry-After`**.
- **`POST /api/quick-scan`** / **`POST /api/itinerary/normalize`** — same pattern per IP before heavy work (defaults **40** / 15 min). Env: **`QUICK_SCAN_POST_RATE_LIMIT_*`**, **`ITINERARY_NORMALIZE_POST_RATE_LIMIT_*`**. Prefer **edge/WAF** at scale — **`docs/RUNBOOK.md`**.

## Debug route

`GET /api/debug` in non-production returns only boolean `url_set` / `key_set` — no URL or key prefixes.

## E2E strict governance REST

Set `E2E_STRICT_POLICY_GOVERNANCE_REST=1` so policy governance PostgREST assertions after extraction **fail loudly** when misconfigured (see `docs/CI_E2E_SAMPLE.md`).
