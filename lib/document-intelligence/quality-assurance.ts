/**
 * Quality Assurance Layer
 *
 * Validates extracted rules to ensure values are reasonable and within expected ranges.
 * Flags suspicious or unusual values for manual review.
 */

import { PromotedRule, ClauseType, ExtractedValue } from './types';

export interface ValidationResult {
  valid: boolean;
  confidence: 'VERIFIED' | 'ACCEPTABLE' | 'SUSPICIOUS' | 'INVALID';
  warnings: string[];
  errors: string[];
  suggestions: string[];
}

export interface QualityMetrics {
  totalRules: number;
  verified: number;
  acceptable: number;
  suspicious: number;
  invalid: number;
  verificationRate: number;
}

/**
 * Validate a single promoted rule
 */
export function validateRule(rule: PromotedRule): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    confidence: 'VERIFIED',
    warnings: [],
    errors: [],
    suggestions: [],
  };

  // Skip validation for non-numeric rules
  if (rule.value.type === 'boolean' || rule.value.type === 'text' || rule.value.type === 'text_rule') {
    result.confidence = 'ACCEPTABLE';
    return result;
  }

  // Validate based on clause type
  switch (rule.clauseType) {
    case 'baggage_liability_limit':
      validateBaggageLiability(rule, result);
      break;
    case 'carrier_liability_cap':
      validateCarrierLiability(rule, result);
      break;
    case 'trip_delay_threshold':
      validateTripDelayThreshold(rule, result);
      break;
    case 'trip_delay_limit':
      validateTripDelayLimit(rule, result);
      break;
    case 'claim_deadline_days':
      validateClaimDeadline(rule, result);
      break;
    case 'hotel_cancellation_window':
      validateHotelCancellation(rule, result);
      break;
    case 'trip_cancellation_limit':
      validateTripCancellationLimit(rule, result);
      break;
    case 'trip_interruption_limit':
      validateTripInterruptionLimit(rule, result);
      break;
    case 'medical_emergency_coverage_limit':
      validateMedicalCoverage(rule, result);
      break;
    case 'emergency_evacuation_limit':
      validateEvacuationLimit(rule, result);
      break;
    case 'dental_emergency_limit':
      validateDentalLimit(rule, result);
      break;
    case 'rental_car_damage_limit':
      validateRentalCarDamage(rule, result);
      break;
    case 'personal_accident_coverage_limit':
      validatePersonalAccident(rule, result);
      break;
    case 'personal_effects_coverage_limit':
      validatePersonalEffects(rule, result);
      break;
    case 'supplemental_liability_limit':
      validateSupplementalLiability(rule, result);
      break;
    case 'cruise_cancellation_window':
      validateCruiseCancellation(rule, result);
      break;
    case 'deposit_requirement':
      validateDeposit(rule, result);
      break;
    case 'final_payment_deadline':
      validateFinalPayment(rule, result);
      break;
    case 'baggage_delay_threshold':
      validateBaggageDelayThreshold(rule, result);
      break;
    case 'repatriation_remains_limit':
      validateRepatriationLimit(rule, result);
      break;
    case 'missed_connection_threshold':
      validateMissedConnection(rule, result);
      break;
    case 'check_in_deadline':
      validateCheckInDeadline(rule, result);
      break;
    default:
      result.confidence = 'ACCEPTABLE';
      result.warnings.push(`No specific validation rules for clause type: ${rule.clauseType}`);
  }

  // Determine overall validity
  if (result.errors.length > 0) {
    result.valid = false;
    result.confidence = 'INVALID';
  } else if (result.warnings.length > 1) {
    result.confidence = 'SUSPICIOUS';
  } else if (result.warnings.length === 1) {
    result.confidence = 'ACCEPTABLE';
  }

  return result;
}

// Validation functions for specific clause types

function validateBaggageLiability(rule: PromotedRule, result: ValidationResult): void {
  const amount = getNumericValue(rule.value);
  if (amount === null) {
    result.errors.push('Could not extract numeric value');
    return;
  }

  if (amount < 50) {
    result.warnings.push(`Unusually low baggage liability: $${amount} (typical range: $500-$10,000)`);
  } else if (amount > 50000) {
    result.warnings.push(`Unusually high baggage liability: $${amount} (typical range: $500-$10,000)`);
  } else if (amount >= 500 && amount <= 10000) {
    result.confidence = 'VERIFIED';
  }
}

function validateCarrierLiability(rule: PromotedRule, result: ValidationResult): void {
  const amount = getNumericValue(rule.value);
  if (amount === null) {
    result.errors.push('Could not extract numeric value');
    return;
  }

  // Montreal Convention SDR limits are around 1,288 SDR (~$1,780) or 128,821 SDR (~$175,000)
  if (amount < 100) {
    result.warnings.push(`Unusually low carrier liability: $${amount}`);
  } else if (amount > 1000000) {
    result.warnings.push(`Unusually high carrier liability: $${amount} (check if correctly extracted)`);
  } else if ((amount >= 1500 && amount <= 2500) || (amount >= 150000 && amount <= 200000)) {
    result.confidence = 'VERIFIED';
  }
}

function validateTripDelayThreshold(rule: PromotedRule, result: ValidationResult): void {
  const hours = getDurationInHours(rule.value);
  if (hours === null) {
    result.errors.push('Could not extract duration value');
    return;
  }

  if (hours < 1) {
    result.errors.push(`Invalid trip delay threshold: ${hours} hours (must be >= 1 hour)`);
  } else if (hours > 72) {
    result.warnings.push(`Unusually long trip delay threshold: ${hours} hours (typical range: 3-24 hours)`);
  } else if (hours >= 3 && hours <= 24) {
    result.confidence = 'VERIFIED';
  }
}

function validateTripDelayLimit(rule: PromotedRule, result: ValidationResult): void {
  const amount = getNumericValue(rule.value);
  if (amount === null) {
    result.errors.push('Could not extract numeric value');
    return;
  }

  if (amount < 50) {
    result.warnings.push(`Unusually low trip delay limit: $${amount} (typical range: $200-$2,000)`);
  } else if (amount > 10000) {
    result.warnings.push(`Unusually high trip delay limit: $${amount} (typical range: $200-$2,000)`);
  } else if (amount >= 200 && amount <= 2000) {
    result.confidence = 'VERIFIED';
  }
}

function validateClaimDeadline(rule: PromotedRule, result: ValidationResult): void {
  const days = getDaysValue(rule.value);
  if (days === null) {
    result.errors.push('Could not extract days value');
    return;
  }

  if (days < 1) {
    result.errors.push(`Invalid claim deadline: ${days} days (must be >= 1 day)`);
  } else if (days > 730) {
    result.warnings.push(`Unusually long claim deadline: ${days} days (typical range: 7-180 days)`);
  } else if (days >= 7 && days <= 180) {
    result.confidence = 'VERIFIED';
  }
}

function validateHotelCancellation(rule: PromotedRule, result: ValidationResult): void {
  const hours = getDurationInHours(rule.value);
  if (hours === null) {
    result.errors.push('Could not extract duration value');
    return;
  }

  if (hours < 1) {
    result.errors.push(`Invalid hotel cancellation window: ${hours} hours`);
  } else if (hours > 720) { // 30 days
    result.warnings.push(`Unusually long cancellation window: ${hours} hours (typical range: 24-168 hours)`);
  } else if (hours >= 24 && hours <= 168) { // 24 hours to 7 days
    result.confidence = 'VERIFIED';
  }
}

function validateTripCancellationLimit(rule: PromotedRule, result: ValidationResult): void {
  const amount = getNumericValue(rule.value);
  if (amount === null) {
    result.errors.push('Could not extract numeric value');
    return;
  }

  if (amount < 100) {
    result.warnings.push(`Unusually low trip cancellation limit: $${amount} (typical range: $1,000-$100,000)`);
  } else if (amount > 500000) {
    result.warnings.push(`Unusually high trip cancellation limit: $${amount} (typical range: $1,000-$100,000)`);
  } else if (amount >= 1000 && amount <= 100000) {
    result.confidence = 'VERIFIED';
  }
}

function validateTripInterruptionLimit(rule: PromotedRule, result: ValidationResult): void {
  const amount = getNumericValue(rule.value);
  if (amount === null) {
    result.errors.push('Could not extract numeric value');
    return;
  }

  if (amount < 100) {
    result.warnings.push(`Unusually low trip interruption limit: $${amount}`);
  } else if (amount > 500000) {
    result.warnings.push(`Unusually high trip interruption limit: $${amount}`);
  } else if (amount >= 1000 && amount <= 150000) {
    result.confidence = 'VERIFIED';
  }
}

function validateMedicalCoverage(rule: PromotedRule, result: ValidationResult): void {
  const amount = getNumericValue(rule.value);
  if (amount === null) {
    result.errors.push('Could not extract numeric value');
    return;
  }

  if (amount < 1000) {
    result.warnings.push(`Unusually low medical coverage: $${amount} (typical range: $25,000-$250,000)`);
  } else if (amount > 1000000) {
    result.warnings.push(`Unusually high medical coverage: $${amount} (typical range: $25,000-$250,000)`);
  } else if (amount >= 25000 && amount <= 250000) {
    result.confidence = 'VERIFIED';
  }
}

function validateEvacuationLimit(rule: PromotedRule, result: ValidationResult): void {
  const amount = getNumericValue(rule.value);
  if (amount === null) {
    result.errors.push('Could not extract numeric value');
    return;
  }

  if (amount < 10000) {
    result.warnings.push(`Unusually low evacuation limit: $${amount} (typical range: $100,000-$1,000,000)`);
  } else if (amount > 2000000) {
    result.warnings.push(`Unusually high evacuation limit: $${amount} (typical range: $100,000-$1,000,000)`);
  } else if (amount >= 100000 && amount <= 1000000) {
    result.confidence = 'VERIFIED';
  }
}

function validateDentalLimit(rule: PromotedRule, result: ValidationResult): void {
  const amount = getNumericValue(rule.value);
  if (amount === null) {
    result.errors.push('Could not extract numeric value');
    return;
  }

  if (amount < 50) {
    result.warnings.push(`Unusually low dental limit: $${amount} (typical range: $300-$1,500)`);
  } else if (amount > 5000) {
    result.warnings.push(`Unusually high dental limit: $${amount} (typical range: $300-$1,500)`);
  } else if (amount >= 300 && amount <= 1500) {
    result.confidence = 'VERIFIED';
  }
}

function validateRentalCarDamage(rule: PromotedRule, result: ValidationResult): void {
  const amount = getNumericValue(rule.value);
  if (amount === null) {
    result.errors.push('Could not extract numeric value');
    return;
  }

  if (amount < 1000) {
    result.warnings.push(`Unusually low rental car damage limit: $${amount} (typical range: $25,000-$100,000)`);
  } else if (amount > 200000) {
    result.warnings.push(`Unusually high rental car damage limit: $${amount} (typical range: $25,000-$100,000)`);
  } else if (amount >= 25000 && amount <= 100000) {
    result.confidence = 'VERIFIED';
  }
}

function validatePersonalAccident(rule: PromotedRule, result: ValidationResult): void {
  const amount = getNumericValue(rule.value);
  if (amount === null) {
    result.errors.push('Could not extract numeric value');
    return;
  }

  if (amount < 1000) {
    result.warnings.push(`Unusually low personal accident coverage: $${amount} (typical range: $10,000-$500,000)`);
  } else if (amount > 1000000) {
    result.warnings.push(`Unusually high personal accident coverage: $${amount} (typical range: $10,000-$500,000)`);
  } else if (amount >= 10000 && amount <= 500000) {
    result.confidence = 'VERIFIED';
  }
}

function validatePersonalEffects(rule: PromotedRule, result: ValidationResult): void {
  const amount = getNumericValue(rule.value);
  if (amount === null) {
    result.errors.push('Could not extract numeric value');
    return;
  }

  if (amount < 100) {
    result.warnings.push(`Unusually low personal effects coverage: $${amount} (typical range: $500-$5,000)`);
  } else if (amount > 20000) {
    result.warnings.push(`Unusually high personal effects coverage: $${amount} (typical range: $500-$5,000)`);
  } else if (amount >= 500 && amount <= 5000) {
    result.confidence = 'VERIFIED';
  }
}

function validateSupplementalLiability(rule: PromotedRule, result: ValidationResult): void {
  const amount = getNumericValue(rule.value);
  if (amount === null) {
    result.errors.push('Could not extract numeric value');
    return;
  }

  if (amount < 10000) {
    result.warnings.push(`Unusually low supplemental liability: $${amount} (typical range: $300,000-$2,000,000)`);
  } else if (amount > 5000000) {
    result.warnings.push(`Unusually high supplemental liability: $${amount} (typical range: $300,000-$2,000,000)`);
  } else if (amount >= 300000 && amount <= 2000000) {
    result.confidence = 'VERIFIED';
  }
}

function validateCruiseCancellation(rule: PromotedRule, result: ValidationResult): void {
  const days = getDaysValue(rule.value);
  if (days === null) {
    result.errors.push('Could not extract days value');
    return;
  }

  if (days < 1) {
    result.errors.push(`Invalid cruise cancellation window: ${days} days`);
  } else if (days > 365) {
    result.warnings.push(`Unusually long cruise cancellation window: ${days} days (typical range: 15-180 days)`);
  } else if (days >= 15 && days <= 180) {
    result.confidence = 'VERIFIED';
  }
}

function validateDeposit(rule: PromotedRule, result: ValidationResult): void {
  const amount = getNumericValue(rule.value);
  if (amount === null) {
    result.errors.push('Could not extract numeric value');
    return;
  }

  if (amount < 10) {
    result.warnings.push(`Unusually low deposit: $${amount} (typical range: $100-$1,000)`);
  } else if (amount > 10000) {
    result.warnings.push(`Unusually high deposit: $${amount} (typical range: $100-$1,000)`);
  } else if (amount >= 100 && amount <= 1000) {
    result.confidence = 'VERIFIED';
  }
}

function validateFinalPayment(rule: PromotedRule, result: ValidationResult): void {
  const days = getDaysValue(rule.value);
  if (days === null) {
    result.errors.push('Could not extract days value');
    return;
  }

  if (days < 1) {
    result.errors.push(`Invalid final payment deadline: ${days} days`);
  } else if (days > 365) {
    result.warnings.push(`Unusually long final payment deadline: ${days} days (typical range: 30-120 days)`);
  } else if (days >= 30 && days <= 120) {
    result.confidence = 'VERIFIED';
  }
}

function validateBaggageDelayThreshold(rule: PromotedRule, result: ValidationResult): void {
  const hours = getDurationInHours(rule.value);
  if (hours === null) {
    result.errors.push('Could not extract duration value');
    return;
  }

  if (hours < 1) {
    result.errors.push(`Invalid baggage delay threshold: ${hours} hours`);
  } else if (hours > 48) {
    result.warnings.push(`Unusually long baggage delay threshold: ${hours} hours (typical range: 6-24 hours)`);
  } else if (hours >= 6 && hours <= 24) {
    result.confidence = 'VERIFIED';
  }
}

function validateRepatriationLimit(rule: PromotedRule, result: ValidationResult): void {
  const amount = getNumericValue(rule.value);
  if (amount === null) {
    result.errors.push('Could not extract numeric value');
    return;
  }

  if (amount < 1000) {
    result.warnings.push(`Unusually low repatriation limit: $${amount} (typical range: $10,000-$100,000)`);
  } else if (amount > 250000) {
    result.warnings.push(`Unusually high repatriation limit: $${amount} (typical range: $10,000-$100,000)`);
  } else if (amount >= 10000 && amount <= 100000) {
    result.confidence = 'VERIFIED';
  }
}

function validateMissedConnection(rule: PromotedRule, result: ValidationResult): void {
  const hours = getDurationInHours(rule.value);
  if (hours === null) {
    result.errors.push('Could not extract duration value');
    return;
  }

  if (hours < 1) {
    result.errors.push(`Invalid missed connection threshold: ${hours} hours`);
  } else if (hours > 12) {
    result.warnings.push(`Unusually long missed connection threshold: ${hours} hours (typical range: 2-6 hours)`);
  } else if (hours >= 2 && hours <= 6) {
    result.confidence = 'VERIFIED';
  }
}

function validateCheckInDeadline(rule: PromotedRule, result: ValidationResult): void {
  const minutes = getDurationInMinutes(rule.value);
  if (minutes === null) {
    result.errors.push('Could not extract duration value');
    return;
  }

  if (minutes < 5) {
    result.errors.push(`Invalid check-in deadline: ${minutes} minutes (too short)`);
  } else if (minutes > 480) { // 8 hours
    result.warnings.push(`Unusually long check-in deadline: ${minutes} minutes (typical range: 30-180 minutes)`);
  } else if (minutes >= 30 && minutes <= 180) {
    result.confidence = 'VERIFIED';
  }
}

// Helper functions to extract numeric values

function getNumericValue(value: ExtractedValue): number | null {
  if (value.type === 'currency' || value.type === 'sdr') {
    return typeof value.value === 'number' ? value.value : parseFloat(String(value.value));
  }
  return null;
}

function getDaysValue(value: ExtractedValue): number | null {
  if (value.type === 'days') {
    return typeof value.value === 'number' ? value.value : parseFloat(String(value.value));
  }
  // Handle duration type with days unit
  if (value.type === 'duration' && value.unit === 'days') {
    return typeof value.value === 'number' ? value.value : parseFloat(String(value.value));
  }
  return null;
}

function getDurationInHours(value: ExtractedValue): number | null {
  if (value.type === 'duration') {
    const num = typeof value.value === 'number' ? value.value : parseFloat(String(value.value));
    if (value.unit === 'minutes') {
      return num / 60;
    }
    if (value.unit === 'days') {
      return num * 24;
    }
    return num; // Assume hours
  }
  return null;
}

function getDurationInMinutes(value: ExtractedValue): number | null {
  if (value.type === 'duration') {
    const num = typeof value.value === 'number' ? value.value : parseFloat(String(value.value));
    if (value.unit === 'hours') {
      return num * 60;
    }
    return num; // Assume minutes
  }
  return null;
}

/**
 * Validate all promoted rules and return aggregate metrics
 */
export function validateAllRules(rules: PromotedRule[]): { results: Map<PromotedRule, ValidationResult>; metrics: QualityMetrics } {
  const results = new Map<PromotedRule, ValidationResult>();

  let verified = 0;
  let acceptable = 0;
  let suspicious = 0;
  let invalid = 0;

  for (const rule of rules) {
    const result = validateRule(rule);
    results.set(rule, result);

    switch (result.confidence) {
      case 'VERIFIED':
        verified++;
        break;
      case 'ACCEPTABLE':
        acceptable++;
        break;
      case 'SUSPICIOUS':
        suspicious++;
        break;
      case 'INVALID':
        invalid++;
        break;
    }
  }

  const total = rules.length;
  const metrics: QualityMetrics = {
    totalRules: total,
    verified,
    acceptable,
    suspicious,
    invalid,
    verificationRate: total > 0 ? Math.round(((verified + acceptable) / total) * 100) : 0,
  };

  return { results, metrics };
}

/**
 * Generate a quality assurance report
 */
export function generateQAReport(metrics: QualityMetrics, results: Map<PromotedRule, ValidationResult>): string[] {
  const lines: string[] = [];

  lines.push('Quality Assurance Report');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('Overall Quality Metrics:');
  lines.push(`  Total rules validated: ${metrics.totalRules}`);
  lines.push(`  ✓ Verified: ${metrics.verified} (${Math.round((metrics.verified / metrics.totalRules) * 100)}%)`);
  lines.push(`  ✓ Acceptable: ${metrics.acceptable} (${Math.round((metrics.acceptable / metrics.totalRules) * 100)}%)`);
  lines.push(`  ⚠ Suspicious: ${metrics.suspicious} (${Math.round((metrics.suspicious / metrics.totalRules) * 100)}%)`);
  lines.push(`  ✗ Invalid: ${metrics.invalid} (${Math.round((metrics.invalid / metrics.totalRules) * 100)}%)`);
  lines.push(`  Verification rate: ${metrics.verificationRate}%`);
  lines.push('');

  // List suspicious and invalid rules
  if (metrics.suspicious > 0 || metrics.invalid > 0) {
    lines.push('Rules Requiring Review:');
    lines.push('');

    Array.from(results.entries()).forEach(([rule, result]) => {
      if (result.confidence === 'SUSPICIOUS' || result.confidence === 'INVALID') {
        lines.push(`[${result.confidence}] ${rule.clauseType}: ${rule.value.raw}`);
        if (result.warnings.length > 0) {
          result.warnings.forEach(w => lines.push(`  ⚠ ${w}`));
        }
        if (result.errors.length > 0) {
          result.errors.forEach(e => lines.push(`  ✗ ${e}`));
        }
        lines.push('');
      }
    });
  }

  return lines;
}
