/**
 * DIAGNOSTIC: Identify why gold rules aren't being extracted
 */

import * as fs from 'fs';

const gold = JSON.parse(fs.readFileSync('tmp/benchmark/gold-set.json', 'utf-8'));
const extracted = JSON.parse(fs.readFileSync('tmp/verification/all-promoted-rules.json', 'utf-8'));

console.log('EXTRACTION FAILURE DIAGNOSIS');
console.log('============================\n');

// Group extracted by document and clause type
const extractedByDocAndType: Record<string, Record<string, any[]>> = {};
for (const rule of extracted) {
  if (!extractedByDocAndType[rule.documentName]) {
    extractedByDocAndType[rule.documentName] = {};
  }
  if (!extractedByDocAndType[rule.documentName][rule.clauseType]) {
    extractedByDocAndType[rule.documentName][rule.clauseType] = [];
  }
  extractedByDocAndType[rule.documentName][rule.clauseType].push(rule);
}

const missed: any[] = [];
const found: any[] = [];

for (const goldRule of gold) {
  const doc = extractedByDocAndType[goldRule.documentName];
  if (!doc) {
    missed.push({...goldRule, reason: 'DOCUMENT_NOT_PROCESSED'});
    continue;
  }

  const rules = doc[goldRule.clauseType];
  if (!rules || rules.length === 0) {
    missed.push({...goldRule, reason: 'CLAUSE_TYPE_NOT_EXTRACTED'});
    continue;
  }

  // Check if value matches
  const valueMatches = rules.some((r: any) => {
    const extractedVal = r.value?.value || r.value?.amount || String(r.value);
    const goldVal = goldRule.expectedValue;
    return String(extractedVal) === goldVal || Math.abs(parseInt(extractedVal) - parseInt(goldVal)) < 5;
  });

  if (!valueMatches) {
    missed.push({
      ...goldRule,
      reason: 'VALUE_MISMATCH',
      extractedValues: rules.map((r: any) => r.value?.value || r.value?.amount || String(r.value)),
    });
  } else {
    found.push(goldRule);
  }
}

console.log(`Found: ${found.length}/${gold.length}`);
console.log(`Missed: ${missed.length}/${gold.length}\n`);

// Categorize failures
const byReason: Record<string, any[]> = {};
for (const m of missed) {
  if (!byReason[m.reason]) byReason[m.reason] = [];
  byReason[m.reason].push(m);
}

console.log('FAILURE BREAKDOWN:');
Object.entries(byReason).forEach(([reason, rules]) => {
  console.log(`\n${reason}: ${rules.length}`);
  rules.slice(0, 3).forEach((r: any) => {
    console.log(`  - ${r.documentName} :: ${r.clauseType} :: ${r.expectedValue}`);
    if (r.extractedValues) {
      console.log(`    Extracted: ${JSON.stringify(r.extractedValues)}`);
    }
  });
  if (rules.length > 3) {
    console.log(`  ... and ${rules.length - 3} more`);
  }
});

console.log('\n\nTOP MISSING CLAUSE TYPES:');
const missingByType: Record<string, number> = {};
for (const m of missed) {
  missingByType[m.clauseType] = (missingByType[m.clauseType] || 0) + 1;
}
Object.entries(missingByType)
  .sort((a, b) => b[1] - a[1])
  .forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
