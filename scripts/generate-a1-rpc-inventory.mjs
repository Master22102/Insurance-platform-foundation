#!/usr/bin/env node
/**
 * A1 — RPC inventory from supabase/migrations/*.sql (heuristic risk flags).
 * Writes docs/A1_RPC_INVENTORY.md and scripts/a1-rpc-inventory.json
 *
 * Usage: node scripts/generate-a1-rpc-inventory.mjs [--check]
 * --check: exit 1 if unlisted HIGH-risk functions exist vs scripts/a1-rpc-inventory-baseline.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const outMd = path.join(root, 'docs', 'A1_RPC_INVENTORY.md');
const outJson = path.join(root, 'scripts', 'a1-rpc-inventory.json');
const baselinePath = path.join(root, 'scripts', 'a1-rpc-inventory-baseline.json');

function extractFunctionsFromFile(filePath, relativeName) {
  const sql = fs.readFileSync(filePath, 'utf8');
  /** @type {Array<{name:string,file:string,security:string,hasAuthUid:boolean,hasUserParams:boolean,risk:string,notes:string}>} */
  const rows = [];

  const chunks = sql.split(/(?=^CREATE\s+OR\s+REPLACE\s+FUNCTION\s+)/im);
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed.toUpperCase().startsWith('CREATE OR REPLACE FUNCTION')) continue;

    const nameMatch = trimmed.match(
      /^CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/im,
    );
    if (!nameMatch) continue;
    const name = nameMatch[1];

    const header = trimmed.split(/AS\s+\$\$/i)[0] || trimmed;
    const securityDefiner = /SECURITY\s+DEFINER/i.test(header);
    const securityInvoker = /SECURITY\s+INVOKER/i.test(header);

    const bodyMatch = trimmed.match(/AS\s+\$\$\s*([\s\S]*?)\r?\n\$\$\s*;/);
    const body = bodyMatch ? bodyMatch[1] : '';
    // Scan full function text — body-only parse misses nested blocks / alternate dollar-quotes.
    const hasAuthUid = /\bauth\.uid\s*\(/i.test(trimmed);
    const hasJwt = /\bauth\.jwt\s*\(/i.test(trimmed);
    const hasUserParams =
      /\bp_user_id\b/i.test(trimmed) ||
      /\bp_actor_id\b/i.test(trimmed) ||
      /\bp_account_id\b/i.test(trimmed);

    let security = 'implicit';
    if (securityDefiner) security = 'DEFINER';
    else if (securityInvoker) security = 'INVOKER';

    let risk = 'review';
    let notes = [];

    if (security === 'INVOKER') {
      risk = 'lower';
      notes.push('SECURITY INVOKER (RLS applies).');
    } else if (securityDefiner) {
      if (hasAuthUid || hasJwt) {
        risk = 'mitigated';
        notes.push('References auth.uid() / auth.jwt() in body.');
      } else if (!hasUserParams) {
        risk = 'medium';
        notes.push('DEFINER but no obvious auth.uid() — may be internal/trusted-only; verify grants.');
      } else {
        risk = 'high';
        notes.push('DEFINER + user/actor params but no auth.uid() in parsed body — **manual review**.');
      }
    } else {
      notes.push('Security clause not explicit in header; Postgres default is typically INVOKER — verify.');
      risk = 'review';
    }

    rows.push({
      name,
      file: relativeName,
      security,
      hasAuthUid,
      hasUserParams,
      risk,
      notes: notes.join(' '),
    });
  }
  return rows;
}

function main() {
  const check = process.argv.includes('--check');
  if (!fs.existsSync(migrationsDir)) {
    console.error('No supabase/migrations directory');
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  /** @type {typeof rows} */
  let all = [];
  for (const f of files) {
    const fp = path.join(migrationsDir, f);
    all = all.concat(extractFunctionsFromFile(fp, `supabase/migrations/${f}`));
  }

  const byName = new Map();
  for (const row of all) {
    const prev = byName.get(row.name);
    if (!prev || row.file > prev.file) byName.set(row.name, row);
  }
  const latest = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));

  const high = latest.filter((r) => r.risk === 'high');
  const medium = latest.filter((r) => r.risk === 'medium');
  const mitigated = latest.filter((r) => r.risk === 'mitigated');
  const lower = latest.filter((r) => r.risk === 'lower');
  const review = latest.filter((r) => r.risk === 'review');

  const md = `# A1 — RPC inventory (generated)

**Purpose:** Systematic view of **Postgres RPCs** in \`supabase/migrations\` for **tenant isolation / auth binding** (\`SHIP_BAR\` **A1**).

**How generated:** \`node scripts/generate-a1-rpc-inventory.mjs\` — parses \`CREATE OR REPLACE FUNCTION\` blocks (heuristic). **Not** a substitute for manual review or penetration testing.

**Risk labels (heuristic):**

| Label | Meaning |
|-------|---------|
| **high** | \`SECURITY DEFINER\`, has \`p_user_id\` / \`p_actor_id\` / \`p_account_id\`, parsed body has **no** \`auth.uid()\` / \`auth.jwt()\` — **review first**. |
| **medium** | \`SECURITY DEFINER\`, no user-id params in signature, no \`auth.uid\` in body — may be internal; verify \`GRANT\` / caller. |
| **mitigated** | \`SECURITY DEFINER\` and body references \`auth.uid()\` / \`auth.jwt()\`. |
| **lower** | \`SECURITY INVOKER\` (RLS applies to table access). |
| **review** | Ambiguous header — confirm invoker vs definer in SQL. |

## Summary

| Bucket | Count |
|--------|-------|
| **high** | ${high.length} |
| **medium** | ${medium.length} |
| **mitigated** | ${mitigated.length} |
| **lower** | ${lower.length} |
| **review** | ${review.length} |
| **Total (latest definition per name)** | ${latest.length} |

## HIGH (${high.length})

${high.length ? high.map((r) => `| \`${r.name}\` | ${r.file} | ${r.notes} |`).join('\n') : '| — | — | None flagged by heuristic. |'}

## MEDIUM (${medium.length})

${medium.slice(0, 40).map((r) => `| \`${r.name}\` | ${r.file} |`).join('\n')}
${medium.length > 40 ? `\n| … | … | _${medium.length - 40} more — see JSON._ |` : ''}

## MITIGATED (sample — first 25)

${mitigated.slice(0, 25).map((r) => `| \`${r.name}\` | ${r.file} |`).join('\n')}
${mitigated.length > 25 ? `\n| … | … | _${mitigated.length - 25} more in \`scripts/a1-rpc-inventory.json\`._ |` : ''}

## Related

- \`docs/A1_EXCEPTIONS.md\` — intentional service-role / internal RPCs.
- \`npm run verify:a1-inventory\` — optional CI check vs baseline.
- Regenerate after migration changes.

*Generated: ${new Date().toISOString().slice(0, 10)}*
`;

  fs.writeFileSync(outMd, md, 'utf8');
  fs.writeFileSync(
    outJson,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        summary: {
          high: high.length,
          medium: medium.length,
          mitigated: mitigated.length,
          lower: lower.length,
          review: review.length,
          total: latest.length,
        },
        functions: latest,
        highNames: high.map((r) => r.name).sort(),
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(`generate-a1-rpc-inventory: wrote ${path.relative(root, outMd)} + ${path.relative(root, outJson)}`);
  console.log(`  high=${high.length} medium=${medium.length} mitigated=${mitigated.length}`);

  if (check) {
    if (!fs.existsSync(baselinePath)) {
      console.error(`Missing ${baselinePath}; copy scripts/a1-rpc-inventory.json "highNames" to "allowedHighRiskNames" in baseline, or run: npm run generate:a1-inventory`);
      process.exit(1);
    }
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const allowed = new Set(baseline.allowedHighRiskNames || []);
    const bad = high.map((r) => r.name).filter((n) => !allowed.has(n));
    if (bad.length) {
      console.error('verify:a1-inventory: NEW high-risk functions not in baseline:', bad.join(', '));
      process.exit(1);
    }
    console.log('verify:a1-inventory: OK (no new unlisted HIGH functions).');
  }
}

main();
