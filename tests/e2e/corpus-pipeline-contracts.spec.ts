// Acquisition status — update after each acquire.py run:
// PRE-EXISTING ON DISK: EU261, DOT, Montreal, UK CAA, Delta pet, Allianz pet,
//   Alaska/American/JetBlue/United CoCs, Capital One Venture X, Carnival, Royal Caribbean,
//   Allianz OneTrip, TravelGuard AIG, USDA APHIS, Citi Strata Premier
// PENDING (Patchright required): southwest_pet_policy, alaska_airlines_pet_policy,
//   allegiant_pet_policy, air_canada_coc, air_canada_pet_policy, ana_coc, eva_air_coc,
//   turkish_airlines_pet_policy
// PENDING (navigate_then_download + Referer): emirates_coc, cathay_pacific_coc_v2,
//   tap_air_portugal_coc

import { expect, test } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Corpus pipeline integrity (registry + acquire script).
 * Doctrine: §12.3 pipelines, §9.4 traceability (registry shape).
 */
function pythonBin(): string {
  if (process.env.PYTHON?.trim()) return process.env.PYTHON.trim();
  // Windows: prefer Python launcher (Store "python" alias often missing).
  return process.platform === 'win32' ? 'py -3' : 'python3';
}

function sh(cmd: string, cwd: string) {
  execSync(cmd, { cwd, stdio: 'pipe', timeout: 120_000, shell: process.platform === 'win32' });
}

test.describe('Corpus pipeline contracts (§12.3 / §9.4)', () => {
  const registryPath = path.join(process.cwd(), 'corpus', 'active', 'corpus-registry.json');
  const py = pythonBin();

  test('corpus-registry.json exists and is valid JSON', () => {
    expect(fs.existsSync(registryPath)).toBe(true);
    const raw = fs.readFileSync(registryPath, 'utf-8');
    const reg = JSON.parse(raw);
    expect(reg.documents).toBeDefined();
    expect(Array.isArray(reg.documents)).toBe(true);
  });

  test('registry has at least 14 validated documents (latest snapshot per corpus_id)', () => {
    const reg = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    const validated = reg.documents.filter((d: { validated?: boolean }) => d.validated === true);
    expect(validated.length).toBeGreaterThanOrEqual(14);
  });

  test('all validated documents have required fields (§9.4 traceability)', () => {
    const reg = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    const required = [
      'filename',
      'source_url',
      'retrieved_at',
      'validated',
      'corpus_status',
      'document_type',
      'provider_name',
      'catalog_type',
    ];
    for (const doc of reg.documents.filter((d: { validated?: boolean }) => d.validated)) {
      for (const field of required) {
        expect(doc[field], `Document missing field '${field}': ${doc.filename}`).toBeDefined();
      }
    }
  });

  test('all validated documents reference files of non-zero size', () => {
    const reg = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    for (const doc of reg.documents.filter((d: { validated?: boolean }) => d.validated && d.filename)) {
      expect(doc.file_size_bytes, `${doc.filename} missing file_size_bytes`).toBeGreaterThan(0);
    }
  });

  test('EU261 is in registry (critical routing document)', () => {
    const reg = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    const eu261 = reg.documents.find((d: { filename?: string }) => d.filename?.includes('EU261'));
    expect(eu261).toBeDefined();
    expect(eu261.validated).toBe(true);
    expect(eu261.catalog_type).toBe('other');
    expect(eu261.extraction_priority).toBe(1);
  });

  test('TravelGuard insurance policy is in registry', () => {
    const reg = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    const tg = reg.documents.find(
      (d: { provider_name?: string }) =>
        d.provider_name?.includes('AIG') || d.provider_name?.includes('Travel Guard'),
    );
    expect(tg).toBeDefined();
    expect(tg.validated).toBe(true);
    expect(tg.catalog_type).toBe('travel_insurance');
  });

  test('acquire.py exists and --help runs without error', () => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'corpus', 'acquire.py');
    expect(fs.existsSync(scriptPath)).toBe(true);
    expect(() => {
      sh(`${py} scripts/corpus/acquire.py --help`, process.cwd());
    }).not.toThrow();
  });

  test('acquire.py --validate-only runs without crashing', () => {
    expect(() => {
      sh(`${py} scripts/corpus/acquire.py --validate-only`, process.cwd());
    }).not.toThrow();
  });

  test('acquire.py --dry-run runs without crashing', () => {
    expect(() => {
      sh(`${py} scripts/corpus/acquire.py --dry-run`, process.cwd());
    }).not.toThrow();
  });

  test('acquire.py --id usda_aphis_pet --dry-run runs without crashing', () => {
    expect(() => {
      sh(`${py} scripts/corpus/acquire.py --id usda_aphis_pet --dry-run`, process.cwd());
    }).not.toThrow();
  });

  test('all 15 pre-existing corpus files have a SOURCES recipe in acquire.py', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'scripts', 'corpus', 'acquire.py'),
      'utf-8',
    );
    const outputFilenames = [...src.matchAll(/"output_filename":\s*"([^"]+)"/g)].map(m => m[1]);
    const required = [
      'airline/Alaska_Airlines_Contract_of_Carriage.html',
      'airline/American_Airlines_Conditions_of_Carriage.html',
      'airline/JetBlue_Contract_of_Carriage.pdf',
      'airline/United_Airlines_Contract_of_Carriage.pdf',
      'credit_card/Capital_One_Venture_X_Guide_to_Benefits.pdf',
      'cruise/Carnival_Cruise_Ticket_Contract.html',
      'cruise/RoyalCaribbean_Cruise_Ticket_Contract.html',
      'insurance/Allianz_OneTrip_Premier_Certificate.pdf',
      'insurance/TravelGuard_AIG_Policy_Certificate.pdf',
      'pet/Allianz_Pet_Policy.html',
      'pet/Delta_Pet_Policy.html',
      'regulatory/EU261_Regulation_2004.html',
      'regulatory/Montreal_Convention_1999.pdf',
      'regulatory/UK_CAA_Passenger_Rights.html',
      'regulatory/US_DOT_Fly_Rights_Compiled.html',
    ];
    for (const fn of required) {
      expect(outputFilenames, `Missing recipe for: ${fn}`).toContain(fn);
    }
  });

  test('no duplicate source IDs in acquire.py', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'scripts', 'corpus', 'acquire.py'),
      'utf-8',
    );
    const ids = [...src.matchAll(/"id":\s*"([^"]+)"/g)].map(m => m[1]);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes, `Duplicate source IDs: ${dupes.join(', ')}`).toHaveLength(0);
  });

  test('no duplicate output_filenames in acquire.py', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'scripts', 'corpus', 'acquire.py'),
      'utf-8',
    );
    const fns = [...src.matchAll(/"output_filename":\s*"([^"]+)"/g)].map(m => m[1]);
    const dupes = fns.filter((fn, i) => fns.indexOf(fn) !== i);
    expect(dupes, `Duplicate output_filenames: ${dupes.join(', ')}`).toHaveLength(0);
  });

  test('--validate-only shows no SKIP for pre-existing on-disk files', () => {
    const output = execSync(`${py} scripts/corpus/acquire.py --validate-only`, {
      cwd: process.cwd(),
      encoding: 'utf-8',
      timeout: 120_000,
      shell: process.platform === 'win32',
    });
    const preExistingIds = [
      'eu261_regulation',
      'us_dot_fly_rights',
      'montreal_convention',
      'uk_caa_passenger_rights',
      'alaska_airlines_coc',
      'american_airlines_coc',
      'jetblue_coc',
      'united_airlines_coc',
      'capital_one_venture_x',
      'carnival_cruise_contract',
      'royal_caribbean_cruise_contract',
      'allianz_onetrip_premier',
      'travel_guard_aig',
      'allianz_pet_policy',
      'delta_pet_policy',
    ];
    for (const id of preExistingIds) {
      expect(output, `${id} should not be SKIP — file exists on disk`).not.toMatch(
        new RegExp(`\\[SKIP\\]\\s+${id}`),
      );
    }
  });

  test('--dry-run succeeds for all new source IDs', () => {
    const ids = [
      'american_airlines_pet_policy',
      'alaska_airlines_pet_policy',
      'allegiant_pet_policy',
      'turkish_airlines_pet_policy',
      'delta_pet_policy',
      'southwest_pet_policy',
      'jetblue_pet_policy',
      'ana_pet_policy',
      'qatar_airways_coc',
      'turkish_airlines_coc',
      'cathay_pacific_coc_v2',
      'emirates_coc',
      'emirates_dangerous_goods',
      'ana_coc',
      'eva_air_coc',
      'tap_air_portugal_coc',
      'air_canada_coc',
      'air_canada_pet_policy',
      'cdc_dog_import',
      'maff_aqs_japan',
      'eu_pet_movement_non_eu',
      'eu_pet_movement_within_eu',
      'alaska_airlines_coc',
      'american_airlines_coc',
      'jetblue_coc',
      'united_airlines_coc',
      'eu261_regulation',
      'montreal_convention',
      'uk_caa_passenger_rights',
      'us_dot_fly_rights',
    ];
    for (const id of ids) {
      expect(() => {
        sh(`${py} scripts/corpus/acquire.py --id ${id} --dry-run`, process.cwd());
      }, `--dry-run failed for: ${id}`).not.toThrow();
    }
  });

  test('known_values.json exists and is valid JSON', () => {
    const p = path.join(process.cwd(), 'scripts', 'corpus', 'known_values.json');
    expect(fs.existsSync(p)).toBe(true);
    const kv = JSON.parse(fs.readFileSync(p, 'utf-8'));
    expect(typeof kv).toBe('object');
    expect(Object.keys(kv).length).toBeGreaterThan(5);
  });

  test('validate_corpus.py exists and runs without error', () => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'corpus', 'validate_corpus.py');
    expect(fs.existsSync(scriptPath)).toBe(true);
    expect(() => {
      sh(`${py} scripts/corpus/validate_corpus.py --help`, process.cwd());
    }).not.toThrow();
  });

  test('EU261 passes semantic validation', () => {
    const eu261 = path.join(process.cwd(), 'corpus', 'active', 'regulatory', 'EU261_Regulation_2004.html');
    if (!fs.existsSync(eu261)) {
      console.log('EU261 not on disk — skipping semantic test');
      return;
    }
    expect(() => {
      sh(`${py} scripts/corpus/validate_corpus.py --id eu261_regulation`, process.cwd());
    }).not.toThrow();
  });

  test('Delta pet policy passes semantic validation', () => {
    const delta = path.join(process.cwd(), 'corpus', 'active', 'pet', 'Delta_Pet_Policy.html');
    if (!fs.existsSync(delta)) {
      console.log('Delta pet policy not on disk — skipping');
      return;
    }
    expect(() => {
      sh(`${py} scripts/corpus/validate_corpus.py --id delta_pet_policy`, process.cwd());
    }).not.toThrow();
  });

  test('Montreal Convention passes semantic validation', () => {
    const montreal = path.join(
      process.cwd(),
      'corpus',
      'active',
      'regulatory',
      'Montreal_Convention_1999.pdf',
    );
    if (!fs.existsSync(montreal)) {
      console.log('Montreal Convention not on disk — skipping');
      return;
    }
    expect(() => {
      sh(`${py} scripts/corpus/validate_corpus.py --id montreal_convention`, process.cwd());
    }).not.toThrow();
  });

  test('patchright is installed and importable', () => {
    expect(() => {
      sh(`${py} -c "from patchright.sync_api import sync_playwright; print('ok')"`, process.cwd());
    }).not.toThrow();
  });
});
