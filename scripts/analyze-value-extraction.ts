import * as fs from 'fs';
import * as path from 'path';

interface GoldRule {
  documentName: string;
  clauseType: string;
  expectedValue: string | number;
  expectedUnit?: string;
  sourceSnippet: string;
  notes: string;
}

interface ExtractedRule {
  documentName: string;
  clauseType: string;
  value: any;
  sourceSnippet: string;
  confidence: string;
  sourcePath?: string;
}

interface ValueExtractionExample {
  documentName: string;
  clauseType: string;
  goldValue: string | number;
  sourceText: string;
  extracted: Array<{
    value: any;
    snippet: string;
    allNumbersInSnippet: Array<{value: number; context: string}>;
  }>;
  status: 'CORRECT' | 'WRONG_VALUE' | 'NOT_EXTRACTED';
}

function loadGoldSet(): GoldRule[] {
  const goldPath = path.join(process.cwd(), 'tmp/benchmark/gold-set.json');
  return JSON.parse(fs.readFileSync(goldPath, 'utf-8'));
}

function loadExtractedRules(): ExtractedRule[] {
  const extractedPath = path.join(process.cwd(), 'tmp/verification/all-promoted-rules.json');
  return JSON.parse(fs.readFileSync(extractedPath, 'utf-8'));
}

function normalizeValue(value: any): string {
  if (typeof value === 'object' && value.value !== undefined) {
    return String(value.value);
  }
  return String(value).toLowerCase().trim();
}

function extractAllNumbersFromText(text: string): Array<{value: number; context: string}> {
  const numbers: Array<{value: number; context: string}> = [];

  // Currency patterns
  const currencyRegex = /\$\s*([\d,]+(?:\.\d{2})?)/g;
  let match;
  while ((match = currencyRegex.exec(text)) !== null) {
    const start = Math.max(0, match.index - 30);
    const end = Math.min(text.length, match.index + match[0].length + 30);
    const context = text.substring(start, end);
    numbers.push({
      value: parseFloat(match[1].replace(/,/g, '')),
      context: context
    });
  }

  // Plain numbers
  const numberRegex = /\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\b/g;
  while ((match = numberRegex.exec(text)) !== null) {
    const val = parseFloat(match[1].replace(/,/g, ''));
    if (val > 0 && val < 1000000) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      const context = text.substring(start, end);
      numbers.push({
        value: val,
        context: context
      });
    }
  }

  return numbers;
}

function analyzeValueExtraction(): ValueExtractionExample[] {
  const goldRules = loadGoldSet();
  const extractedRules = loadExtractedRules();

  const examples: ValueExtractionExample[] = [];

  for (const gold of goldRules.slice(0, 20)) { // First 20 examples
    const matches = extractedRules.filter(
      e => e.documentName === gold.documentName && e.clauseType === gold.clauseType
    );

    const extracted = matches.map(m => ({
      value: m.value,
      snippet: m.sourceSnippet,
      allNumbersInSnippet: extractAllNumbersFromText(m.sourceSnippet)
    }));

    let status: 'CORRECT' | 'WRONG_VALUE' | 'NOT_EXTRACTED' = 'NOT_EXTRACTED';

    if (matches.length > 0) {
      const goldNorm = normalizeValue(gold.expectedValue);
      const hasMatch = matches.some(m => normalizeValue(m.value.value) === goldNorm);
      status = hasMatch ? 'CORRECT' : 'WRONG_VALUE';
    }

    examples.push({
      documentName: gold.documentName,
      clauseType: gold.clauseType,
      goldValue: gold.expectedValue,
      sourceText: gold.sourceSnippet,
      extracted,
      status
    });
  }

  return examples;
}

console.log('VALUE EXTRACTION ANALYSIS');
console.log('='.repeat(80));
console.log('');

const examples = analyzeValueExtraction();

for (const ex of examples) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Document: ${ex.documentName}`);
  console.log(`Clause Type: ${ex.clauseType}`);
  console.log(`Status: ${ex.status}`);
  console.log('');
  console.log(`GOLD STANDARD:`);
  console.log(`  Expected Value: ${ex.goldValue}`);
  console.log(`  Source Text: ${ex.sourceText.substring(0, 200)}...`);
  console.log('');

  if (ex.extracted.length > 0) {
    console.log(`EXTRACTED (${ex.extracted.length} rules):`);
    ex.extracted.forEach((e, i) => {
      console.log(`  [${i+1}] Value: ${JSON.stringify(e.value.value)} (${e.value.type})`);
      console.log(`      Snippet: ${e.snippet.substring(0, 150)}...`);
      console.log(`      Numbers found in snippet:`);
      e.allNumbersInSnippet.slice(0, 5).forEach(n => {
        console.log(`        - ${n.value} in context: "...${n.context}..."`);
      });
    });
  } else {
    console.log(`NOT EXTRACTED - No rules found`);
  }
}

// Save detailed examples
const outputPath = path.join(process.cwd(), 'tmp/benchmark/value-extraction-examples.json');
fs.writeFileSync(outputPath, JSON.stringify(examples, null, 2));
console.log(`\n\n✓ Detailed examples saved to ${outputPath}`);
