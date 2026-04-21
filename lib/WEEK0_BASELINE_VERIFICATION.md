# Week 0 Baseline Verification — Wayfarer Platform Reconciliation (v4 Roadmap)

Date: 2026-04-21
Scope: Verify the seven Week 0 baseline claims in the v4 Master Roadmap
against live repo state and the deployed Supabase database before any build
work begins.

---

## 1. Migration count

| Claim            | Observed (repo) | Observed (DB) | Result   |
| ---------------- | --------------- | ------------- | -------- |
| ~158 migrations  | 92 files        | 155 applied   | MISMATCH |

- Repo and DB disagree by 63 files.
- Logged as **M-001** in `MISMATCH_LOG.md`.

## 2. M-22 feature_registry completion columns

Expected columns present on `feature_registry`:
`phase`, `capability_tier_current`, `capability_tier_max`,
`has_pending_extension`, `parent_feature_id`, `requires_connector`,
`connector_status`.

| Claim                        | Observed | Result |
| ---------------------------- | -------- | ------ |
| All seven columns applied    | Present  | PASS   |

## 3. M-24 Options Engine event attribution

| Claim                                          | Observed         | Result           |
| ---------------------------------------------- | ---------------- | ---------------- |
| Events belong to F-6.5.8                       | Were F-6.5.7     | MISMATCH → FIXED |

- Six event types corrected via migration `fix_m24_event_attribution_f658`.
- Logged as **M-002** in `MISMATCH_LOG.md`; status RESOLVED.

## 4. f6517_* migration provenance

| Claim                                      | Observed                   | Result   |
| ------------------------------------------ | -------------------------- | -------- |
| Prefix identifies F-6.5.17 / F-6.5.10 work | Content is F-6.5.1 corpus  | MISMATCH |

- Four migration files dated 2026-03-30 use a misleading `f6517` prefix.
- Logged as **M-004**.

## 5. Erasure doctrine (Section 8.9)

| Claim                                 | Observed                   | Result   |
| ------------------------------------- | -------------------------- | -------- |
| `erasure_requests` table exists       | Only `erasure_redaction_log` | MISSING |

- Logged as **M-005**.

## 6. Feature registry content spot-check

| Feature ID | Expected display_name                   | Observed                                | Result |
| ---------- | --------------------------------------- | --------------------------------------- | ------ |
| F-6.5.1    | Policy Parsing & Clause Extraction      | Policy Parsing & Clause Extraction      | PASS   |
| F-6.5.7    | Incident Timeline Read Model            | Incident Timeline Read Model            | PASS   |
| F-6.5.8    | Active Disruption Options Engine        | Active Disruption Options Engine        | PASS   |
| F-6.5.10   | Carrier Discrepancy Detection           | Carrier Discrepancy Detection           | PASS   |
| F-6.5.17   | Trip Draft Engine                       | Trip Draft Engine                       | PASS   |

## 7. Broader event_type_registry drift

- Ten additional events tagged F-6.5.7 likely belong to other features
  (trip_readiness_*, trip_state_advanced, unresolved_item_*, voice_*).
- Two events (causality_link_suppressed, rebooking_log_suppressed) need
  ownership verification.
- Logged as **M-003**; scheduled for remediation pass 2.

---

## Summary

| Check                                  | Status   |
| -------------------------------------- | -------- |
| 1. Migration count                     | MISMATCH |
| 2. M-22 columns present                | PASS     |
| 3. M-24 event attribution              | FIXED    |
| 4. f6517 prefix provenance             | MISMATCH |
| 5. Erasure doctrine table              | MISSING  |
| 6. Feature registry content            | PASS     |
| 7. Broader event registry drift        | OPEN     |

**Net**: Two passes (2, 6) confirm the expected state. One mismatch has been
remediated (3). Four items remain open and are tracked in `MISMATCH_LOG.md`
for sequenced remediation.
