# Optional verification scripts (local / CI secrets)

These **`npm run verify:*`** commands **fail hard** only when you opt in with secrets; otherwise they **skip with exit 0** so default PR CI stays secret-free.

## `npm run verify:csp-config`

- **Always runs** in `.github/workflows/ci.yml` (no secrets).
- Reloads **`next.config.js`** twice and checks headers: default **Report-Only** vs **`CSP_MODE=enforce`** blocking header.
- Implementation: `scripts/verify-csp-next-config.cjs`.

## `npm run verify:ingest-corpus-idempotency`

- **`ingest_corpus_rules`** is **`service_role` only** — this script uses **`SUPABASE_SERVICE_ROLE_KEY`**, not the anon key.
- **Requires:**
  - `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `VERIFY_CORPUS_ACTOR_UUID` — a real **`auth.users.id`** in the target project (policies FK).
- **Asserts:** first ingest creates a corpus document; second identical payload reports **`docs_skipped >= 1`** and **`docs_created === 0`** (document-level hash idempotency).
- If any var is missing: prints **SKIP** and exits **0**.
- Local run: missing env → **SKIP** (exit 0). **Do not** print keys in logs.

### GitHub Actions (manual)

Workflow: **`.github/workflows/verify-optional-db.yml`** — **workflow_dispatch** only.

| Repo secret | Purpose |
|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same as app (project URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — never client bundle |
| `VERIFY_CORPUS_ACTOR_UUID` | An **`auth.users.id`** that exists in that project |

The job **fails** if any secret is unset (so a manual run is never a silent no-op). For local iteration, use the shell exports below instead.

```bash
export VERIFY_CORPUS_ACTOR_UUID="<uuid-from-auth-users>"
export SUPABASE_SERVICE_ROLE_KEY="..."
export NEXT_PUBLIC_SUPABASE_URL="https://....supabase.co"
npm run verify:ingest-corpus-idempotency
```

Related backlog: **`docs/NEXT_PASS_BACKLOG.md`** (Slice 1 / corpus).
