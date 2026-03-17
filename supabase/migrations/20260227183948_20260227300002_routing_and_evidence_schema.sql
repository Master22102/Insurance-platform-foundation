/*
  # Routing Recommendations + Acceptance Checkpoints + Evidence Enhancements (F-6.5.5, F-6.5.6)

  ## Summary

  ### F-6.5.5: Claim Routing & Sequencing
  Stores deterministic routing recommendations per incident and records
  acceptance checkpoints (traveler acknowledgment of routing decision).

  ### routing_recommendations
  - rec_id (PK), incident_id FK, guide_id FK (optional), triggered_by
  - recommended_sequence: ordered jsonb array of routing steps
  - confidence_label (9.2 enum), reason_codes text[], founder_readable_explanation
  - accepted (bool), accepted_at, accepted_by, rejection_reason
  - itr_trace_id FK, created_at, metadata

  ### acceptance_checkpoints
  - Immutable log of traveler acceptance/rejection actions per recommendation.
  - checkpoint_id (PK), rec_id FK, incident_id FK, actor_id, action (accepted/rejected/deferred),
    reason_code, traveler_notes, checkpoint_at, metadata

  ### F-6.5.6: Evidence Enhancements
  Adds evidence_category and validation_status columns to existing evidence table.
  Adds evidence_validation_runs table for structured validation records.

  ## Security
  - RLS enabled, SELECT for authenticated, no direct INSERT policy
*/

CREATE TABLE IF NOT EXISTS routing_recommendations (
  rec_id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id                 uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  guide_id                    uuid REFERENCES credit_card_guide_versions(guide_id),
  triggered_by                uuid,
  recommended_sequence        jsonb NOT NULL DEFAULT '[]',
  confidence_label            confidence_label NOT NULL DEFAULT 'insufficient_data',
  reason_codes                text[] NOT NULL DEFAULT '{}',
  founder_readable_explanation text NOT NULL DEFAULT '',
  accepted                    boolean,
  accepted_at                 timestamptz,
  accepted_by                 uuid,
  rejection_reason            text,
  itr_trace_id                uuid REFERENCES interpretive_trace_records(trace_id),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  metadata                    jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS acceptance_checkpoints (
  checkpoint_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rec_id         uuid NOT NULL REFERENCES routing_recommendations(rec_id) ON DELETE CASCADE,
  incident_id    uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  actor_id       uuid,
  action         text NOT NULL DEFAULT 'accepted',
  reason_code    text,
  traveler_notes text,
  checkpoint_at  timestamptz NOT NULL DEFAULT now(),
  metadata       jsonb NOT NULL DEFAULT '{}',

  CONSTRAINT acceptance_checkpoint_action_valid CHECK (action IN ('accepted','rejected','deferred'))
);

CREATE INDEX IF NOT EXISTS idx_routing_recs_incident ON routing_recommendations(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_routing_recs_accepted ON routing_recommendations(incident_id, accepted) WHERE accepted IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_acceptance_checkpoints_rec ON acceptance_checkpoints(rec_id, checkpoint_at DESC);

ALTER TABLE routing_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE acceptance_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read routing recommendations"
  ON routing_recommendations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read acceptance checkpoints"
  ON acceptance_checkpoints FOR SELECT TO authenticated USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'evidence' AND column_name = 'evidence_category'
  ) THEN
    ALTER TABLE evidence ADD COLUMN evidence_category text DEFAULT 'general';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'evidence' AND column_name = 'validation_status'
  ) THEN
    ALTER TABLE evidence ADD COLUMN validation_status text DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'evidence' AND column_name = 'linked_guide_id'
  ) THEN
    ALTER TABLE evidence ADD COLUMN linked_guide_id uuid REFERENCES credit_card_guide_versions(guide_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS evidence_validation_runs (
  validation_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id     uuid NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  incident_id     uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  validated_by    uuid,
  validation_type text NOT NULL DEFAULT 'manual',
  result          text NOT NULL DEFAULT 'pending',
  confidence_label confidence_label NOT NULL DEFAULT 'insufficient_data',
  findings        jsonb NOT NULL DEFAULT '[]',
  reason_codes    text[] NOT NULL DEFAULT '{}',
  founder_readable_explanation text NOT NULL DEFAULT '',
  validated_at    timestamptz NOT NULL DEFAULT now(),
  metadata        jsonb NOT NULL DEFAULT '{}',

  CONSTRAINT evidence_validation_result_valid CHECK (result IN ('passed','failed','pending','needs_review'))
);

CREATE INDEX IF NOT EXISTS idx_evidence_validation_evidence ON evidence_validation_runs(evidence_id, validated_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_validation_incident ON evidence_validation_runs(incident_id, validated_at DESC);

ALTER TABLE evidence_validation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read evidence validation runs"
  ON evidence_validation_runs FOR SELECT TO authenticated USING (true);

INSERT INTO event_type_registry (event_type, schema_version, feature_id) VALUES
  ('routing_recommendation_generated', 1, 'F-6.5.5'),
  ('routing_recommendation_accepted',  1, 'F-6.5.5'),
  ('routing_recommendation_rejected',  1, 'F-6.5.5'),
  ('acceptance_checkpoint_recorded',   1, 'F-6.5.5'),
  ('evidence_validation_completed',    1, 'F-6.5.6'),
  ('evidence_linked_to_guide',         1, 'F-6.5.6')
ON CONFLICT (event_type) DO NOTHING;
