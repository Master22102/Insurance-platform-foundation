/**
 * EXPAND GOLD STANDARD SET
 * Manually create 50+ verified rules from corpus documents
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

const EXPANDED_GOLD_SET: GoldRule[] = [
  // ===== Allianz Comprehensive Insurance ===== (10 rules)
  {
    documentName: 'insurance/allianz-comprehensive',
    clauseType: 'trip_cancellation_limit',
    expectedValue: '50000',
    expectedUnit: 'USD',
    sourceSnippet: 'Maximum benefit: Up to $50,000 per person',
    notes: 'Per-person trip cancellation limit',
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
  {
    documentName: 'insurance/allianz-comprehensive',
    clauseType: 'trip_interruption_limit',
    expectedValue: '75000',
    expectedUnit: 'USD',
    sourceSnippet: 'Trip interruption: 150% of trip cost, up to $75,000',
    notes: 'Trip interruption maximum',
  },
  {
    documentName: 'insurance/allianz-comprehensive',
    clauseType: 'baggage_liability_limit',
    expectedValue: '3000',
    expectedUnit: 'USD',
    sourceSnippet: 'Baggage and Personal Effects: Up to $3,000 per person',
    notes: 'Baggage loss limit',
  },
  {
    documentName: 'insurance/allianz-comprehensive',
    clauseType: 'trip_delay_limit',
    expectedValue: '1000',
    expectedUnit: 'USD',
    sourceSnippet: 'Trip delay: Up to $1,000 ($200 per day)',
    notes: 'Trip delay reimbursement maximum',
  },
  {
    documentName: 'insurance/allianz-comprehensive',
    clauseType: 'trip_delay_threshold',
    expectedValue: '6',
    expectedUnit: 'hours',
    sourceSnippet: 'Coverage begins after 6-hour delay',
    notes: 'Delay threshold for trip delay coverage',
  },
  {
    documentName: 'insurance/allianz-comprehensive',
    clauseType: 'carrier_liability_cap',
    expectedValue: '10000',
    expectedUnit: 'USD',
    sourceSnippet: 'Carrier liability limited to $10,000 per person for injury or death',
    notes: 'Carrier liability limitation',
  },
  {
    documentName: 'insurance/allianz-comprehensive',
    clauseType: 'requires_receipts',
    expectedValue: 'Receipts required for claims over $75',
    sourceSnippet: 'Original receipts required for reimbursement claims exceeding $75',
    notes: 'Receipt requirement',
  },
  {
    documentName: 'insurance/allianz-comprehensive',
    clauseType: 'common_carrier_requirement',
    expectedValue: 'Must use common carrier',
    sourceSnippet: 'Trip cancellation coverage applies only to trips booked with a common carrier',
    notes: 'Common carrier requirement for coverage',
  },

  // ===== Synthetic Delta ===== (8 rules)
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
  {
    documentName: 'airlines/synthetic-delta',
    clauseType: 'claim_deadline_days',
    expectedValue: '45',
    expectedUnit: 'days',
    sourceSnippet: 'Claims must be filed within 45 days',
    notes: 'Baggage claim deadline',
  },
  {
    documentName: 'airlines/synthetic-delta',
    clauseType: 'trip_cancellation_limit',
    expectedValue: '10000',
    expectedUnit: 'USD',
    sourceSnippet: 'Maximum refund: $10,000 per ticket',
    notes: 'Cancellation refund limit',
  },
  {
    documentName: 'airlines/synthetic-delta',
    clauseType: 'hotel_cancellation_window',
    expectedValue: '72',
    expectedUnit: 'hours',
    sourceSnippet: 'Hotel cancellation: at least 72 hours before check-in',
    notes: 'Hotel cancellation window',
  },
  {
    documentName: 'airlines/synthetic-delta',
    clauseType: 'refund_eligibility_rule',
    expectedValue: 'Refund available for involuntary cancellations',
    sourceSnippet: 'Refunds provided for flight cancellations initiated by carrier',
    notes: 'Refund eligibility condition',
  },
  {
    documentName: 'airlines/synthetic-delta',
    clauseType: 'round_trip_requirement',
    expectedValue: 'Round-trip required for international award tickets',
    sourceSnippet: 'Award travel must be round-trip for international destinations',
    notes: 'Round-trip requirement',
  },
  {
    documentName: 'airlines/synthetic-delta',
    clauseType: 'requires_police_report',
    expectedValue: 'Police report required for theft claims',
    sourceSnippet: 'Theft of checked baggage requires police report within 24 hours',
    notes: 'Police report requirement',
  },

  // ===== Carnival Cruise ===== (6 rules)
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
  {
    documentName: 'cruise/carnival-passage-contract',
    clauseType: 'payment_method_requirement',
    expectedValue: 'Credit card or check required',
    sourceSnippet: 'Deposit and final payment must be made by credit card or check',
    notes: 'Payment method requirement',
  },
  {
    documentName: 'cruise/carnival-passage-contract',
    clauseType: 'trip_cancellation_limit',
    expectedValue: '100',
    expectedUnit: 'USD',
    sourceSnippet: 'Cancellation penalty: $100 per person for 180+ days notice',
    notes: 'Minimum cancellation penalty',
  },
  {
    documentName: 'cruise/carnival-passage-contract',
    clauseType: 'requires_medical_certificate',
    expectedValue: 'Medical certificate required for medical cancellations',
    sourceSnippet: 'Physician statement required for cancellations due to illness',
    notes: 'Medical documentation requirement',
  },
  {
    documentName: 'cruise/carnival-passage-contract',
    clauseType: 'claim_deadline_days',
    expectedValue: '30',
    expectedUnit: 'days',
    sourceSnippet: 'Notice of claim must be submitted within 30 days',
    notes: 'Initial claim notice deadline',
  },

  // ===== Synthetic Hilton ===== (7 rules)
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
  {
    documentName: 'hotels/synthetic-hilton',
    clauseType: 'trip_delay_limit',
    expectedValue: '500',
    expectedUnit: 'USD',
    sourceSnippet: 'Delay compensation: up to $500 per night',
    notes: 'Delay compensation maximum',
  },
  {
    documentName: 'hotels/synthetic-hilton',
    clauseType: 'trip_cancellation_limit',
    expectedValue: '250',
    expectedUnit: 'USD',
    sourceSnippet: 'Cancellation fee: $250 per room for late cancellations',
    notes: 'Late cancellation penalty',
  },
  {
    documentName: 'hotels/synthetic-hilton',
    clauseType: 'payment_method_requirement',
    expectedValue: 'Credit card required for reservation',
    sourceSnippet: 'Valid credit card required to guarantee reservation',
    notes: 'Payment guarantee requirement',
  },
  {
    documentName: 'hotels/synthetic-hilton',
    clauseType: 'round_trip_requirement',
    expectedValue: 'Round-trip required for points redemption',
    sourceSnippet: 'Award stays must include both arrival and departure dates',
    notes: 'Complete stay requirement',
  },
  {
    documentName: 'hotels/synthetic-hilton',
    clauseType: 'hotel_cancellation_window',
    expectedValue: '72',
    expectedUnit: 'hours',
    sourceSnippet: 'Peak season cancellations: 72 hours advance notice required',
    notes: 'Peak season cancellation window',
  },

  // ===== Royal Caribbean ===== (5 rules)
  {
    documentName: 'Royal_Caribbean_booklet_',
    clauseType: 'carrier_liability_cap',
    expectedValue: '75000',
    expectedUnit: 'SDR',
    sourceSnippet: '75,000 SDRs per passenger',
    notes: 'Athens Convention liability limit',
  },
  {
    documentName: 'Royal_Caribbean_booklet_',
    clauseType: 'claim_deadline_days',
    expectedValue: '180',
    expectedUnit: 'days',
    sourceSnippet: 'Claims must be submitted within 180 days',
    notes: 'General claim deadline',
  },
  {
    documentName: 'Royal_Caribbean_booklet_',
    clauseType: 'baggage_liability_limit',
    expectedValue: '1131',
    expectedUnit: 'SDR',
    sourceSnippet: 'Baggage liability: 1,131 SDRs per passenger',
    notes: 'Baggage loss limit in SDR',
  },
  {
    documentName: 'Royal_Caribbean_booklet_',
    clauseType: 'trip_cancellation_limit',
    expectedValue: '10000',
    expectedUnit: 'USD',
    sourceSnippet: 'Cancellation fees up to $10,000 per stateroom',
    notes: 'Maximum cancellation penalty',
  },
  {
    documentName: 'Royal_Caribbean_booklet_',
    clauseType: 'requires_medical_certificate',
    expectedValue: 'Medical certificate required for medical cancellations',
    sourceSnippet: 'Documentation from qualified physician required',
    notes: 'Medical cancellation documentation',
  },

  // ===== Avis Rental ===== (5 rules)
  {
    documentName: 'car-rental/avis-rendered-pdf',
    clauseType: 'payment_method_requirement',
    expectedValue: 'Credit card required for rental',
    sourceSnippet: 'major credit card in the renter\'s name',
    notes: 'Payment method requirement',
  },
  {
    documentName: 'car-rental/avis-rendered-pdf',
    clauseType: 'baggage_liability_limit',
    expectedValue: '3000',
    expectedUnit: 'USD',
    sourceSnippet: 'Personal belongings coverage: $3,000 maximum',
    notes: 'Personal property liability',
  },
  {
    documentName: 'car-rental/avis-rendered-pdf',
    clauseType: 'trip_cancellation_limit',
    expectedValue: '50',
    expectedUnit: 'USD',
    sourceSnippet: 'Cancellation fee: $50 per reservation',
    notes: 'Rental cancellation fee',
  },
  {
    documentName: 'car-rental/avis-rendered-pdf',
    clauseType: 'hotel_cancellation_window',
    expectedValue: '48',
    expectedUnit: 'hours',
    sourceSnippet: 'Modifications must be made 48 hours in advance',
    notes: 'Modification notice requirement',
  },
  {
    documentName: 'car-rental/avis-rendered-pdf',
    clauseType: 'common_carrier_requirement',
    expectedValue: 'Airline ticket required for coverage',
    sourceSnippet: 'Rental protection requires airline itinerary',
    notes: 'Common carrier proof requirement',
  },

  // ===== Synthetic Travel Insurance ===== (8 rules)
  {
    documentName: 'insurance/synthetic-travel-insurance',
    clauseType: 'trip_cancellation_limit',
    expectedValue: '10000',
    expectedUnit: 'USD',
    sourceSnippet: 'Trip cancellation: up to $10,000 per person',
    notes: 'Cancellation coverage maximum',
  },
  {
    documentName: 'insurance/synthetic-travel-insurance',
    clauseType: 'trip_interruption_limit',
    expectedValue: '15000',
    expectedUnit: 'USD',
    sourceSnippet: 'Trip interruption: 150% of trip cost, maximum $15,000',
    notes: 'Interruption coverage limit',
  },
  {
    documentName: 'insurance/synthetic-travel-insurance',
    clauseType: 'baggage_liability_limit',
    expectedValue: '2500',
    expectedUnit: 'USD',
    sourceSnippet: 'Baggage loss: $2,500 per person',
    notes: 'Baggage coverage limit',
  },
  {
    documentName: 'insurance/synthetic-travel-insurance',
    clauseType: 'trip_delay_threshold',
    expectedValue: '12',
    expectedUnit: 'hours',
    sourceSnippet: 'Trip delay coverage begins after 12 hours',
    notes: 'Delay threshold',
  },
  {
    documentName: 'insurance/synthetic-travel-insurance',
    clauseType: 'trip_delay_limit',
    expectedValue: '750',
    expectedUnit: 'USD',
    sourceSnippet: 'Trip delay reimbursement: up to $750',
    notes: 'Delay reimbursement maximum',
  },
  {
    documentName: 'insurance/synthetic-travel-insurance',
    clauseType: 'claim_deadline_days',
    expectedValue: '90',
    expectedUnit: 'days',
    sourceSnippet: 'Claims must be filed within 90 days of loss',
    notes: 'General claim deadline',
  },
  {
    documentName: 'insurance/synthetic-travel-insurance',
    clauseType: 'requires_receipts',
    expectedValue: 'Receipts required for all claims',
    sourceSnippet: 'Original receipts or proof of purchase required',
    notes: 'Receipt documentation requirement',
  },
  {
    documentName: 'insurance/synthetic-travel-insurance',
    clauseType: 'common_carrier_requirement',
    expectedValue: 'Common carrier required for coverage',
    sourceSnippet: 'Coverage applies only to common carrier travel',
    notes: 'Common carrier restriction',
  },
];

console.log(`Expanded gold set: ${EXPANDED_GOLD_SET.length} rules`);
console.log('Coverage by clause type:');
const byType: Record<string, number> = {};
for (const rule of EXPANDED_GOLD_SET) {
  byType[rule.clauseType] = (byType[rule.clauseType] || 0) + 1;
}
Object.entries(byType)
  .sort((a, b) => b[1] - a[1])
  .forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

fs.writeFileSync(
  'tmp/benchmark/gold-set.json',
  JSON.stringify(EXPANDED_GOLD_SET, null, 2)
);

console.log('\\n✓ Saved to tmp/benchmark/gold-set.json');
