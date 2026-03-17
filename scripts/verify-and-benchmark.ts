/**
 * VERIFICATION AND BENCHMARK SCRIPT
 *
 * This script performs comprehensive verification of the document intelligence pipeline:
 * 1. Verifies all claims made in ENHANCEMENT-RESULTS.md
 * 2. Extracts promoted rules with full source attribution
 * 3. Builds benchmark metrics
 * 4. Tests new clause types
 * 5. Validates QA layer effectiveness
 */

import { processDocument } from '../lib/document-intelligence';
import { calculateQualityMetrics } from '../lib/document-intelligence/rule-quality';
import { validateRule, validateAllRules } from '../lib/document-intelligence/quality-assurance';
import { PromotedRule, ClauseType } from '../lib/document-intelligence/types';
import * as fs from 'fs';
import * as path from 'path';

interface DocumentResult {
  documentName: string;
  sourcePath: string;
  sourceType: string;
  sourceFamily?: string;
  promotedRules: PromotedRule[];
  sectionCount: number;
  rawCandidateCount: number;
  consolidatedCandidateCount: number;
  normalizedCandidateCount: number;
  promotedRuleCount: number;
  warnings: string[];
  errors: string[];
}

interface VerificationReport {
  timestamp: string;
  corpusSize: number;
  totalPromotedRules: number;
  operationalRules: number;
  requirementRules: number;
  operationalPercentage: number;
  documentResults: DocumentResult[];
  clauseTypeBreakdown: Record<string, number>;
  newClauseTypesExtracted: string[];
  newClauseTypesConfiguredButNotExtracted: string[];
  qaMetrics?: {
    verified: number;
    acceptable: number;
    suspicious: number;
    invalid: number;
  };
}

const NEW_CLAUSE_TYPES = [
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
];

function classifySourceFamily(name: string): 'airline' | 'hotel' | 'rental' | 'cruise' | undefined {
  const lower = name.toLowerCase();

  if (lower.includes('alaska') || lower.includes('lufthansa') || lower.includes('airline') ||
      lower.includes('flight') || lower.includes('gcc') || lower.includes('carriage') ||
      lower.includes('american') || lower.includes('united') || lower.includes('delta') ||
      lower.includes('airways') || lower.includes('emirates') || lower.includes('/airlines/') ||
      lower.includes('jetblue') || lower.includes('qatar')) {
    return 'airline';
  }

  if (lower.includes('marriott') || lower.includes('hotel') || lower.includes('hilton') ||
      lower.includes('hyatt') || lower.includes('accor') || lower.includes('ihg') ||
      lower.includes('/hotels/')) {
    return 'hotel';
  }

  if (lower.includes('europcar') || lower.includes('rental') || lower.includes('car') ||
      lower.includes('avis') || lower.includes('hertz') || lower.includes('enterprise') ||
      lower.includes('/car-rental/')) {
    return 'rental';
  }

  if (lower.includes('royal caribbean') || lower.includes('cruise') || lower.includes('carnival') ||
      lower.includes('ncl') || lower.includes('princess') || lower.includes('/cruise/')) {
    return 'cruise';
  }

  return undefined;
}

function discoverDocuments(): Array<{ name: string; path: string; sourceType: string; sourceFamily?: string }> {
  const artifacts: Array<{ name: string; path: string; sourceType: string; sourceFamily?: string }> = [];

  // Scan document-intelligence directory
  const docIntPath = 'document-intelligence';
  if (fs.existsSync(docIntPath)) {
    const files = fs.readdirSync(docIntPath);
    for (const file of files) {
      const filePath = path.join(docIntPath, file);
      const stats = fs.statSync(filePath);

      if (!stats.isFile()) continue;

      if (file.endsWith('.pdf')) {
        artifacts.push({
          name: file.replace('.pdf', ''),
          path: filePath,
          sourceType: 'pdf',
          sourceFamily: classifySourceFamily(file),
        });
      } else if (file.endsWith('.mhtml')) {
        artifacts.push({
          name: file.replace('.mhtml', ''),
          path: filePath,
          sourceType: 'mhtml',
          sourceFamily: classifySourceFamily(file),
        });
      }
    }
  }

  // Scan tmp/web-capture directory recursively
  const webCapturePath = 'tmp/web-capture';
  if (fs.existsSync(webCapturePath)) {
    const scanDirectory = (dirPath: string, relativePath: string = '') => {
      const entries = fs.readdirSync(dirPath);

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          scanDirectory(fullPath, path.join(relativePath, entry));
        }
      }

      // Check for artifacts in current directory
      const renderedHtmlPath = path.join(dirPath, 'rendered.html');
      if (fs.existsSync(renderedHtmlPath)) {
        const content = fs.readFileSync(renderedHtmlPath, 'utf-8');
        const hasBot = /\bbot\b/i.test(content.substring(0, 5000));
        if (content.length > 1000 && !content.includes('Access Denied') && !hasBot) {
          const name = relativePath || path.basename(dirPath);
          artifacts.push({
            name: `${name}`,
            path: renderedHtmlPath,
            sourceType: 'rendered-html',
            sourceFamily: classifySourceFamily(name),
          });
        }
      }

      const renderedPdfPath = path.join(dirPath, 'rendered.pdf');
      if (fs.existsSync(renderedPdfPath)) {
        const name = relativePath || path.basename(dirPath);
        artifacts.push({
          name: `${name}-rendered-pdf`,
          path: renderedPdfPath,
          sourceType: 'rendered-pdf',
          sourceFamily: classifySourceFamily(name),
        });
      }
    };

    scanDirectory(webCapturePath);
  }

  return artifacts;
}

async function runVerification(): Promise<VerificationReport> {
  console.log('================================================================================');
  console.log('VERIFICATION AND BENCHMARK ANALYSIS');
  console.log('================================================================================');
  console.log('');

  const documents = discoverDocuments();
  console.log(`Discovered ${documents.length} documents`);
  console.log('');

  const documentResults: DocumentResult[] = [];
  const allPromotedRules: PromotedRule[] = [];

  for (const doc of documents) {
    process.stdout.write(`Processing: ${doc.name}...`);

    try {
      const result = await processDocument(doc.path, doc.name);

      const docResult: DocumentResult = {
        documentName: doc.name,
        sourcePath: doc.path,
        sourceType: doc.sourceType,
        sourceFamily: doc.sourceFamily,
        promotedRules: result.promotedRules || [],
        sectionCount: result.sections?.length || 0,
        rawCandidateCount: result.candidates?.length || 0,
        consolidatedCandidateCount: result.consolidationMetrics?.afterCount || 0,
        normalizedCandidateCount: result.normalizationMetrics?.normalizedCount || 0,
        promotedRuleCount: result.promotedRules?.length || 0,
        warnings: result.warnings || [],
        errors: result.errors || [],
      };

      documentResults.push(docResult);
      allPromotedRules.push(...(result.promotedRules || []));

      console.log(` ✓ ${docResult.promotedRuleCount} rules`);
    } catch (error) {
      console.log(` ✗ ERROR: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('');
  console.log('================================================================================');
  console.log('CALCULATING METRICS');
  console.log('================================================================================');
  console.log('');

  // Calculate quality metrics
  const qualityMetrics = calculateQualityMetrics(allPromotedRules);

  console.log(`Total Promoted Rules: ${allPromotedRules.length}`);
  console.log(`Operational Rules: ${qualityMetrics.operationalValueRules} (${qualityMetrics.operationalValuePercentage}%)`);
  console.log(`Requirement Rules: ${qualityMetrics.requirementRules} (${qualityMetrics.requirementPercentage}%)`);
  console.log('');

  // Check which new clause types were extracted
  const clauseTypeBreakdown: Record<string, number> = {};
  for (const rule of allPromotedRules) {
    clauseTypeBreakdown[rule.clauseType] = (clauseTypeBreakdown[rule.clauseType] || 0) + 1;
  }

  const newClauseTypesExtracted = NEW_CLAUSE_TYPES.filter(type => clauseTypeBreakdown[type] > 0);
  const newClauseTypesConfiguredButNotExtracted = NEW_CLAUSE_TYPES.filter(type => !clauseTypeBreakdown[type]);

  console.log('NEW CLAUSE TYPES STATUS:');
  console.log(`  Extracted: ${newClauseTypesExtracted.length} types`);
  if (newClauseTypesExtracted.length > 0) {
    newClauseTypesExtracted.forEach(type => {
      console.log(`    ✓ ${type}: ${clauseTypeBreakdown[type]} rules`);
    });
  }
  console.log(`  Configured but NOT extracted: ${newClauseTypesConfiguredButNotExtracted.length} types`);
  if (newClauseTypesConfiguredButNotExtracted.length > 0) {
    newClauseTypesConfiguredButNotExtracted.slice(0, 5).forEach(type => {
      console.log(`    ✗ ${type}`);
    });
    if (newClauseTypesConfiguredButNotExtracted.length > 5) {
      console.log(`    ... and ${newClauseTypesConfiguredButNotExtracted.length - 5} more`);
    }
  }
  console.log('');

  // Run QA validation
  console.log('RUNNING QA VALIDATION...');
  const qaResults = validateAllRules(allPromotedRules);

  const qaMetrics = {
    verified: qaResults.metrics.verified,
    acceptable: qaResults.metrics.acceptable,
    suspicious: qaResults.metrics.suspicious,
    invalid: qaResults.metrics.invalid,
  };

  console.log(`  Verified: ${qaMetrics.verified}`);
  console.log(`  Acceptable: ${qaMetrics.acceptable}`);
  console.log(`  Suspicious: ${qaMetrics.suspicious}`);
  console.log(`  Invalid: ${qaMetrics.invalid}`);
  console.log('');

  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    corpusSize: documents.length,
    totalPromotedRules: allPromotedRules.length,
    operationalRules: qualityMetrics.operationalValueRules,
    requirementRules: qualityMetrics.requirementRules,
    operationalPercentage: qualityMetrics.operationalValuePercentage,
    documentResults,
    clauseTypeBreakdown,
    newClauseTypesExtracted,
    newClauseTypesConfiguredButNotExtracted,
    qaMetrics,
  };

  return report;
}

// Run verification
runVerification().then(report => {
  console.log('================================================================================');
  console.log('VERIFICATION COMPLETE');
  console.log('================================================================================');
  console.log('');
  console.log('SUMMARY:');
  console.log(`  Corpus Size: ${report.corpusSize} documents`);
  console.log(`  Total Promoted Rules: ${report.totalPromotedRules}`);
  console.log(`  Operational Rules: ${report.operationalRules} (${report.operationalPercentage}%)`);
  console.log(`  Requirement Rules: ${report.requirementRules}`);
  console.log(`  New Clause Types Extracted: ${report.newClauseTypesExtracted.length} of ${NEW_CLAUSE_TYPES.length}`);
  console.log('');

  // Save detailed results
  const outputDir = 'tmp/verification';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(outputDir, 'verification-report.json'),
    JSON.stringify(report, null, 2)
  );

  // Save promoted rules with source attribution
  fs.writeFileSync(
    path.join(outputDir, 'all-promoted-rules.json'),
    JSON.stringify(
      report.documentResults.flatMap(doc =>
        doc.promotedRules.map(rule => ({
          documentName: doc.documentName,
          sourcePath: doc.sourcePath,
          ...rule,
        }))
      ),
      null,
      2
    )
  );

  console.log(`✓ Detailed report saved to: ${outputDir}/verification-report.json`);
  console.log(`✓ All promoted rules saved to: ${outputDir}/all-promoted-rules.json`);
  console.log('');
}).catch(error => {
  console.error('VERIFICATION FAILED:', error);
  process.exit(1);
});
