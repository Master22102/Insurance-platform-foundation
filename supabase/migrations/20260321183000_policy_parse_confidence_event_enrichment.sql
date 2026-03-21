/*
  Enforce 9.2 confidence metadata on policy parse events.

  Applies to policy_parse_complete and policy_parse_partial events before insert
  into event_ledger so records stay append-only while carrying deterministic
  confidence logging fields.
*/

CREATE OR REPLACE FUNCTION enrich_policy_parse_confidence_metadata()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_clause_ids uuid[] := ARRAY[]::uuid[];
  v_version_id uuid;
  v_confidence_label text;
BEGIN
  IF NEW.event_type NOT IN ('policy_parse_complete', 'policy_parse_partial') THEN
    RETURN NEW;
  END IF;

  IF NEW.event_type = 'policy_parse_complete' THEN
    v_confidence_label := 'HIGH_STRUCTURAL_ALIGNMENT';
  ELSE
    v_confidence_label := 'CONDITIONAL_ALIGNMENT';
  END IF;

  IF NEW.metadata ? 'version_id' THEN
    v_version_id := NULLIF(NEW.metadata->>'version_id', '')::uuid;
    IF v_version_id IS NOT NULL THEN
      SELECT COALESCE(array_agg(clause_id), ARRAY[]::uuid[])
      INTO v_clause_ids
      FROM policy_clauses
      WHERE policy_version_id = v_version_id;
    END IF;
  ELSIF NEW.scope_type = 'policy_document' THEN
    SELECT COALESCE(array_agg(clause_id), ARRAY[]::uuid[])
    INTO v_clause_ids
    FROM policy_clauses
    WHERE policy_document_id = NEW.scope_id;
  END IF;

  NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'confidence_label', v_confidence_label,
      'confidence_version', '9.2.v1',
      'clause_ids_referenced', to_jsonb(v_clause_ids),
      'cco_reference_id', null
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrich_policy_parse_confidence_metadata ON event_ledger;
CREATE TRIGGER trg_enrich_policy_parse_confidence_metadata
BEFORE INSERT ON event_ledger
FOR EACH ROW
EXECUTE FUNCTION enrich_policy_parse_confidence_metadata();
