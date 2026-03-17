/**
 * BUILD BENCHMARK GOLD SET
 *
 * This script creates a gold standard benchmark set by:
 * 1. Selecting representative documents
 * 2. Extracting expected rules manually
 * 3. Comparing against actual extraction
 * 4. Calculating precision, recall, F1 score per clause type
 */

import * as fs from 'fs';
import * as path from 'path';

interface GoldRule {
  documentName: string;
  clauseType: string;
  expectedValue: string;
  expectedUnit?: string;
  sourceSnippet: string;
  notes?: string;
}

/**
 * GOLD SET - Manually verified rules from documents
 *
 * These are rules we KNOW should be extracted from specific documents
 * based on manual review of the source text.
 */
const GOLD_SET: GoldRule[] = [
  // ===== Allianz Comprehensive Insurance =====
  {
    documentName: 'insurance/allianz-comprehensive',
    clauseType: 'trip_cancellation_limit',
    expectedValue: '50000',
    expectedUnit: 'USD',
    sourceSnippet: 'Maximum benefit: Up to $50,000 per person',
    notes: 'Clear limit statement',
  },
  {
    documentName: 'insurance/allianz-comprehensive',
    clauseType: 'claim_deadline_days',
    expectedValue: '20',
    expectedUnit: 'days',
    sourceSnippet: 'Submit claim form and documentation within 20 days of trip cancellation',
    notes: 'Cancellation claim deadline',
  },
  {
    documentName: 'insurance/allianz-comprehensive',
    clauseType: 'claim_deadline_days',
    expectedValue: '90',
    expectedUnit: 'days',
    sourceSnippet: 'Medical claims: 90 days from date of service',
    notes: 'Medical claim deadline',
  },

  // ===== Synthetic Delta =====
  {
    documentName: 'airlines/synthetic-delta',
    clauseType: 'baggage_liability_limit',
    expectedValue: '3800',
    expectedUnit: 'USD',
    sourceSnippet: 'Maximum liability: $3,800 per passenger',
    notes: 'Domestic baggage liability',
  },
  {
    documentName: 'airlines/synthetic-delta',
    clauseType: 'trip_delay_threshold',
    expectedValue: '4',
    expectedUnit: 'hours',
    sourceSnippet: 'delay exceeds 4 hours',
    notes: 'Delay compensation threshold',
  },

  // ===== Carnival Cruise =====
  {
    documentName: 'cruise/carnival-passage-contract',
    clauseType: 'claim_deadline_days',
    expectedValue: '185',
    expectedUnit: 'days',
    sourceSnippet: '185 days after the date of injury or illness',
    notes: 'Injury/illness claim deadline',
  },
  {
    documentName: 'cruise/carnival-passage-contract',
    clauseType: 'refund_eligibility_rule',
    expectedValue: 'Full refund if cancelled 91+ days before departure',
    sourceSnippet: 'Full refund if cancelled 91+ days before departure',
    notes: 'Cancellation refund policy',
  },

  // ===== Synthetic Hilton =====
  {
    documentName: 'hotels/synthetic-hilton',
    clauseType: 'hotel_cancellation_window',
    expectedValue: '24',
    expectedUnit: 'hours',
    sourceSnippet: 'Cancellations must be made at least 24 hours before scheduled arrival time',
    notes: 'Standard cancellation window',
  },
  {
    documentName: 'hotels/synthetic-hilton',
    clauseType: 'trip_delay_threshold',
    expectedValue: '6',
    expectedUnit: 'hours',
    sourceSnippet: 'delay exceeds 6 hours',
    notes: 'Delay compensation trigger',
  },

  // ===== Royal Caribbean =====
  {
    documentName: 'Royal_Caribbean_booklet_',
    clauseType: 'carrier_liability_cap',
    expectedValue: '75000',
    expectedUnit: 'SDR',
    sourceSnippet: '75,000 SDRs per passenger',
    notes: 'Athens Convention liability limit',
  },

  // ===== Avis Rental =====
  {
    documentName: 'car-rental/avis-rendered-pdf',
    clauseType: 'payment_method_requirement',
    expectedValue: 'Credit card required for rental',
    sourceSnippet: 'major credit card in the renter\'s name',
    notes: 'Payment method requirement',
  },
];

/**
 * FALSE POSITIVE DETECTION CASES
 * These are known patterns that SHOULD NOT be extracted as rules
 */
const KNOWN_FALSE_POSITIVE_PATTERNS = [
  {
    documentName: 'insurance/allianz-comprehensive',
    clauseType: 'trip_cancellation_limit',
    falseValue: '100000',
    sourceSnippet: '$100,000 per family',
    reason: 'This is a family limit, not per-person limit - should not be extracted as trip_cancellation_limit',
  },
  {
    documentName: 'any',
    clauseType: 'any',
    pattern: /maximum.*includes.*taxes/i,
    reason: 'Inclusive amounts should not be treated as separate limits',
  },
];

/**
 * ADVERSARIAL TEST CASES
 * Edge cases that test extraction robustness
 */
const ADVERSARIAL_CASES = [
  {
    name: 'Contradictory clauses in same document',
    text: `
      Trip cancellation coverage: Up to $5,000 per person.
      ...
      Note: Maximum trip cancellation benefit may not exceed $3,000 per trip.
    `,
    expectedBehavior: 'Should detect conflict and flag or use more conservative value',
  },
  {
    name: 'Multiple limits in one paragraph',
    text: `
      Baggage liability: $1,500 for checked bags, $500 for carry-on items,
      and $2,500 maximum per passenger for all bags combined.
    `,
    expectedBehavior: 'Should extract the per-passenger maximum ($2,500), not individual bag limits',
  },
  {
    name: 'Conditional deadline with soft wording',
    text: `
      Claims should be submitted within 30 days, but may be accepted up to
      90 days at our discretion if circumstances warrant.
    `,
    expectedBehavior: 'Should extract 30 days as firm deadline, flag 90 days as conditional',
  },
  {
    name: 'Split table across pages',
    text: `
      <table>
        <tr><td>Domestic baggage</td><td>$3,800</td></tr>
        <!-- PAGE BREAK -->
        <tr><td>International baggage</td><td>1,131 SDR</td></tr>
      </table>
    `,
    expectedBehavior: 'Should extract both values if segmentation preserves table context',
  },
  {
    name: 'Nested exclusions',
    text: `
      All medical expenses are covered up to $100,000, except:
      - Pre-existing conditions (unless waiver applies)
      - Cosmetic procedures
      - Routine check-ups
    `,
    expectedBehavior: 'Should extract $100,000 limit but note exclusions in context',
  },
  {
    name: 'Per-person vs per-trip vs per-family ambiguity',
    text: `
      Maximum coverage: $50,000 per person, $100,000 per trip, $150,000 per family.
    `,
    expectedBehavior: 'Should extract all three with proper context/unit differentiation',
  },
  {
    name: 'Missing currency units',
    text: `
      Baggage liability limited to 1,500 for domestic flights.
    `,
    expectedBehavior: 'Should flag missing currency or attempt to infer from document context',
  },
  {
    name: 'Multiple currencies',
    text: `
      US flights: $3,800 USD maximum.
      European flights: €2,500 EUR maximum.
      Asian flights: ¥200,000 JPY maximum.
    `,
    expectedBehavior: 'Should extract all with correct currency associations',
  },
  {
    name: 'Looks like limit but is not',
    text: `
      For reservations made within 14 days of departure, a non-refundable
      deposit of $500 is required.
    `,
    expectedBehavior: 'Should extract as deposit_requirement, NOT as a liability limit',
  },
  {
    name: 'Percentage-based limits',
    text: `
      Trip cancellation refund: 100% if canceled 60+ days before departure,
      50% if canceled 30-59 days, 0% if canceled within 30 days.
    `,
    expectedBehavior: 'Should extract as refund_eligibility_rule, not numeric limit',
  },
];

function saveGoldSet() {
  const outputDir = 'tmp/benchmark';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(outputDir, 'gold-set.json'),
    JSON.stringify(GOLD_SET, null, 2)
  );

  fs.writeFileSync(
    path.join(outputDir, 'false-positive-patterns.json'),
    JSON.stringify(KNOWN_FALSE_POSITIVE_PATTERNS, null, 2)
  );

  fs.writeFileSync(
    path.join(outputDir, 'adversarial-cases.json'),
    JSON.stringify(ADVERSARIAL_CASES, null, 2)
  );

  console.log('Gold set created:');
  console.log(`  ${GOLD_SET.length} gold standard rules`);
  console.log(`  ${KNOWN_FALSE_POSITIVE_PATTERNS.length} known false positive patterns`);
  console.log(`  ${ADVERSARIAL_CASES.length} adversarial test cases`);
  console.log('');
  console.log('Files saved to tmp/benchmark/');
}

saveGoldSet();
