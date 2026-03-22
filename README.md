# Wayfarer — Document Intelligence Platform

## Codebase Structure

```
├── app/                          # Next.js application
│   ├── api/extraction/           # Extraction API routes
│   │   ├── upload-complete/      # POST: Register upload, queue extraction
│   │   ├── process/              # POST: Trigger extraction for a document
│   │   └── status/               # GET: Check extraction progress
│   ├── layout.tsx
│   └── page.tsx
│
├── lib/                          # Core libraries
│   ├── document-intelligence/    # Extraction pipeline (18 modules)
│   │   ├── index.ts              # Pipeline entry — processDocument()
│   │   ├── reader.ts             # PDF/HTML/MHTML/TXT/XML readers
│   │   ├── segmenter.ts          # Text → sections (heading detection)
│   │   ├── clause-family-passes.ts # Phrase matching + value extraction
│   │   ├── pass-phrase-clusters.ts # 10 pass groups, 38+ clause types
│   │   ├── consolidation.ts      # Dedup similar candidates
│   │   ├── normalizer.ts         # Canonical value normalization
│   │   ├── confidence.ts         # Confidence scoring
│   │   ├── conflict-resolution.ts # Detect true conflicts
│   │   ├── promotion.ts          # Promote HIGH confidence → rules
│   │   ├── types.ts              # TypeScript type definitions
│   │   └── ...                   # Taxonomy, quality, phrase clusters
│   │
│   ├── extraction-bridge.ts      # Rules → database schema transform
│   ├── business-logic.ts         # State machine rules
│   └── auth/ + supabase/         # Auth and database client
│
├── scripts/                      # Operational scripts
│   ├── extraction-worker.ts      # Background job processor
│   ├── extraction/pipeline.py    # Python evaluation engine (offline)
│   ├── governance/               # Corpus governance + FOCL outputs
│   └── validation/               # Bridge dry-run validator
│
├── supabase/migrations/          # 75 SQL migrations (schema + RPCs)
├── document-intelligence/        # Source corpus (47 documents)
├── data/                         # Registry, coverage graph, corpus zones
└── tmp/                          # Evaluation outputs (not deployed)
```

## End-to-End Flow

```
Upload PDF → Storage → /api/extraction/upload-complete
  → initiate_policy_upload() creates policy + document
  → Job queued in job_queue

Worker picks up job → processDocument()
  → reader → segmenter → 10 clause passes → consolidation
  → normalization → conflict resolution → confidence → promotion
  → record_extraction_complete() writes policy_clauses

Coverage Graph available → compute_coverage_graph()
  → Reads AUTO_ACCEPTED clauses → builds graph nodes/edges
  → Claim Routing can evaluate incidents against real coverage
```

## Testing

```bash
# Offline extraction (no database)
python3 scripts/extraction/pipeline.py

# Bridge validation (no database)
python3 scripts/validation/bridge-validation.py

# Full end-to-end (with Supabase)
supabase db push && npm run dev
```

## CI & browser hardening

- **Runbook:** `docs/RUNBOOK.md` — deploy/migrate pointers, rollback notes, abuse/rate-limit summary.
- **Health:** `GET /api/health` — JSON liveness (`ok`, `service`; optional short `commit` when deploy env sets `VERCEL_GIT_COMMIT_SHA` / `GITHUB_SHA` / `HEALTH_GIT_SHA`). No DB.
- **PR CI:** `.github/workflows/ci.yml` — `npm run typecheck`, `npm run lint`, `npm run verify:csp-config`, `npm run build` (build uses placeholder `NEXT_PUBLIC_SUPABASE_*`). Playwright: see `docs/CI_E2E_SAMPLE.md`.
- **Optional verify:** `docs/VERIFY_OPTIONAL.md` — local **`verify:ingest-corpus-idempotency`** (skips if env missing); GitHub **Verify optional (DB)** workflow (fail-fast if secrets missing).
- **CSP:** Default is **Report-Only** (`next.config.js`). For blocking CSP after you triage violations, set build-time **`CSP_MODE=enforce`**. Details: `docs/SECURITY_BROWSER_HARDENING.md`.

## Key Numbers

| Metric | Value |
|--------|-------|
| Corpus | 47 docs |
| Rules | 230 promoted |
| Clause families | 34 |
| Coverage graph | 319 nodes, 943 edges |
| Migrations | 75 |
