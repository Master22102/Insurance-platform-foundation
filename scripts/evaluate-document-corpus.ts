import { processDocument } from '../lib/document-intelligence';
import { calculateQualityMetrics, generateQualityReport, RuleQualityMetrics } from '../lib/document-intelligence/rule-quality';
import * as fs from 'fs';
import * as path from 'path';

interface ArtifactInfo {
  name: string;
  path: string;
  sourceType: 'pdf' | 'html' | 'mhtml' | 'normalized-html' | 'normalized-txt' | 'rendered-html' | 'rendered-pdf';
  sourceFamily?: 'airline' | 'hotel' | 'rental' | 'cruise';
}

interface DocumentMetrics {
  documentName: string;
  sourcePath: string;
  sourceType: string;
  sourceFamily?: string;
  parseStatus: 'success' | 'failed';
  extractionSuccess: boolean;
  extractionMethod?: string;
  sectionCount: number;
  rawCandidateCount: number;
  consolidatedCandidateCount: number;
  consolidationReduction: number;
  normalizedCandidateCount: number;
  normalizationRate: number;
  promotedRuleCount: number;
  topClauseFamilies: Array<{ type: string; count: number }>;
  confidenceTiers: Record<string, number>;
  passContributions: Record<string, number>;
  warnings: string[];
  errors: string[];
  expectedClausesFound?: number;
  expectedClausesMissed?: number;
  conflictResolution?: {
    blockingConflictsBefore: number;
    blockingConflictsAfter: number;
    conflictsResolved: number;
    conflictsResolvedPct: number;
  };
}

interface CorpusMetrics {
  totalArtifacts: number;
  successfulParses: number;
  failedParses: number;
  totalRawCandidates: number;
  totalConsolidatedCandidates: number;
  totalNormalizedCandidates: number;
  totalPromotedRules: number;
  bySourceType: Record<string, {
    count: number;
    successful: number;
    candidates: number;
    promoted: number;
  }>;
  bySourceFamily: Record<string, {
    count: number;
    successful: number;
    candidates: number;
    promoted: number;
  }>;
  byClauseFamily: Record<string, number>;
  byPass: Record<string, number>;
  confidenceTierDistribution: Record<string, number>;
}

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

function discoverArtifacts(): ArtifactInfo[] {
  const artifacts: ArtifactInfo[] = [];

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
      } else if (file.endsWith('.html')) {
        artifacts.push({
          name: file.replace('.html', ''),
          path: filePath,
          sourceType: 'html',
          sourceFamily: classifySourceFamily(file),
        });
      } else if (file.endsWith('.mhtml')) {
        artifacts.push({
          name: file.replace('.mhtml', ''),
          path: filePath,
          sourceType: 'mhtml',
          sourceFamily: classifySourceFamily(file),
        });
      } else if (file.endsWith('.txt')) {
        artifacts.push({
          name: file.replace('.txt', ''),
          path: filePath,
          sourceType: 'normalized-txt' as any,
          sourceFamily: classifySourceFamily(file),
        });
      } else if (file.endsWith('.xml')) {
        artifacts.push({
          name: file.replace('.xml', ''),
          path: filePath,
          sourceType: 'normalized-txt' as any,
          sourceFamily: classifySourceFamily(file),
        });
      }
    }
  }

  const webCapturePath = 'tmp/web-capture';
  if (fs.existsSync(webCapturePath)) {
    // Recursive function to scan directories
    const scanDirectory = (dirPath: string, relativePath: string = '') => {
      const entries = fs.readdirSync(dirPath);

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          // Recursively scan subdirectories
          scanDirectory(fullPath, path.join(relativePath, entry));
        }
      }

      // After scanning subdirectories, check for artifacts in current directory
      const normalizedHtmlPath = path.join(dirPath, 'normalized.html');
      if (fs.existsSync(normalizedHtmlPath)) {
        const content = fs.readFileSync(normalizedHtmlPath, 'utf-8');
        // Check for bot detection pages (not "bottle" etc)
        const hasBot = /\bbot\b/i.test(content.substring(0, 5000)); // Word boundary, first 5KB only
        if (content.length > 1000 && !content.includes('Access Denied') && !hasBot) {
          const name = relativePath || path.basename(dirPath);
          artifacts.push({
            name,
            path: normalizedHtmlPath,
            sourceType: 'normalized-html',
            sourceFamily: classifySourceFamily(name),
          });
        }
      }

      const normalizedTxtPath = path.join(dirPath, 'normalized.txt');
      if (fs.existsSync(normalizedTxtPath)) {
        const content = fs.readFileSync(normalizedTxtPath, 'utf-8');
        if (content.length > 1000) {
          const name = relativePath || path.basename(dirPath);
          artifacts.push({
            name: `${name}-txt`,
            path: normalizedTxtPath,
            sourceType: 'normalized-txt',
            sourceFamily: classifySourceFamily(name),
          });
        }
      }

      const renderedHtmlPath = path.join(dirPath, 'rendered.html');
      if (fs.existsSync(renderedHtmlPath)) {
        const content = fs.readFileSync(renderedHtmlPath, 'utf-8');
        // Check for bot detection pages (not "bottle" etc)
        const hasBot = /\bbot\b/i.test(content.substring(0, 5000)); // Word boundary, first 5KB only
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

  return artifacts.sort((a, b) => a.name.localeCompare(b.name));
}

async function evaluateDocument(artifact: ArtifactInfo): Promise<DocumentMetrics> {
  console.log(`\nProcessing: ${artifact.name}`);
  console.log(`  Path: ${artifact.path}`);
  console.log(`  Type: ${artifact.sourceType}${artifact.sourceFamily ? ` (${artifact.sourceFamily})` : ''}`);

  try {
    const result = await processDocument(artifact.path, artifact.name);

    const candidatesByType: Record<string, number> = {};
    const candidatesByPass: Record<string, number> = {};
    const confidenceTiers: Record<string, number> = {};

    for (const candidate of result.candidates) {
      candidatesByType[candidate.clauseType] = (candidatesByType[candidate.clauseType] || 0) + 1;
      confidenceTiers[candidate.confidence] = (confidenceTiers[candidate.confidence] || 0) + 1;

      if (candidate.detectedByPass) {
        candidatesByPass[candidate.detectedByPass] = (candidatesByPass[candidate.detectedByPass] || 0) + 1;
      }
    }

    const topClauseFamilies = Object.entries(candidatesByType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    const consolidatedCount = result.consolidationMetrics?.afterCount || result.candidates.length;
    const normalizedCount = result.normalizationMetrics?.normalizedCount || 0;
    const normalizationRate = result.normalizationMetrics?.normalizationRate || 0;

    console.log(`  ✓ Sections: ${result.sections.length}`);
    console.log(`  ✓ Raw candidates: ${result.consolidationMetrics?.beforeCount || result.candidates.length}`);
    console.log(`  ✓ Consolidated: ${consolidatedCount}`);
    console.log(`  ✓ Normalized: ${normalizedCount} (${normalizationRate}%)`);

    if (result.conflictResolutionMetrics) {
      const crm = result.conflictResolutionMetrics;
      const resolved = crm.blockingConflictsBefore - crm.blockingConflictsAfter;
      console.log(`  ✓ Conflicts resolved: ${resolved} of ${crm.blockingConflictsBefore}`);
    }

    console.log(`  ✓ Promoted: ${result.promotedRules.length}`);

    const conflictResolution = result.conflictResolutionMetrics ? {
      blockingConflictsBefore: result.conflictResolutionMetrics.blockingConflictsBefore,
      blockingConflictsAfter: result.conflictResolutionMetrics.blockingConflictsAfter,
      conflictsResolved: result.conflictResolutionMetrics.blockingConflictsBefore - result.conflictResolutionMetrics.blockingConflictsAfter,
      conflictsResolvedPct: result.conflictResolutionMetrics.blockingConflictsBefore > 0
        ? Math.round(((result.conflictResolutionMetrics.blockingConflictsBefore - result.conflictResolutionMetrics.blockingConflictsAfter) / result.conflictResolutionMetrics.blockingConflictsBefore) * 100)
        : 0,
    } : undefined;

    return {
      documentName: artifact.name,
      sourcePath: artifact.path,
      sourceType: artifact.sourceType,
      sourceFamily: artifact.sourceFamily,
      parseStatus: 'success',
      extractionSuccess: result.extraction.success,
      extractionMethod: result.extraction.method,
      sectionCount: result.sections.length,
      rawCandidateCount: result.consolidationMetrics?.beforeCount || result.candidates.length,
      consolidatedCandidateCount: consolidatedCount,
      consolidationReduction: result.consolidationMetrics?.reductionPercent || 0,
      normalizedCandidateCount: normalizedCount,
      normalizationRate,
      promotedRuleCount: result.promotedRules.length,
      topClauseFamilies,
      confidenceTiers,
      passContributions: candidatesByPass,
      warnings: result.warnings,
      errors: result.errors,
      conflictResolution,
    };
  } catch (error: any) {
    console.log(`  ✗ Error: ${error.message}`);

    return {
      documentName: artifact.name,
      sourcePath: artifact.path,
      sourceType: artifact.sourceType,
      sourceFamily: artifact.sourceFamily,
      parseStatus: 'failed',
      extractionSuccess: false,
      sectionCount: 0,
      rawCandidateCount: 0,
      consolidatedCandidateCount: 0,
      consolidationReduction: 0,
      normalizedCandidateCount: 0,
      normalizationRate: 0,
      promotedRuleCount: 0,
      topClauseFamilies: [],
      confidenceTiers: {},
      passContributions: {},
      warnings: [],
      errors: [error.message],
    };
  }
}

function aggregateMetrics(documentMetrics: DocumentMetrics[]): CorpusMetrics {
  const corpus: CorpusMetrics = {
    totalArtifacts: documentMetrics.length,
    successfulParses: 0,
    failedParses: 0,
    totalRawCandidates: 0,
    totalConsolidatedCandidates: 0,
    totalNormalizedCandidates: 0,
    totalPromotedRules: 0,
    bySourceType: {},
    bySourceFamily: {},
    byClauseFamily: {},
    byPass: {},
    confidenceTierDistribution: {},
  };

  for (const doc of documentMetrics) {
    if (doc.parseStatus === 'success') {
      corpus.successfulParses++;
    } else {
      corpus.failedParses++;
    }

    corpus.totalRawCandidates += doc.rawCandidateCount;
    corpus.totalConsolidatedCandidates += doc.consolidatedCandidateCount;
    corpus.totalNormalizedCandidates += doc.normalizedCandidateCount;
    corpus.totalPromotedRules += doc.promotedRuleCount;

    if (!corpus.bySourceType[doc.sourceType]) {
      corpus.bySourceType[doc.sourceType] = {
        count: 0,
        successful: 0,
        candidates: 0,
        promoted: 0,
      };
    }
    corpus.bySourceType[doc.sourceType].count++;
    if (doc.parseStatus === 'success') {
      corpus.bySourceType[doc.sourceType].successful++;
    }
    corpus.bySourceType[doc.sourceType].candidates += doc.consolidatedCandidateCount;
    corpus.bySourceType[doc.sourceType].promoted += doc.promotedRuleCount;

    if (doc.sourceFamily) {
      if (!corpus.bySourceFamily[doc.sourceFamily]) {
        corpus.bySourceFamily[doc.sourceFamily] = {
          count: 0,
          successful: 0,
          candidates: 0,
          promoted: 0,
        };
      }
      corpus.bySourceFamily[doc.sourceFamily].count++;
      if (doc.parseStatus === 'success') {
        corpus.bySourceFamily[doc.sourceFamily].successful++;
      }
      corpus.bySourceFamily[doc.sourceFamily].candidates += doc.consolidatedCandidateCount;
      corpus.bySourceFamily[doc.sourceFamily].promoted += doc.promotedRuleCount;
    }

    for (const family of doc.topClauseFamilies) {
      corpus.byClauseFamily[family.type] = (corpus.byClauseFamily[family.type] || 0) + family.count;
    }

    for (const [pass, count] of Object.entries(doc.passContributions)) {
      corpus.byPass[pass] = (corpus.byPass[pass] || 0) + count;
    }

    for (const [tier, count] of Object.entries(doc.confidenceTiers)) {
      corpus.confidenceTierDistribution[tier] = (corpus.confidenceTierDistribution[tier] || 0) + count;
    }
  }

  return corpus;
}

function generateMarkdownReport(documentMetrics: DocumentMetrics[], corpus: CorpusMetrics): string {
  const lines: string[] = [];

  lines.push('# Document Corpus Evaluation Report');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## Executive Summary');
  lines.push('');
  lines.push(`- **Total Artifacts:** ${corpus.totalArtifacts}`);
  lines.push(`- **Successful Parses:** ${corpus.successfulParses} (${Math.round((corpus.successfulParses / corpus.totalArtifacts) * 100)}%)`);
  lines.push(`- **Failed Parses:** ${corpus.failedParses}`);
  lines.push(`- **Total Raw Candidates:** ${corpus.totalRawCandidates}`);
  lines.push(`- **Total Consolidated:** ${corpus.totalConsolidatedCandidates}`);
  lines.push(`- **Total Normalized:** ${corpus.totalNormalizedCandidates} (${corpus.totalConsolidatedCandidates > 0 ? Math.round((corpus.totalNormalizedCandidates / corpus.totalConsolidatedCandidates) * 100) : 0}%)`);
  lines.push(`- **Total Promoted Rules:** ${corpus.totalPromotedRules}`);
  lines.push('');

  lines.push('---');
  lines.push('');

  lines.push('## Corpus Breakdown');
  lines.push('');

  lines.push('### By Source Type');
  lines.push('');
  lines.push('| Source Type | Count | Success | Candidates | Promoted |');
  lines.push('|------------|-------|---------|------------|----------|');
  for (const [type, stats] of Object.entries(corpus.bySourceType).sort((a, b) => b[1].count - a[1].count)) {
    lines.push(`| ${type} | ${stats.count} | ${stats.successful} | ${stats.candidates} | ${stats.promoted} |`);
  }
  lines.push('');

  if (Object.keys(corpus.bySourceFamily).length > 0) {
    lines.push('### By Source Family');
    lines.push('');
    lines.push('| Family | Count | Success | Candidates | Promoted |');
    lines.push('|--------|-------|---------|------------|----------|');
    for (const [family, stats] of Object.entries(corpus.bySourceFamily).sort((a, b) => b[1].count - a[1].count)) {
      lines.push(`| ${family} | ${stats.count} | ${stats.successful} | ${stats.candidates} | ${stats.promoted} |`);
    }
    lines.push('');
  }

  lines.push('### Top Clause Families');
  lines.push('');
  lines.push('| Clause Type | Count |');
  lines.push('|-------------|-------|');
  const topClauseFamilies = Object.entries(corpus.byClauseFamily)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [type, count] of topClauseFamilies) {
    lines.push(`| ${type} | ${count} |`);
  }
  lines.push('');

  lines.push('### Pass Contributions');
  lines.push('');
  lines.push('| Pass | Candidates |');
  lines.push('|------|------------|');
  for (const [pass, count] of Object.entries(corpus.byPass).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${pass} | ${count} |`);
  }
  lines.push('');

  lines.push('### Confidence Tier Distribution');
  lines.push('');
  lines.push('| Tier | Count | Percentage |');
  lines.push('|------|-------|------------|');
  const totalCandidates = Object.values(corpus.confidenceTierDistribution).reduce((sum, count) => sum + count, 0);
  for (const [tier, count] of Object.entries(corpus.confidenceTierDistribution).sort((a, b) => b[1] - a[1])) {
    const pct = totalCandidates > 0 ? Math.round((count / totalCandidates) * 100) : 0;
    lines.push(`| ${tier} | ${count} | ${pct}% |`);
  }
  lines.push('');

  lines.push('---');
  lines.push('');

  lines.push('## Document Performance');
  lines.push('');

  const successful = documentMetrics.filter(d => d.parseStatus === 'success');

  if (successful.length > 0) {
    lines.push('### Strongest Documents (by promoted rules)');
    lines.push('');
    lines.push('| Document | Type | Sections | Candidates | Normalized | Promoted |');
    lines.push('|----------|------|----------|------------|------------|----------|');
    const strongest = [...successful].sort((a, b) => b.promotedRuleCount - a.promotedRuleCount).slice(0, 5);
    for (const doc of strongest) {
      lines.push(`| ${doc.documentName} | ${doc.sourceType} | ${doc.sectionCount} | ${doc.consolidatedCandidateCount} | ${doc.normalizedCandidateCount} | ${doc.promotedRuleCount} |`);
    }
    lines.push('');

    lines.push('### Weakest Documents (fewest promoted rules)');
    lines.push('');
    lines.push('| Document | Type | Sections | Candidates | Normalized | Promoted |');
    lines.push('|----------|------|----------|------------|------------|----------|');
    const weakest = [...successful].sort((a, b) => a.promotedRuleCount - b.promotedRuleCount).slice(0, 5);
    for (const doc of weakest) {
      lines.push(`| ${doc.documentName} | ${doc.sourceType} | ${doc.sectionCount} | ${doc.consolidatedCandidateCount} | ${doc.normalizedCandidateCount} | ${doc.promotedRuleCount} |`);
    }
    lines.push('');
  }

  if (corpus.failedParses > 0) {
    lines.push('### Failed Parses');
    lines.push('');
    lines.push('| Document | Type | Error |');
    lines.push('|----------|------|-------|');
    const failed = documentMetrics.filter(d => d.parseStatus === 'failed');
    for (const doc of failed) {
      const error = doc.errors[0] || 'Unknown error';
      lines.push(`| ${doc.documentName} | ${doc.sourceType} | ${error.substring(0, 50)} |`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  lines.push('## Per-Document Details');
  lines.push('');
  lines.push('| Document | Type | Status | Sections | Raw | Consol | Norm | Promoted | Top Clause |');
  lines.push('|----------|------|--------|----------|-----|--------|------|----------|------------|');
  for (const doc of documentMetrics) {
    const topClause = doc.topClauseFamilies[0]?.type || 'none';
    const status = doc.parseStatus === 'success' ? '✓' : '✗';
    lines.push(`| ${doc.documentName} | ${doc.sourceType} | ${status} | ${doc.sectionCount} | ${doc.rawCandidateCount} | ${doc.consolidatedCandidateCount} | ${doc.normalizedCandidateCount} | ${doc.promotedRuleCount} | ${topClause} |`);
  }
  lines.push('');

  lines.push('---');
  lines.push('');

  lines.push('## Recommendations');
  lines.push('');

  lines.push('### Parser Gaps');
  lines.push('');
  const zeroPromotedDocs = successful.filter(d => d.promotedRuleCount === 0);
  if (zeroPromotedDocs.length > 0) {
    lines.push(`**${zeroPromotedDocs.length} documents with zero promoted rules:**`);
    lines.push('');
    for (const doc of zeroPromotedDocs.slice(0, 5)) {
      lines.push(`- ${doc.documentName} (${doc.consolidatedCandidateCount} candidates detected but not promoted)`);
    }
    lines.push('');
    lines.push('**Action:** Review confidence thresholds and promotion criteria.');
    lines.push('');
  }

  const lowYieldDocs = successful.filter(d => d.consolidatedCandidateCount < 10 && d.sectionCount > 10);
  if (lowYieldDocs.length > 0) {
    lines.push(`**${lowYieldDocs.length} documents with low candidate yield despite having content:**`);
    lines.push('');
    for (const doc of lowYieldDocs.slice(0, 5)) {
      lines.push(`- ${doc.documentName} (${doc.sectionCount} sections, ${doc.consolidatedCandidateCount} candidates)`);
    }
    lines.push('');
    lines.push('**Action:** Review phrase clusters and pattern coverage for these document types.');
    lines.push('');
  }

  lines.push('### Next Tuning Targets');
  lines.push('');
  lines.push('Based on corpus analysis, consider:');
  lines.push('');
  lines.push('1. **Clause families with high candidate but low promotion rates**');
  lines.push('   - Review confidence scoring for these types');
  lines.push('   - Consider adjusting promotion thresholds');
  lines.push('');
  lines.push('2. **Source types with low success rates**');
  for (const [type, stats] of Object.entries(corpus.bySourceType)) {
    const successRate = stats.count > 0 ? (stats.successful / stats.count) * 100 : 0;
    if (successRate < 80 && stats.count > 1) {
      lines.push(`   - ${type}: ${Math.round(successRate)}% success rate`);
    }
  }
  lines.push('');
  lines.push('3. **Expand normalization coverage**');
  const normalizationRate = corpus.totalConsolidatedCandidates > 0
    ? (corpus.totalNormalizedCandidates / corpus.totalConsolidatedCandidates) * 100
    : 0;
  lines.push(`   - Current normalization rate: ${Math.round(normalizationRate)}%`);
  lines.push(`   - Target: 50%+ for better canonical rule quality`);
  lines.push('');

  return lines.join('\n');
}

function generateCSV(documentMetrics: DocumentMetrics[]): string {
  const lines: string[] = [];

  lines.push('document_name,source_type,source_family,parse_status,sections,raw_candidates,consolidated_candidates,normalized_candidates,promoted_rules,top_clause_family,notes');

  for (const doc of documentMetrics) {
    const topClause = doc.topClauseFamilies[0]?.type || 'none';
    const notes = doc.errors.length > 0 ? doc.errors[0].replace(/,/g, ';') : '';
    const family = doc.sourceFamily || 'unknown';

    lines.push([
      doc.documentName,
      doc.sourceType,
      family,
      doc.parseStatus,
      doc.sectionCount,
      doc.rawCandidateCount,
      doc.consolidatedCandidateCount,
      doc.normalizedCandidateCount,
      doc.promotedRuleCount,
      topClause,
      notes,
    ].join(','));
  }

  return lines.join('\n');
}

async function main() {
  console.log('================================================================================');
  console.log('Document Corpus Evaluation');
  console.log('================================================================================\n');

  console.log('Discovering artifacts...');
  const artifacts = discoverArtifacts();
  console.log(`Found ${artifacts.length} artifacts\n`);

  console.log('Evaluating corpus...');
  const documentMetrics: DocumentMetrics[] = [];
  const allPromotedRules: any[] = [];

  for (const artifact of artifacts) {
    const metrics = await evaluateDocument(artifact);
    documentMetrics.push(metrics);

    // Re-process to get promoted rules for quality analysis
    try {
      const result = await processDocument(artifact.path, artifact.name);
      allPromotedRules.push(...result.promotedRules);
    } catch (error) {
      // Already handled in evaluateDocument
    }
  }

  console.log('\n================================================================================');
  console.log('Aggregating metrics...');
  const corpus = aggregateMetrics(documentMetrics);

  console.log('\n================================================================================');
  console.log('Calculating quality metrics...');
  const qualityMetrics = calculateQualityMetrics(allPromotedRules);
  const qualityReport = generateQualityReport(qualityMetrics);

  console.log('\n' + qualityReport.join('\n'));

  console.log('\n================================================================================');
  console.log('Generating reports...');

  const outputDir = 'tmp/corpus-evaluation';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const markdown = generateMarkdownReport(documentMetrics, corpus);
  fs.writeFileSync(path.join(outputDir, 'corpus-evaluation-review.md'), markdown);
  console.log(`✓ Markdown report: ${outputDir}/corpus-evaluation-review.md`);

  const json = JSON.stringify({ documentMetrics, corpus, qualityMetrics }, null, 2);
  fs.writeFileSync(path.join(outputDir, 'corpus-evaluation-output.json'), json);
  console.log(`✓ JSON output: ${outputDir}/corpus-evaluation-output.json`);

  const csv = generateCSV(documentMetrics);
  fs.writeFileSync(path.join(outputDir, 'corpus-evaluation-summary.csv'), csv);
  console.log(`✓ CSV summary: ${outputDir}/corpus-evaluation-summary.csv`);

  const qualityReportText = qualityReport.join('\n');
  fs.writeFileSync(path.join(outputDir, 'rule-quality-report.md'), qualityReportText);
  console.log(`✓ Quality report: ${outputDir}/rule-quality-report.md`);

  console.log('\n================================================================================');
  console.log('Summary');
  console.log('================================================================================\n');

  console.log(`Total Artifacts: ${corpus.totalArtifacts}`);
  console.log(`Successful Parses: ${corpus.successfulParses}`);
  console.log(`Failed Parses: ${corpus.failedParses}`);
  console.log('');
  console.log(`Total Raw Candidates: ${corpus.totalRawCandidates}`);
  console.log(`Total Consolidated: ${corpus.totalConsolidatedCandidates}`);
  console.log(`Total Normalized: ${corpus.totalNormalizedCandidates}`);
  console.log(`Total Promoted Rules: ${corpus.totalPromotedRules}`);
  console.log('');

  const successful = documentMetrics.filter(d => d.parseStatus === 'success');
  if (successful.length > 0) {
    console.log('Top 5 Documents (by promoted rules):');
    const top5 = [...successful].sort((a, b) => b.promotedRuleCount - a.promotedRuleCount).slice(0, 5);
    for (const doc of top5) {
      console.log(`  - ${doc.documentName}: ${doc.promotedRuleCount} rules`);
    }
    console.log('');

    console.log('Bottom 5 Documents (by promoted rules):');
    const bottom5 = [...successful].sort((a, b) => a.promotedRuleCount - b.promotedRuleCount).slice(0, 5);
    for (const doc of bottom5) {
      console.log(`  - ${doc.documentName}: ${doc.promotedRuleCount} rules`);
    }
    console.log('');
  }

  console.log('Top Clause Families:');
  const topClause = Object.entries(corpus.byClauseFamily)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  for (const [type, count] of topClause) {
    console.log(`  - ${type}: ${count}`);
  }
  console.log('');

  console.log('✓ Evaluation complete');
}

main().catch(console.error);
