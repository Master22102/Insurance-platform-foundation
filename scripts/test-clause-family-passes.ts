import fs from 'fs';
import path from 'path';
import { processDocument } from '../lib/document-intelligence';

const BASELINE_TARGETS = [
  {
    name: 'Flight GCC (Airline)',
    path: 'document-intelligence/General_Conditions_of_Carriage_for_Passengers_and_Baggage_(flight_ticket_GCC).pdf',
    type: 'airline',
  },
  {
    name: 'Europcar (Rental)',
    path: 'tmp/web-capture/europcar-terms-and-conditions/normalized.html',
    type: 'rental',
  },
  {
    name: 'Royal Caribbean (Cruise/Hotel)',
    path: 'document-intelligence/Royal_Caribbean_booklet_.pdf',
    type: 'hotel',
  },
];

interface TestResult {
  name: string;
  type: string;
  success: boolean;
  sections: number;
  candidates: number;
  promoted: number;
  candidatesByType: Record<string, number>;
  promotedByType: Record<string, number>;
  candidatesByPass?: Record<string, number>;
  consolidation?: {
    beforeCount: number;
    afterCount: number;
    reductionCount: number;
    reductionPercent: number;
    conflictsDetected: number;
  };
  normalization?: {
    beforeCount: number;
    afterCount: number;
    normalizedCount: number;
    normalizationRate: number;
  };
  error?: string;
}

async function main() {
  console.log('================================================================================');
  console.log('Clause Family Pass Test Harness');
  console.log('================================================================================\n');

  const results: TestResult[] = [];

  for (const target of BASELINE_TARGETS) {
    console.log(`Processing: ${target.name}`);
    console.log(`  Path: ${target.path}`);
    console.log(`  Type: ${target.type}`);

    try {
      const fullPath = path.join(process.cwd(), target.path);

      if (!fs.existsSync(fullPath)) {
        console.log(`  ✗ File not found\n`);
        results.push({
          name: target.name,
          type: target.type,
          success: false,
          sections: 0,
          candidates: 0,
          promoted: 0,
          candidatesByType: {},
          promotedByType: {},
          error: 'File not found',
        });
        continue;
      }

      const fileName = path.basename(fullPath);
      const result = await processDocument(fullPath, fileName);

      const candidatesByType: Record<string, number> = {};
      for (const candidate of result.candidates) {
        candidatesByType[candidate.clauseType] = (candidatesByType[candidate.clauseType] || 0) + 1;
      }

      const promotedByType: Record<string, number> = {};
      for (const rule of result.promotedRules) {
        promotedByType[rule.clauseType] = (promotedByType[rule.clauseType] || 0) + 1;
      }

      const candidatesByPass: Record<string, number> = {};
      for (const candidate of result.candidates) {
        const pass = (candidate as any).detectedByPass || 'legacy';
        candidatesByPass[pass] = (candidatesByPass[pass] || 0) + 1;
      }

      console.log(`  ✓ Parsed successfully`);
      console.log(`  Sections: ${result.sections.length}`);

      if (result.consolidationMetrics) {
        console.log(`  Consolidation:`);
        console.log(`    Before: ${result.consolidationMetrics.beforeCount} candidates`);
        console.log(`    After: ${result.consolidationMetrics.afterCount} candidates`);
        console.log(`    Reduced: ${result.consolidationMetrics.reductionCount} (-${result.consolidationMetrics.reductionPercent}%)`);
        console.log(`    Conflicts: ${result.consolidationMetrics.conflictsDetected}`);
      }

      if (result.normalizationMetrics) {
        console.log(`  Normalization:`);
        console.log(`    Total: ${result.normalizationMetrics.beforeCount} candidates`);
        console.log(`    Normalized: ${result.normalizationMetrics.normalizedCount} (${result.normalizationMetrics.normalizationRate}%)`);
      }

      console.log(`  Candidates: ${result.candidates.length}`);
      console.log(`  Promoted: ${result.promotedRules.length}`);

      if (Object.keys(candidatesByType).length > 0) {
        console.log(`  Candidates by type:`);
        for (const [type, count] of Object.entries(candidatesByType).sort((a, b) => b[1] - a[1])) {
          console.log(`    - ${type}: ${count}`);
        }
      }

      if (Object.keys(candidatesByPass).length > 0) {
        console.log(`  Candidates by pass:`);
        for (const [pass, count] of Object.entries(candidatesByPass).sort((a, b) => b[1] - a[1])) {
          console.log(`    - ${pass}: ${count}`);
        }
      }

      console.log('');

      results.push({
        name: target.name,
        type: target.type,
        success: true,
        sections: result.sections.length,
        candidates: result.candidates.length,
        promoted: result.promotedRules.length,
        candidatesByType,
        promotedByType,
        candidatesByPass,
        consolidation: result.consolidationMetrics,
        normalization: result.normalizationMetrics,
      });
    } catch (error: any) {
      console.log(`  ✗ Error: ${error.message}\n`);
      results.push({
        name: target.name,
        type: target.type,
        success: false,
        sections: 0,
        candidates: 0,
        promoted: 0,
        candidatesByType: {},
        promotedByType: {},
        error: error.message,
      });
    }
  }

  console.log('================================================================================');
  console.log('Summary');
  console.log('================================================================================\n');

  const totalCandidates = results.reduce((sum, r) => sum + r.candidates, 0);
  const totalPromoted = results.reduce((sum, r) => sum + r.promoted, 0);
  const totalBeforeConsolidation = results.reduce((sum, r) => sum + (r.consolidation?.beforeCount || r.candidates), 0);
  const totalReduced = results.reduce((sum, r) => sum + (r.consolidation?.reductionCount || 0), 0);
  const totalConflicts = results.reduce((sum, r) => sum + (r.consolidation?.conflictsDetected || 0), 0);
  const totalNormalized = results.reduce((sum, r) => sum + (r.normalization?.normalizedCount || 0), 0);
  const totalNormalizationTargets = results.reduce((sum, r) => sum + (r.normalization?.beforeCount || 0), 0);

  console.log(`Before Consolidation: ${totalBeforeConsolidation} candidates`);
  console.log(`After Consolidation: ${totalCandidates} candidates`);
  console.log(`Reduced: ${totalReduced} candidates (-${totalBeforeConsolidation > 0 ? Math.round((totalReduced / totalBeforeConsolidation) * 100) : 0}%)`);
  console.log(`Conflicts Detected: ${totalConflicts}`);
  console.log(``);
  console.log(`Normalization: ${totalNormalized} of ${totalNormalizationTargets} candidates normalized (${totalNormalizationTargets > 0 ? Math.round((totalNormalized / totalNormalizationTargets) * 100) : 0}%)`);
  console.log(``);
  console.log(`Total Promoted: ${totalPromoted}`);
  console.log('');

  for (const result of results) {
    console.log(`${result.name}: ${result.success ? '✓' : '✗'} ${result.candidates} candidates, ${result.promoted} promoted`);
  }

  fs.writeFileSync(
    'tmp/clause-family-test-results.json',
    JSON.stringify(results, null, 2)
  );

  console.log('\n✓ Results saved to tmp/clause-family-test-results.json');
}

main().catch(console.error);
