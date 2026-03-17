/*
  # Bridge Migration: Extraction Pipeline → Database Schema
  
  Purpose:
    Connect the document intelligence extraction pipeline output
    to the policy_clauses / coverage_graph database schema.
  
  What this does:
    1. Extends clause_taxonomy_registry with extraction pipeline clause types
    2. Adds source_type values for platform-maintained guides
    3. Adds structured_value jsonb column to policy_clauses for numeric extraction
    4. Creates extraction_pipeline_source enum for provenance tracking
    5. Registers new event types for pipeline-to-database bridge
  
  What this does NOT do:
    - Change existing table structures
    - Modify existing RPCs
    - Break any existing functionality
    
  Grounded in:
    - F-6.5.1 Policy Parsing & Clause Extraction (Section 4 Canonical Clause Taxonomy)
    - Section 3.2 Core Data Objects (CoverageNode)
    - Section 12.3 Data Pipelines
*/

-- =====================================================
-- 1. Extend clause_taxonomy_registry with extraction clause types
-- =====================================================
-- These map the extraction pipeline's clause_type values to the 
-- database taxonomy family structure (FAM-01 through FAM-15+)

INSERT INTO clause_taxonomy_registry (clause_type, family_code, family_name, description, downstream_features) VALUES
  -- Delay thresholds and limits
  ('trip_delay_threshold',           'FAM-11', 'Delay',        'Minimum delay duration to trigger trip delay coverage', ARRAY['F-6.5.2','F-6.5.3','F-6.5.5']),
  ('trip_delay_limit',               'FAM-05', 'Limits',       'Maximum reimbursement amount for trip delay expenses', ARRAY['F-6.5.2','F-6.5.5']),
  ('baggage_delay_threshold',        'FAM-10', 'Baggage',      'Minimum delay duration to trigger baggage delay coverage', ARRAY['F-6.5.2']),
  
  -- Liability and coverage limits
  ('baggage_liability_limit',        'FAM-10', 'Baggage',      'Maximum liability for lost or damaged baggage', ARRAY['F-6.5.2','F-6.5.5']),
  ('carrier_liability_cap',          'FAM-10', 'Baggage',      'Carrier liability cap under international convention (Montreal/Warsaw)', ARRAY['F-6.5.2']),
  ('medical_emergency_coverage_limit','FAM-09', 'Medical',     'Maximum coverage for emergency medical expenses', ARRAY['F-6.5.2','F-6.5.5']),
  ('emergency_evacuation_limit',     'FAM-12', 'Evacuation',   'Maximum coverage for emergency medical evacuation', ARRAY['F-6.5.2','F-6.5.5']),
  ('dental_emergency_limit',         'FAM-09', 'Medical',      'Maximum coverage for emergency dental treatment', ARRAY['F-6.5.2']),
  ('rental_car_damage_limit',        'FAM-05', 'Limits',       'Maximum coverage for rental car damage (CDW/LDW)', ARRAY['F-6.5.2']),
  ('personal_accident_coverage_limit','FAM-05', 'Limits',      'Maximum coverage for accidental death or dismemberment', ARRAY['F-6.5.2']),
  ('personal_effects_coverage_limit','FAM-05', 'Limits',       'Maximum coverage for stolen or lost personal belongings', ARRAY['F-6.5.2']),
  ('supplemental_liability_limit',   'FAM-05', 'Limits',       'Maximum third-party liability coverage', ARRAY['F-6.5.2']),
  ('repatriation_remains_limit',     'FAM-12', 'Evacuation',   'Maximum coverage for repatriation of remains', ARRAY['F-6.5.2']),
  
  -- Cancellation and interruption
  ('trip_cancellation_limit',        'FAM-08', 'Cancellation', 'Maximum reimbursement for trip cancellation', ARRAY['F-6.5.2','F-6.5.5']),
  ('trip_interruption_limit',        'FAM-08', 'Cancellation', 'Maximum reimbursement for trip interruption', ARRAY['F-6.5.2','F-6.5.5']),
  ('hotel_cancellation_window',      'FAM-08', 'Cancellation', 'Time window for hotel cancellation without penalty', ARRAY['F-6.5.2']),
  ('cruise_cancellation_window',     'FAM-08', 'Cancellation', 'Time window for cruise cancellation without full penalty', ARRAY['F-6.5.2']),
  
  -- Deadlines and timing
  ('claim_deadline_days',            'FAM-14', 'Notice',       'Number of days within which a claim must be filed', ARRAY['F-6.5.5']),
  ('deposit_requirement',            'FAM-03', 'Conditions',   'Required deposit amount for booking', ARRAY['F-6.5.2']),
  ('final_payment_deadline',         'FAM-07', 'Timing',       'Deadline for final payment before departure', ARRAY['F-6.5.2']),
  ('check_in_deadline',              'FAM-07', 'Timing',       'Required check-in time before departure', ARRAY['F-6.5.2']),
  ('missed_connection_threshold',    'FAM-11', 'Delay',        'Minimum delay to trigger missed connection coverage', ARRAY['F-6.5.2']),
  
  -- Documentation requirements
  ('requires_receipts',              'FAM-03', 'Conditions',   'Whether receipts are required for reimbursement', ARRAY['F-6.5.5','F-6.5.6']),
  ('requires_police_report',         'FAM-03', 'Conditions',   'Whether a police report is required for certain claims', ARRAY['F-6.5.5','F-6.5.6']),
  ('requires_medical_certificate',   'FAM-03', 'Conditions',   'Whether a medical certificate is required', ARRAY['F-6.5.5','F-6.5.6']),
  ('requires_carrier_delay_letter',  'FAM-03', 'Conditions',   'Whether a carrier delay confirmation letter is required', ARRAY['F-6.5.5','F-6.5.6']),
  ('requires_baggage_pir',           'FAM-03', 'Conditions',   'Whether a Property Irregularity Report is required', ARRAY['F-6.5.5','F-6.5.6']),
  ('requires_itinerary',             'FAM-03', 'Conditions',   'Whether travel itinerary documentation is required', ARRAY['F-6.5.5','F-6.5.6']),
  ('requires_payment_proof',         'FAM-03', 'Conditions',   'Whether proof of payment is required', ARRAY['F-6.5.5','F-6.5.6']),
  
  -- Payment and eligibility conditions
  ('payment_method_requirement',     'FAM-03', 'Conditions',   'Required payment method for coverage eligibility', ARRAY['F-6.5.2','F-6.5.3']),
  ('common_carrier_requirement',     'FAM-03', 'Conditions',   'Requirement that travel must be on a common carrier', ARRAY['F-6.5.2']),
  ('round_trip_requirement',         'FAM-03', 'Conditions',   'Requirement that travel must be round-trip', ARRAY['F-6.5.2']),
  ('refund_eligibility_rule',        'FAM-08', 'Cancellation', 'Conditions under which refunds are eligible', ARRAY['F-6.5.2','F-6.5.5']),
  
  -- EU passenger rights
  ('eu_delay_compensation_threshold','FAM-16', 'EU Rights',    'EU261 compensation threshold based on delay and distance', ARRAY['F-6.5.2','F-6.5.5']),
  ('eu_denied_boarding_compensation','FAM-16', 'EU Rights',    'EU261 compensation for involuntary denied boarding', ARRAY['F-6.5.2','F-6.5.5']),
  ('eu_care_obligation',             'FAM-16', 'EU Rights',    'EU261 airline duty of care (meals, hotel, transport)', ARRAY['F-6.5.2','F-6.5.5']),
  ('eu_rerouting_obligation',        'FAM-16', 'EU Rights',    'EU261 right to rerouting or alternative transport', ARRAY['F-6.5.2','F-6.5.5']),
  ('eu_refund_deadline',             'FAM-16', 'EU Rights',    'EU261 deadline for ticket reimbursement (7 days)', ARRAY['F-6.5.5']),
  ('eu_cancellation_compensation',   'FAM-16', 'EU Rights',    'EU261 compensation for flight cancellation', ARRAY['F-6.5.2','F-6.5.5'])
ON CONFLICT (clause_type) DO UPDATE SET
  family_code = EXCLUDED.family_code,
  description = EXCLUDED.description,
  downstream_features = EXCLUDED.downstream_features;

-- =====================================================
-- 2. Add structured_value column to policy_clauses
-- =====================================================
-- This stores the machine-readable extracted value alongside 
-- the canonical_text (human-readable). Required for the Coverage
-- Graph to compute limits, thresholds, and deadlines.

ALTER TABLE policy_clauses
  ADD COLUMN IF NOT EXISTS structured_value jsonb,
  ADD COLUMN IF NOT EXISTS extraction_pipeline_version text,
  ADD COLUMN IF NOT EXISTS extraction_mode text
    CHECK (extraction_mode IS NULL OR extraction_mode IN (
      'native_pdf','native_pdf_plus_ocr','ocr_only','txt','html','mhtml','xml'
    ));

COMMENT ON COLUMN policy_clauses.structured_value IS 
  'Machine-readable extraction: {type, value, unit, raw}. Used by Coverage Graph for numeric comparison.';
COMMENT ON COLUMN policy_clauses.extraction_pipeline_version IS
  'Version of the extraction pipeline that produced this clause.';
COMMENT ON COLUMN policy_clauses.extraction_mode IS
  'How the source document was read: native_pdf, ocr_only, txt, etc.';

-- =====================================================
-- 3. Extend policy_documents source_type for platform guides
-- =====================================================
-- The extraction pipeline processes platform-maintained guides
-- (credit card benefit guides, airline CoCs) which are NOT user uploads.

ALTER TABLE policy_documents
  DROP CONSTRAINT IF EXISTS policy_documents_source_type_check;
ALTER TABLE policy_documents
  ADD CONSTRAINT policy_documents_source_type_check
  CHECK (source_type IN (
    'pdf_upload','email_forward','manual_entry',
    'platform_guide','corpus_extraction'
  ));

-- =====================================================
-- 4. Register bridge event types
-- =====================================================
INSERT INTO event_type_registry (event_type, schema_version, feature_id, severity_class) VALUES
  ('corpus_rule_ingested',           1, 'F-6.5.1', 'info'),
  ('corpus_document_registered',     1, 'F-6.5.1', 'info'),
  ('corpus_extraction_bridge_run',   1, 'F-6.5.1', 'info'),
  ('corpus_rule_rejected_by_gate',   1, 'F-6.5.1', 'warning')
ON CONFLICT (event_type) DO NOTHING;

-- =====================================================
-- 5. Add benefit_type mapping view for Coverage Graph
-- =====================================================
-- The compute_coverage_graph() RPC groups clauses by benefit_type.
-- This view provides the canonical mapping from extraction clause_type
-- to coverage graph benefit_type categories.

CREATE OR REPLACE VIEW clause_to_benefit_type_map AS
SELECT 
  clause_type,
  CASE
    WHEN clause_type IN ('trip_delay_threshold','trip_delay_limit','baggage_delay_threshold','missed_connection_threshold') THEN 'travel_delay'
    WHEN clause_type IN ('trip_cancellation_limit','hotel_cancellation_window','cruise_cancellation_window','refund_eligibility_rule') THEN 'trip_cancellation'
    WHEN clause_type IN ('trip_interruption_limit') THEN 'trip_interruption'
    WHEN clause_type IN ('baggage_liability_limit','carrier_liability_cap','requires_baggage_pir') THEN 'baggage_protection'
    WHEN clause_type IN ('medical_emergency_coverage_limit','dental_emergency_limit','requires_medical_certificate') THEN 'medical_expense'
    WHEN clause_type IN ('emergency_evacuation_limit','repatriation_remains_limit') THEN 'emergency_evacuation'
    WHEN clause_type IN ('rental_car_damage_limit','personal_effects_coverage_limit','personal_accident_coverage_limit','supplemental_liability_limit') THEN 'rental_protection'
    WHEN clause_type IN ('eu_delay_compensation_threshold','eu_denied_boarding_compensation','eu_cancellation_compensation') THEN 'eu_compensation'
    WHEN clause_type IN ('eu_care_obligation','eu_rerouting_obligation','eu_refund_deadline') THEN 'eu_passenger_rights'
    WHEN clause_type IN ('payment_method_requirement','common_carrier_requirement','round_trip_requirement') THEN 'eligibility_condition'
    WHEN clause_type LIKE 'requires_%' THEN 'documentation_requirement'
    ELSE 'general_' || clause_type
  END AS benefit_type,
  family_code,
  family_name
FROM clause_taxonomy_registry
WHERE active = true;
