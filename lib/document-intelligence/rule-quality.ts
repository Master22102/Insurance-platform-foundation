import { ClauseType, PromotedRule } from './types';

export type RuleQualityClass = 'operational_value' | 'requirement';

export interface RuleQualityMetrics {
  totalRules: number;
  operationalValueRules: number;
  requirementRules: number;
  operationalValuePercentage: number;
  requirementPercentage: number;
  operationalByType: Record<string, number>;
  requirementByType: Record<string, number>;
}

const OPERATIONAL_VALUE_TYPES = new Set<ClauseType>([
  'trip_delay_threshold',
  'trip_delay_limit',
  'claim_deadline_days',
  'baggage_liability_limit',
  'carrier_liability_cap',
  'trip_cancellation_limit',
  'trip_interruption_limit',
  'hotel_cancellation_window',
  'refund_eligibility_rule',
  'medical_emergency_coverage_limit',
  'emergency_evacuation_limit',
  'dental_emergency_limit',
  'rental_car_damage_limit',
  'personal_accident_coverage_limit',
  'personal_effects_coverage_limit',
  'supplemental_liability_limit',
  'cruise_cancellation_window',
  'deposit_requirement',
  'final_payment_deadline',
  'baggage_delay_threshold',
  'medical_evacuation_cost_estimate',
  'repatriation_remains_limit',
  'missed_connection_threshold',
  'check_in_deadline',
]);

const REQUIREMENT_TYPES = new Set<ClauseType>([
  'requires_receipts',
  'requires_police_report',
  'requires_medical_certificate',
  'requires_carrier_delay_letter',
  'requires_baggage_pir',
  'requires_itinerary',
  'requires_payment_proof',
  'payment_method_requirement',
  'common_carrier_requirement',
  'round_trip_requirement',
]);

export function classifyRule(rule: PromotedRule): RuleQualityClass {
  if (OPERATIONAL_VALUE_TYPES.has(rule.clauseType)) {
    return 'operational_value';
  }
  if (REQUIREMENT_TYPES.has(rule.clauseType)) {
    return 'requirement';
  }

  // Default classification based on value type
  if (rule.value.type === 'currency' ||
      rule.value.type === 'sdr' ||
      rule.value.type === 'duration' ||
      rule.value.type === 'days') {
    return 'operational_value';
  }

  return 'requirement';
}

export function calculateQualityMetrics(rules: PromotedRule[]): RuleQualityMetrics {
  const operationalByType: Record<string, number> = {};
  const requirementByType: Record<string, number> = {};

  let operationalCount = 0;
  let requirementCount = 0;

  for (const rule of rules) {
    const classification = classifyRule(rule);

    if (classification === 'operational_value') {
      operationalCount++;
      operationalByType[rule.clauseType] = (operationalByType[rule.clauseType] || 0) + 1;
    } else {
      requirementCount++;
      requirementByType[rule.clauseType] = (requirementByType[rule.clauseType] || 0) + 1;
    }
  }

  const total = rules.length;

  return {
    totalRules: total,
    operationalValueRules: operationalCount,
    requirementRules: requirementCount,
    operationalValuePercentage: total > 0 ? Math.round((operationalCount / total) * 100) : 0,
    requirementPercentage: total > 0 ? Math.round((requirementCount / total) * 100) : 0,
    operationalByType,
    requirementByType,
  };
}

export function generateQualityReport(metrics: RuleQualityMetrics): string[] {
  const lines: string[] = [];

  lines.push('Rule Quality Distribution');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  lines.push('Overall:');
  lines.push(`  Total promoted rules: ${metrics.totalRules}`);
  lines.push(`  Operational value rules: ${metrics.operationalValueRules} (${metrics.operationalValuePercentage}%)`);
  lines.push(`  Requirement rules: ${metrics.requirementRules} (${metrics.requirementPercentage}%)`);
  lines.push('');

  lines.push('Operational Value Rules by Type:');
  const opSorted = Object.entries(metrics.operationalByType)
    .sort((a, b) => b[1] - a[1]);

  if (opSorted.length > 0) {
    opSorted.forEach(([type, count]) => {
      lines.push(`  • ${type}: ${count}`);
    });
  } else {
    lines.push('  (none)');
  }
  lines.push('');

  lines.push('Requirement Rules by Type:');
  const reqSorted = Object.entries(metrics.requirementByType)
    .sort((a, b) => b[1] - a[1]);

  if (reqSorted.length > 0) {
    reqSorted.forEach(([type, count]) => {
      lines.push(`  • ${type}: ${count}`);
    });
  } else {
    lines.push('  (none)');
  }
  lines.push('');

  return lines;
}
