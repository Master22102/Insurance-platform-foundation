import fs from 'node:fs';
import path from 'node:path';

/**
 * App root for E2E file paths. Read at **call time** (not module load) so `process.env.E2E_PROJECT_ROOT`
 * is visible after `playwright.config.ts` runs in this process.
 */
export function getE2eProjectRoot(): string {
  const fromEnv = process.env.E2E_PROJECT_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(process.cwd());
}

export function getStorageStatePath(): string {
  return path.join(getE2eProjectRoot(), '.playwright', 'storageState.json');
}

export function hasStorageState(): boolean {
  return fs.existsSync(getStorageStatePath());
}
