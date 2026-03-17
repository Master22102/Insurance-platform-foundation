/**
 * Extraction Bridge — Rule Inventory → Database Schema
 * =====================================================
 * 
 * Transforms the extraction pipeline's rule-inventory.json output
 * into the format expected by the ingest_corpus_rules() database RPC,
 * which writes rules into policy_clauses for Coverage Graph consumption.
 * 
 * This is the bridge between:
 *   Extraction subsystem (offline, file-based, Python) 
 *   → Database substrate (online, Supabase, TypeScript)
 * 
 * Usage:
 *   import { bridgeRulesToDatabase, dryRunBridge } from '@/lib/extraction-bridge';
 *   
 *   // Dry run first (safe, no writes)
 *   const preview = await dryRunBridge(ruleInventory);
 *   
 *   // Then commit
 *   const result = await bridgeRulesToDatabase(ruleInventory, actorId);
 * 
 * Grounded in:
 *   - F-6.5.1 Policy Parsing (clause extraction → structured output)
 *   - F-6.5.2 Coverage Graph (consumes AUTO_ACCEPTED clauses)
 *   - Section 3.0 Governance Substrate (event emission)
 *   - Section 12.3 Data Pipelines (canonical ingestion path)
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================
// TYPES — matching rule-inventory.json structure
// ============================================================

export interface ExtractedRule {
  rule_id: string;
  clause_type: string;
  normalized_value: string | number | boolean;
  value_type: 'currency' | 'sdr' | 'duration' | 'days' | 'boolean' | 'text_rule';
  raw_value: string;
  unit: string;
  confidence: string;
  operational_or_requirement: 'operational' | 'requirement';
  source_snippet: string;
  source_snippet_hash: string;
  source_section: string;
  detected_by_pass: string;
  high_value: boolean;
  source_file: string;
  source_family: string;
  artifact_type: string;
  extraction_mode: string;
  has_table_data: boolean;
  quality_notes: string;
}

export interface BridgeResult {
  ok: boolean;
  dry_run: boolean;
  docs_created: number;
  docs_skipped: number;
  clauses_created: number;
  clauses_rejected: number;
  total_docs_processed: number;
  pipeline_version: string;
}

export interface BridgePreview {
  total_rules: number;
  unique_documents: number;
  by_clause_type: Record<string, number>;
  by_source_family: Record<string, number>;
  by_confidence: Record<string, number>;
  rules_with_citation: number;
  rules_without_citation: number;
  high_value_rules: number;
}

// ============================================================
// CLAUSE TYPE → FAMILY CODE MAPPING
// ============================================================
// Must match the taxonomy seeded in the migration

const CLAUSE_TO_FAMILY: Record<string, string> = {
  // Delay
  trip_delay_threshold: 'FAM-11',
  trip_delay_limit: 'FAM-05',
  baggage_delay_threshold: 'FAM-10',
  missed_connection_threshold: 'FAM-11',
  // Limits
  baggage_liability_limit: 'FAM-10',
  carrier_liability_cap: 'FAM-10',
  medical_emergency_coverage_limit: 'FAM-09',
  emergency_evacuation_limit: 'FAM-12',
  dental_emergency_limit: 'FAM-09',
  rental_car_damage_limit: 'FAM-05',
  personal_accident_coverage_limit: 'FAM-05',
  personal_effects_coverage_limit: 'FAM-05',
  supplemental_liability_limit: 'FAM-05',
  repatriation_remains_limit: 'FAM-12',
  // Cancellation
  trip_cancellation_limit: 'FAM-08',
  trip_interruption_limit: 'FAM-08',
  hotel_cancellation_window: 'FAM-08',
  cruise_cancellation_window: 'FAM-08',
  refund_eligibility_rule: 'FAM-08',
  // Timing
  claim_deadline_days: 'FAM-14',
  deposit_requirement: 'FAM-03',
  final_payment_deadline: 'FAM-07',
  check_in_deadline: 'FAM-07',
  // Conditions
  requires_receipts: 'FAM-03',
  requires_police_report: 'FAM-03',
  requires_medical_certificate: 'FAM-03',
  requires_carrier_delay_letter: 'FAM-03',
  requires_baggage_pir: 'FAM-03',
  requires_itinerary: 'FAM-03',
  requires_payment_proof: 'FAM-03',
  payment_method_requirement: 'FAM-03',
  common_carrier_requirement: 'FAM-03',
  round_trip_requirement: 'FAM-03',
  // EU
  eu_delay_compensation_threshold: 'FAM-16',
  eu_denied_boarding_compensation: 'FAM-16',
  eu_care_obligation: 'FAM-16',
  eu_rerouting_obligation: 'FAM-16',
  eu_refund_deadline: 'FAM-16',
  eu_cancellation_compensation: 'FAM-16',
};

// ============================================================
// BENEFIT TYPE MAPPING (for Coverage Graph consumption)
// ============================================================

export const CLAUSE_TO_BENEFIT_TYPE: Record<string, string> = {
  trip_delay_threshold: 'travel_delay',
  trip_delay_limit: 'travel_delay',
  baggage_delay_threshold: 'travel_delay',
  missed_connection_threshold: 'travel_delay',
  trip_cancellation_limit: 'trip_cancellation',
  trip_interruption_limit: 'trip_interruption',
  hotel_cancellation_window: 'trip_cancellation',
  cruise_cancellation_window: 'trip_cancellation',
  refund_eligibility_rule: 'trip_cancellation',
  baggage_liability_limit: 'baggage_protection',
  carrier_liability_cap: 'baggage_protection',
  requires_baggage_pir: 'baggage_protection',
  medical_emergency_coverage_limit: 'medical_expense',
  dental_emergency_limit: 'medical_expense',
  requires_medical_certificate: 'medical_expense',
  emergency_evacuation_limit: 'emergency_evacuation',
  repatriation_remains_limit: 'emergency_evacuation',
  rental_car_damage_limit: 'rental_protection',
  personal_effects_coverage_limit: 'rental_protection',
  personal_accident_coverage_limit: 'rental_protection',
  supplemental_liability_limit: 'rental_protection',
  eu_delay_compensation_threshold: 'eu_compensation',
  eu_denied_boarding_compensation: 'eu_compensation',
  eu_cancellation_compensation: 'eu_compensation',
  eu_care_obligation: 'eu_passenger_rights',
  eu_rerouting_obligation: 'eu_passenger_rights',
  eu_refund_deadline: 'eu_passenger_rights',
  payment_method_requirement: 'eligibility_condition',
  common_carrier_requirement: 'eligibility_condition',
  round_trip_requirement: 'eligibility_condition',
};

// ============================================================
// PREVIEW (no database required)
// ============================================================

export function previewBridge(rules: ExtractedRule[]): BridgePreview {
  const byClause: Record<string, number> = {};
  const byFamily: Record<string, number> = {};
  const byConfidence: Record<string, number> = {};
  const docs = new Set<string>();
  let withCitation = 0;
  let withoutCitation = 0;
  let highValue = 0;

  for (const rule of rules) {
    byClause[rule.clause_type] = (byClause[rule.clause_type] || 0) + 1;
    byFamily[rule.source_family] = (byFamily[rule.source_family] || 0) + 1;
    byConfidence[rule.confidence] = (byConfidence[rule.confidence] || 0) + 1;
    docs.add(rule.source_file);

    if (rule.source_snippet && rule.source_snippet.length >= 10) {
      withCitation++;
    } else {
      withoutCitation++;
    }

    if (rule.high_value) highValue++;
  }

  return {
    total_rules: rules.length,
    unique_documents: docs.size,
    by_clause_type: byClause,
    by_source_family: byFamily,
    by_confidence: byConfidence,
    rules_with_citation: withCitation,
    rules_without_citation: withoutCitation,
    high_value_rules: highValue,
  };
}

// ============================================================
// DRY RUN (calls RPC with dry_run=true)
// ============================================================

export async function dryRunBridge(
  rules: ExtractedRule[],
  supabaseUrl?: string,
  supabaseKey?: string,
): Promise<BridgeResult> {
  const url = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !key) {
    // Return local preview if no database connection
    const preview = previewBridge(rules);
    return {
      ok: true,
      dry_run: true,
      docs_created: preview.unique_documents,
      docs_skipped: 0,
      clauses_created: preview.rules_with_citation,
      clauses_rejected: preview.rules_without_citation,
      total_docs_processed: preview.unique_documents,
      pipeline_version: 'extraction-bridge-v1.0',
    };
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase.rpc('ingest_corpus_rules', {
    p_rules: rules,
    p_actor_id: '00000000-0000-0000-0000-000000000000', // System actor for dry run
    p_pipeline_version: 'extraction-bridge-v1.0',
    p_dry_run: true,
  });

  if (error) throw new Error(`Bridge dry run failed: ${error.message}`);
  return data as BridgeResult;
}

// ============================================================
// LIVE BRIDGE (calls RPC with dry_run=false)
// ============================================================

export async function bridgeRulesToDatabase(
  rules: ExtractedRule[],
  actorId: string,
  supabaseUrl?: string,
  supabaseKey?: string,
  pipelineVersion: string = 'extraction-bridge-v1.0',
): Promise<BridgeResult> {
  const url = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !key) {
    throw new Error('Database connection required for live bridge. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  const supabase = createClient(url, key);

  // Always dry run first
  const dryResult = await dryRunBridge(rules, url, key);
  if (!dryResult.ok) {
    throw new Error('Dry run failed — aborting live bridge');
  }

  // Execute live
  const { data, error } = await supabase.rpc('ingest_corpus_rules', {
    p_rules: rules,
    p_actor_id: actorId,
    p_pipeline_version: pipelineVersion,
    p_dry_run: false,
  });

  if (error) throw new Error(`Bridge execution failed: ${error.message}`);
  return data as BridgeResult;
}

// ============================================================
// STANDALONE VALIDATION (no database required)
// ============================================================

export function validateRulesForBridge(rules: ExtractedRule[]): {
  valid: ExtractedRule[];
  rejected: Array<{ rule: ExtractedRule; reason: string }>;
} {
  const valid: ExtractedRule[] = [];
  const rejected: Array<{ rule: ExtractedRule; reason: string }> = [];

  for (const rule of rules) {
    // Gate 1: Must have source citation (hallucination guard)
    if (!rule.source_snippet || rule.source_snippet.length < 10) {
      rejected.push({ rule, reason: 'Missing or insufficient source citation' });
      continue;
    }

    // Gate 2: Must have recognized clause_type
    if (!CLAUSE_TO_FAMILY[rule.clause_type]) {
      rejected.push({ rule, reason: `Unknown clause_type: ${rule.clause_type}` });
      continue;
    }

    // Gate 3: Must have a value
    if (rule.normalized_value === null || rule.normalized_value === undefined) {
      rejected.push({ rule, reason: 'Missing normalized_value' });
      continue;
    }

    // Gate 4: Confidence must be HIGH for auto-accept
    if (rule.confidence !== 'HIGH') {
      rejected.push({ rule, reason: `Confidence ${rule.confidence} — will be PENDING_REVIEW` });
      // Still valid, just flagged — add to valid
      valid.push(rule);
      continue;
    }

    valid.push(rule);
  }

  return { valid, rejected };
}
