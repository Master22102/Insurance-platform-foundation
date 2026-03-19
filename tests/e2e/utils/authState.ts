import fs from 'node:fs';
import path from 'node:path';

export const STORAGE_STATE_PATH = path.join(process.cwd(), '.playwright', 'storageState.json');

export function hasStorageState(): boolean {
  return fs.existsSync(STORAGE_STATE_PATH);
}

