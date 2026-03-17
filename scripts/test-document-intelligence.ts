import fs from 'fs';
import path from 'path';
import { processDocument } from '../lib/document-intelligence/index';
import { ProcessingResult, ExpectedClauses } from '../lib/document-intelligence/types';

const DOCUMENT_DIR = path.join(process.cwd(), 'document-intelligence');
const OUTPUT_DIR = path.join(process.cwd(), 'tmp');
const MACHINE_OUTPUT = path.join(OUTPUT_DIR, 'document-intelligence-output.json');
const HUMAN_OUTPUT = path.join(OUTPUT_DIR, 'document-intelligence-review.md');

interface TestResult {
  fileName: string;
  result: ProcessingResult;
  expectedClauses?: ExpectedClauses;
  missingClauses: string[];
  unexpectedClauses: string[];
}

async function main() {
  console.log('='.repeat(80));
  console.log('Document Intelligence Engine - Test Harness');
  console.log('='.repeat(80));
  console.log();

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const files = fs.readdirSync(DOCUMENT_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ['.pdf', '.html', '.htm', '.mhtml', '.mht'].includes(ext);
  });

  if (files.length === 0) {
    console.error('No documents found in document-intelligence/ directory');
    process.exit(1);
  }

  console.log(`Found ${files.length} document(s) to process:`);
  files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  console.log();

  const testResults: TestResult[] = [];

  for (const file of files) {
    const filePath = path.join(DOCUMENT_DIR, file);
    console.log(`Processing: ${file}`);

    const result = await processDocument(filePath, file);

    const expectedPath = path.join(DOCUMENT_DIR, `${file}.expected.json`);
    let expectedClauses: ExpectedClauses | undefined;
    let missingClauses: string[] = [];
    let unexpectedClauses: string[] = [];

    if (fs.existsSync(expectedPath)) {
      try {
        expectedClauses = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
        const detectedTypes = new Set(result.promotedRules.map((r) => r.clauseType));

        if (expectedClauses && expectedClauses.required_clause_types) {
          missingClauses = expectedClauses.required_clause_types.filter(
            (type) => !detectedTypes.has(type)
          );
        }
      } catch (error) {
        result.warnings.push(`Failed to parse expected clauses file: ${error}`);
      }
    }

    console.log(`  Extraction success: ${result.extraction.success}`);
    console.log(`  Sections detected: ${result.sections.length}`);
    console.log(`  Clause candidates: ${result.candidates.length}`);
    console.log(`  Promoted rules: ${result.promotedRules.length}`);
    if (missingClauses.length > 0) {
      console.log(`  Missing expected clauses: ${missingClauses.length}`);
    }
    console.log();

    testResults.push({
      fileName: file,
      result,
      expectedClauses,
      missingClauses,
      unexpectedClauses,
    });
  }

  writeMachineOutput(testResults);
  writeHumanOutput(testResults);

  console.log('='.repeat(80));
  console.log('Test harness completed successfully');
  console.log(`Machine output: ${MACHINE_OUTPUT}`);
  console.log(`Human-readable output: ${HUMAN_OUTPUT}`);
  console.log('='.repeat(80));

  printSummary(testResults);
}

function writeMachineOutput(testResults: TestResult[]): void {
  const output = {
    timestamp: new Date().toISOString(),
    totalDocuments: testResults.length,
    results: testResults.map((tr) => ({
      fileName: tr.fileName,
      fileType: tr.result.fileType,
      extractionSuccess: tr.result.extraction.success,
      extractionMethod: tr.result.extraction.method,
      sectionsDetected: tr.result.sections.length,
      candidatesDetected: tr.result.candidates.length,
      promotedRulesCount: tr.result.promotedRules.length,
      candidates: tr.result.candidates.map((c) => ({
        clauseType: c.clauseType,
        value: c.value,
        confidence: c.confidence,
        matchedPhrases: c.matchedPhrases,
        ambiguityFlags: c.ambiguityFlags,
        conflictFlags: c.conflictFlags,
        sourceSection: c.sourceSection,
      })),
      promotedRules: tr.result.promotedRules,
      expectedClauses: tr.expectedClauses,
      missingClauses: tr.missingClauses,
      unexpectedClauses: tr.unexpectedClauses,
      warnings: tr.result.warnings,
      errors: tr.result.errors,
    })),
  };

  fs.writeFileSync(MACHINE_OUTPUT, JSON.stringify(output, null, 2));
}

function writeHumanOutput(testResults: TestResult[]): void {
  let md = '# Document Intelligence Engine - Test Results\n\n';
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += `**Total Documents Processed:** ${testResults.length}\n\n`;
  md += '---\n\n';

  for (const tr of testResults) {
    md += `## ${tr.fileName}\n\n`;
    md += `**File Type:** ${tr.result.fileType}\n\n`;
    md += `**Extraction Success:** ${tr.result.extraction.success ? '✓' : '✗'}\n\n`;
    md += `**Extraction Method:** ${tr.result.extraction.method}\n\n`;

    if (tr.result.extraction.success) {
      md += `**Extracted Text Length:** ${tr.result.extraction.metadata.extractedLength} characters\n\n`;

      if (tr.result.extraction.metadata.cleaningMetadata) {
        const cm = tr.result.extraction.metadata.cleaningMetadata;
        md += '### Content Cleaning Summary\n\n';
        md += `- **Chrome Removed:** ${cm.chromeRemoved ? 'Yes' : 'No'}\n`;
        md += `- **Main Content Found:** ${cm.mainContentFound ? 'Yes' : 'No'}\n`;
        if (cm.removedElements.length > 0) {
          md += `- **Removed Element Types:** ${cm.removedElements.join(', ')}\n`;
        }
        md += '\n';
      }

      md += '### Extracted Text Preview\n\n';
      const preview = tr.result.extraction.text.substring(0, 2000);
      md += '```\n' + preview + '\n```\n\n';

      md += '### Detected Section Headings\n\n';
      const headings = tr.result.sections.filter((s) => s.heading).slice(0, 20);
      if (headings.length > 0) {
        headings.forEach((s, i) => {
          md += `${i + 1}. ${s.heading}\n`;
        });
        md += '\n';
      } else {
        md += '*No section headings detected*\n\n';
      }

      md += '### Clause Candidates Detected\n\n';
      md += `**Total Candidates:** ${tr.result.candidates.length}\n\n`;

      if (tr.result.candidates.length > 0) {
        md += '| Clause Type | Value | Confidence | Matched Phrases |\n';
        md += '|-------------|-------|------------|------------------|\n';
        tr.result.candidates.forEach((c) => {
          const valueStr =
            typeof c.value.value === 'object'
              ? JSON.stringify(c.value.value)
              : String(c.value.value) + (c.value.unit ? ` ${c.value.unit}` : '');
          md += `| ${c.clauseType} | ${valueStr} | ${c.confidence} | ${c.matchedPhrases.join(', ')} |\n`;
        });
        md += '\n';

        md += '#### Candidate Details\n\n';
        tr.result.candidates.forEach((c, i) => {
          md += `**${i + 1}. ${c.clauseType}**\n\n`;
          md += `- **Value:** ${JSON.stringify(c.value)}\n`;
          md += `- **Confidence:** ${c.confidence}\n`;
          md += `- **Source Section:** ${c.sourceSection || 'N/A'}\n`;
          if (c.ambiguityFlags.length > 0) {
            md += `- **Ambiguity Flags:** ${c.ambiguityFlags.join(', ')}\n`;
          }
          if (c.conflictFlags.length > 0) {
            md += `- **Conflict Flags:** ${c.conflictFlags.join(', ')}\n`;
          }
          md += `- **Source Snippet:**\n  > ${c.sourceSnippet.replace(/\n/g, ' ')}\n\n`;
        });
      } else {
        md += '*No clause candidates detected*\n\n';
      }

      md += '### Promoted Rules\n\n';
      md += `**Total Promoted:** ${tr.result.promotedRules.length}\n\n`;

      if (tr.result.promotedRules.length > 0) {
        tr.result.promotedRules.forEach((r, i) => {
          md += `**${i + 1}. ${r.clauseType}**\n\n`;
          md += `- **Value:** ${JSON.stringify(r.value)}\n`;
          md += `- **Confidence:** ${r.confidence}\n`;
          md += `- **Promoted At:** ${r.promotedAt}\n`;
          md += `- **Source Snippet:**\n  > ${r.sourceSnippet.replace(/\n/g, ' ')}\n\n`;
        });
      } else {
        md += '*No rules met promotion criteria*\n\n';
      }

      if (tr.expectedClauses) {
        md += '### Expected Clauses Comparison\n\n';

        if (tr.missingClauses.length > 0) {
          md += '**Missing Expected Clauses:**\n\n';
          tr.missingClauses.forEach((c) => md += `- ❌ ${c}\n`);
          md += '\n';
        } else {
          md += '✓ All required clauses detected\n\n';
        }

        if (tr.unexpectedClauses.length > 0) {
          md += '**Unexpected Clauses:**\n\n';
          tr.unexpectedClauses.forEach((c) => md += `- ⚠️ ${c}\n`);
          md += '\n';
        }
      }
    } else {
      md += `**Extraction Error:** ${tr.result.extraction.error}\n\n`;
    }

    if (tr.result.warnings.length > 0) {
      md += '### Warnings\n\n';
      tr.result.warnings.forEach((w) => md += `- ⚠️ ${w}\n`);
      md += '\n';
    }

    if (tr.result.errors.length > 0) {
      md += '### Errors\n\n';
      tr.result.errors.forEach((e) => md += `- ❌ ${e}\n`);
      md += '\n';
    }

    md += '---\n\n';
  }

  fs.writeFileSync(HUMAN_OUTPUT, md);
}

function printSummary(testResults: TestResult[]): void {
  console.log();
  console.log('Summary by File:');
  console.log();

  for (const tr of testResults) {
    console.log(`${tr.fileName}:`);
    console.log(`  Sections: ${tr.result.sections.length}`);
    console.log(`  Candidates: ${tr.result.candidates.length}`);
    console.log(`  Promoted: ${tr.result.promotedRules.length}`);

    const candidatesByType = new Map<string, number>();
    tr.result.candidates.forEach((c) => {
      candidatesByType.set(c.clauseType, (candidatesByType.get(c.clauseType) || 0) + 1);
    });

    if (candidatesByType.size > 0) {
      console.log('  Detected clause types:');
      Array.from(candidatesByType.entries()).forEach(([type, count]) => {
        console.log(`    - ${type}: ${count}`);
      });
    }

    if (tr.missingClauses.length > 0) {
      console.log(`  ❌ Missing clauses: ${tr.missingClauses.join(', ')}`);
    }

    console.log();
  }

  const totalCandidates = testResults.reduce((sum, tr) => sum + tr.result.candidates.length, 0);
  const totalPromoted = testResults.reduce((sum, tr) => sum + tr.result.promotedRules.length, 0);

  console.log('Overall Statistics:');
  console.log(`  Total candidates detected: ${totalCandidates}`);
  console.log(`  Total rules promoted: ${totalPromoted}`);
  console.log(`  Promotion rate: ${totalCandidates > 0 ? ((totalPromoted / totalCandidates) * 100).toFixed(1) : 0}%`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
