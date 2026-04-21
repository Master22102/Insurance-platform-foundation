# ADR 0001 — Retire the `f6517_` migration prefix; adopt feature-ID prefix convention

- Status: Accepted
- Date: 2026-04-21
- Deciders: Wayfarer founding team
- Supersedes: none
- Related: `lib/MISMATCH_LOG.md` entry **M-004**

## Context

Four migrations dated 2026-03-30 use a `f6517_` prefix:

- `20260330100000_f6517_catalog_and_cost_ledger.sql`
- `20260330100100_f6517_corpus_catalog_seed.sql`
- `20260330100200_f6517_chase_reserve_catalog_clauses.sql`
- `20260330100300_f6517_spec_v3_schema_alignment.sql`

The prefix implies feature F-6.5.17 (Trip Draft Engine) or could be read as
F-6.5.10 (Carrier Discrepancy Detection). The actual content is policy /
benefit corpus work — the domain of **F-6.5.1 (Policy Parsing & Clause
Extraction)**. Auditors tracing a feature's SQL surface by ID will not find
these files under the correct feature.

Renaming applied migration files is forbidden by the migration-immutability
rule (`.cursor/rules/security-and-data-guardrails.mdc` §4). We need a
forward-only path that:

1. Correctly attributes the four files to their owning feature.
2. Establishes a naming convention for future migrations that eliminates the
   ambiguity.

## Decision

### Backward-looking

1. The four `f6517_` files are declared to belong to **F-6.5.1** (Policy
   Parsing & Clause Extraction / Coverage Catalog). The `f6517_` token in
   their filenames is treated as an opaque, meaningless token — not a
   feature-ID reference.
2. A feature-to-migration map will be maintained in
   `lib/feature-migration-map.md`, and the four files are listed there under
   F-6.5.1. The ledger MISMATCH_LOG entry M-004 is closed by this ADR +
   that map entry; no file rename occurs.

### Forward-looking

All new migrations that are scoped to a single feature adopt this filename
pattern:

```
<UTC_timestamp>_f<feature-id-dashed>_<slug>.sql
```

where `<feature-id-dashed>` is the feature ID with dots replaced by
underscores. Examples:

- F-6.5.17 (Trip Draft Engine) →
  `20260422090000_f_6_5_17_trip_draft_initial_schema.sql`
- F-6.5.10 (Carrier Discrepancy Detection) →
  `20260422090100_f_6_5_10_discrepancy_event_types.sql`
- F-6.5.1 (Policy Parsing & Clause Extraction) →
  `20260422090200_f_6_5_1_clause_taxonomy_v2.sql`

Migrations that touch multiple features use the prefix `multi_` followed by
the primary feature ID. The migration summary header lists every feature
whose surface is modified (§9a dependency declaration).

### Prohibited prefixes going forward

The bare `f<digits>` pattern (e.g. `f6517_`, `f658_`) is retired. It is
ambiguous because it can be parsed as either F-6.5.17 or F-6-5-1-7 or
F-6-5-1 + a seed token. Every new filename uses the underscore-dashed form
above.

## Consequences

### Positive

- Filenames self-document feature ownership.
- Parsing a feature's migration surface is a single `ls` with a glob.
- No data migration is needed to close M-004; the ADR + migration map
  suffice.

### Negative

- Two prefix conventions now coexist in history (legacy files + new files).
  The migration map is mandatory to disambiguate.

### Neutral

- The four legacy `f6517_` files remain on disk unchanged. Their content is
  already applied to the deployed database and is correct; only their
  naming is imperfect.

## Compliance checklist for future migrations

- [ ] Filename follows `<timestamp>_f_<feature_id_dashed>_<slug>.sql`.
- [ ] Migration summary header cites the owning feature ID.
- [ ] If multiple features are touched, the `multi_` prefix is used and
      every feature is listed in the header.
- [ ] `lib/feature-migration-map.md` is updated in the same PR.
