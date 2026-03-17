import { processDocument } from '../lib/document-intelligence/index';

async function analyzeTargetRules() {
  const docs = [
    { path: 'document-intelligence/Royal_Caribbean_booklet_.pdf', name: 'Royal Caribbean' },
    { path: 'document-intelligence/General_Conditions_of_Carriage_for_Passengers_and_Baggage_(flight_ticket_GCC).pdf', name: 'Flight GCC' },
  ];

  const targetTypes = [
    'trip_delay_threshold',
    'trip_delay_limit',
    'baggage_liability_limit',
    'carrier_liability_cap',
    'hotel_cancellation_window',
    'claim_deadline_days'
  ];

  for (const doc of docs) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Document: ${doc.name}`);
    console.log('='.repeat(70));

    const result = await processDocument(doc.path, doc.name);

    for (const type of targetTypes) {
      const allCandidates = result.candidates.filter(c => c.clauseType === type);
      const promoted = result.promotedRules.filter(r => r.clauseType === type);

      if (allCandidates.length > 0) {
        console.log(`\n${type}:`);
        console.log(`  Total candidates: ${allCandidates.length}`);
        console.log(`  Promoted: ${promoted.length}`);
        console.log(`  Not promoted: ${allCandidates.length - promoted.length}`);

        // Show not promoted candidates
        const notPromoted = allCandidates.filter(c => c.confidence !== 'HIGH');
        if (notPromoted.length > 0) {
          console.log(`  Candidates not promoted:`);
          notPromoted.slice(0, 2).forEach((c, i) => {
            console.log(`    [${i + 1}] Confidence: ${c.confidence}`);
            console.log(`        Value: ${JSON.stringify(c.value)}`);
            console.log(`        Snippet: ${c.sourceSnippet.substring(0, 80)}...`);
            if (c.ambiguityFlags.length > 0) {
              console.log(`        Ambiguity flags: ${c.ambiguityFlags.join(', ')}`);
            }
            if (c.conflictFlags.length > 0) {
              console.log(`        Conflict flags: ${c.conflictFlags.join(', ')}`);
            }
          });
        }

        // Show promoted candidates
        if (promoted.length > 0) {
          console.log(`  Promoted rules:`);
          promoted.slice(0, 2).forEach((r, i) => {
            console.log(`    [${i + 1}] Value: ${JSON.stringify(r.value)}`);
            console.log(`        Snippet: ${r.sourceSnippet.substring(0, 80)}...`);
          });
        }
      }
    }
  }
}

analyzeTargetRules().catch(console.error);
