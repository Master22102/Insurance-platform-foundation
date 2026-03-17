/**
 * BENCHMARK EVALUATION
 *
 * Compares actual extraction against gold standard to calculate:
 * - Precision, Recall, F1 score per clause type
 * - False positive/negative analysis
 * - Source attribution verification
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

interface ExtractedRule {
  documentName: string;
  sourcePath: string;
  clauseType: string;
  value: any;
  confidenceTier: string;
  rawValue?: string;
  sourceSnippet?: string;
}

interface ClauseTypeMetrics {
  clauseType: string;
  goldCount: number;
  extractedCount: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
  notes: string[];
}

function normalizeValue(value: any): string {
  if (typeof value === 'string') {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  if (value && typeof value === 'object') {
    if (value.amount !== undefined) {
      return String(value.amount);
    }
    if (value.value !== undefined) {
      return String(value.value);
    }
  }
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchRule(gold: GoldRule, extracted: ExtractedRule): boolean {
  // Same document and clause type
  if (gold.documentName !== extracted.documentName) return false;
  if (gold.clauseType !== extracted.clauseType) return false;

  // For numeric values, compare normalized amounts
  const goldNorm = normalizeValue(gold.expectedValue);
  const extractedNorm = normalizeValue(extracted.value);

  // Exact match or close enough (handles minor formatting differences)
  return goldNorm === extractedNorm ||
         Math.abs(parseInt(goldNorm) - parseInt(extractedNorm)) < 5;
}

function runBenchmark() {
  console.log('================================================================================ ');
  console.log('BENCHMARK EVALUATION');
  console.log('================================================================================');
  console.log('');

  // Load gold set
  const goldSet: GoldRule[] = JSON.parse(
    fs.readFileSync('tmp/benchmark/gold-set.json', 'utf-8')
  );

  // Load actual extractions
  const extracted: ExtractedRule[] = JSON.parse(
    fs.readFileSync('tmp/verification/all-promoted-rules.json', 'utf-8')
  );

  console.log(`Gold Set: ${goldSet.length} rules`);
  console.log(`Extracted: ${extracted.length} rules`);
  console.log('');

  // Group by clause type
  const goldByType: Record<string, GoldRule[]> = {};
  const extractedByType: Record<string, ExtractedRule[]> = {};

  for (const rule of goldSet) {
    if (!goldByType[rule.clauseType]) {
      goldByType[rule.clauseType] = [];
    }
    goldByType[rule.clauseType].push(rule);
  }

  for (const rule of extracted) {
    if (!extractedByType[rule.clauseType]) {
      extractedByType[rule.clauseType] = [];
    }
    extractedByType[rule.clauseType].push(rule);
  }

  // Calculate metrics per clause type
  const allClauseTypes = new Set([
    ...Object.keys(goldByType),
    ...Object.keys(extractedByType),
  ]);

  const metrics: ClauseTypeMetrics[] = [];

  for (const clauseType of Array.from(allClauseTypes)) {
    const gold = goldByType[clauseType] || [];
    const ext = extractedByType[clauseType] || [];

    let tp = 0; // True positives
    let fp = 0; // False positives
    let fn = 0; // False negatives

    const matched = new Set<number>();
    const notes: string[] = [];

    // Find true positives
    for (const goldRule of gold) {
      let found = false;
      for (let i = 0; i < ext.length; i++) {
        if (matchRule(goldRule, ext[i])) {
          tp++;
          matched.add(i);
          found = true;
          break;
        }
      }
      if (!found) {
        fn++;
        notes.push(`MISS: ${goldRule.documentName} - ${goldRule.expectedValue} (${goldRule.sourceSnippet.substring(0, 50)}...)`);
      }
    }

    // False positives = extracted but not in gold set
    // For now, we only count as FP if we have gold coverage for that document
    const docsWithGold = new Set(gold.map(g => g.documentName));
    for (let i = 0; i < ext.length; i++) {
      if (!matched.has(i) && docsWithGold.has(ext[i].documentName)) {
        fp++;
      }
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

    metrics.push({
      clauseType,
      goldCount: gold.length,
      extractedCount: ext.length,
      truePositives: tp,
      falsePositives: fp,
      falseNegatives: fn,
      precision: Math.round(precision * 100),
      recall: Math.round(recall * 100),
      f1Score: Math.round(f1 * 100),
      notes,
    });
  }

  // Sort by F1 score descending
  metrics.sort((a, b) => b.f1Score - a.f1Score);

  console.log('================================================================================');
  console.log('CLAUSE TYPE SCORECARD');
  console.log('================================================================================');
  console.log('');

  for (const m of metrics) {
    console.log(`${m.clauseType}:`);
    console.log(`  Gold: ${m.goldCount} | Extracted: ${m.extractedCount} | TP: ${m.truePositives} | FP: ${m.falsePositives} | FN: ${m.falseNegatives}`);
    console.log(`  Precision: ${m.precision}% | Recall: ${m.recall}% | F1: ${m.f1Score}%`);
    if (m.notes.length > 0) {
      console.log(`  Issues:`);
      m.notes.slice(0, 2).forEach(note => console.log(`    - ${note}`));
      if (m.notes.length > 2) {
        console.log(`    ... and ${m.notes.length - 2} more`);
      }
    }
    console.log('');
  }

  // Overall metrics
  const totalTP = metrics.reduce((sum, m) => sum + m.truePositives, 0);
  const totalFP = metrics.reduce((sum, m) => sum + m.falsePositives, 0);
  const totalFN = metrics.reduce((sum, m) => sum + m.falseNegatives, 0);

  const overallPrecision = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 0;
  const overallRecall = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;
  const overallF1 = overallPrecision + overallRecall > 0
    ? 2 * (overallPrecision * overallRecall) / (overallPrecision + overallRecall)
    : 0;

  console.log('================================================================================');
  console.log('OVERALL BENCHMARK METRICS');
  console.log('================================================================================');
  console.log('');
  console.log(`Total Gold Rules: ${goldSet.length}`);
  console.log(`Total Extracted Rules: ${extracted.length}`);
  console.log(`True Positives: ${totalTP}`);
  console.log(`False Positives: ${totalFP}`);
  console.log(`False Negatives: ${totalFN}`);
  console.log('');
  console.log(`Overall Precision: ${Math.round(overallPrecision * 100)}%`);
  console.log(`Overall Recall: ${Math.round(overallRecall * 100)}%`);
  console.log(`Overall F1 Score: ${Math.round(overallF1 * 100)}%`);
  console.log('');

  // Save results
  const report = {
    timestamp: new Date().toISOString(),
    goldSetSize: goldSet.length,
    extractedRuleCount: extracted.length,
    overallMetrics: {
      precision: Math.round(overallPrecision * 100),
      recall: Math.round(overallRecall * 100),
      f1Score: Math.round(overallF1 * 100),
      truePositives: totalTP,
      falsePositives: totalFP,
      falseNegatives: totalFN,
    },
    perClauseType: metrics,
  };

  fs.writeFileSync(
    'tmp/benchmark/benchmark-results.json',
    JSON.stringify(report, null, 2)
  );

  // Save CSV scorecard
  const csv: string[] = [];
  csv.push('Clause Type,Gold Count,Extracted,True Positives,False Positives,False Negatives,Precision %,Recall %,F1 Score %');
  for (const m of metrics) {
    csv.push(`${m.clauseType},${m.goldCount},${m.extractedCount},${m.truePositives},${m.falsePositives},${m.falseNegatives},${m.precision},${m.recall},${m.f1Score}`);
  }

  fs.writeFileSync('tmp/benchmark/clause-type-scorecard.csv', csv.join('\n'));

  console.log('✓ Benchmark results saved to tmp/benchmark/benchmark-results.json');
  console.log('✓ CSV scorecard saved to tmp/benchmark/clause-type-scorecard.csv');
  console.log('');
}

runBenchmark();
