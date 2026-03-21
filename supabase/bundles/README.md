# Bundled SQL (one-batch apply)

| File | Purpose |
|------|--------|
| `gap-through-pass14-ONE-BATCH.sql` | **14** remaining gap migrations (**excludes** `20260321170000_section41_*` — apply that separately if not done). Regenerate after doc list changes. |

**Regenerate** after repo gap list changes:

```bash
npm run bundle:gap-migrations
```

**Notes:**

- If the run errors, find the section `-- >>>>>>> BEGIN: filename` in the bundle and fix or run that file alone.
- Manual paste may **not** update `supabase_migrations.schema_migrations`; compare object behavior or use **CLI `db push`** later to realign the ledger.
