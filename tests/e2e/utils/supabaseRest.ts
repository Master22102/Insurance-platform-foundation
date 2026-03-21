import fs from 'node:fs';
import path from 'node:path';
import type { APIRequestContext } from '@playwright/test';
import { STORAGE_STATE_PATH } from './authState';

export type RpcResult = { data: unknown; error: unknown; status: number };

type StorageStateJson = {
  origins?: Array<{ localStorage?: Array<{ name: string; value: string }> }>;
  cookies?: Array<{ name: string; value: string }>;
};

/** Supabase SSR cookie: `base64-<base64(json)>` with `access_token` inside. */
function parseSupabaseAuthCookieValue(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let payload = raw.trim();
  if (payload.startsWith('base64-')) {
    payload = payload.slice('base64-'.length);
    try {
      const json = Buffer.from(payload, 'base64').toString('utf8');
      const parsed = JSON.parse(json) as { access_token?: string };
      if (parsed?.access_token && String(parsed.access_token).length > 0) return parsed.access_token;
    } catch {
      return null;
    }
    return null;
  }
  try {
    const decoded = decodeURIComponent(payload);
    const parsed = JSON.parse(decoded) as { access_token?: string };
    if (parsed?.access_token) return parsed.access_token;
  } catch {
    // ignore
  }
  try {
    const parsed = JSON.parse(payload) as { access_token?: string };
    if (parsed?.access_token) return parsed.access_token;
  } catch {
    // ignore
  }
  return null;
}

/** Extract JWT from saved `storageState.json` (localStorage and/or `sb-*-auth-token` cookies). */
export function readAccessTokenFromStorageStateFile(filePath: string): string | null {
  const p = path.resolve(filePath);
  if (!fs.existsSync(p)) return null;
  let json: StorageStateJson;
  try {
    json = JSON.parse(fs.readFileSync(p, 'utf8')) as StorageStateJson;
  } catch {
    return null;
  }

  for (const origin of json.origins ?? []) {
    for (const entry of origin.localStorage ?? []) {
      if (typeof entry.name === 'string' && entry.name.includes('auth-token')) {
        try {
          const parsed = JSON.parse(entry.value) as { access_token?: string };
          if (parsed?.access_token) return parsed.access_token;
        } catch {
          const fromCookieStyle = parseSupabaseAuthCookieValue(entry.value);
          if (fromCookieStyle) return fromCookieStyle;
        }
      }
    }
  }

  for (const c of json.cookies ?? []) {
    if (typeof c.name === 'string' && c.name.includes('auth-token')) {
      const token = parseSupabaseAuthCookieValue(c.value);
      if (token) return token;
    }
  }

  return null;
}

/** Read at call time so env loaded after playwright.config runs (e.g. dotenv / loadEnvConfig) is visible. */
function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}
function getSupabaseAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function hasSupabaseEnv(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

/** Read Supabase JWT from Playwright storage state (localStorage and Supabase cookies). */
export function readAccessTokenFromStorageState(): string | null {
  return readAccessTokenFromStorageStateFile(STORAGE_STATE_PATH);
}

export async function supabaseRpc(
  request: APIRequestContext,
  accessToken: string,
  fnName: string,
  body: Record<string, unknown>,
): Promise<RpcResult> {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  if (!supabaseUrl || !supabaseAnonKey) {
    return { data: null, error: 'missing env', status: 500 };
  }
  const res = await request.post(`${supabaseUrl}/rest/v1/rpc/${fnName}`, {
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    data: body,
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { data, error: res.ok() ? null : data, status: res.status() };
}

export async function supabaseRestSelect<T = unknown>(
  request: APIRequestContext,
  accessToken: string,
  table: string,
  query: string,
): Promise<T> {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase env');
  }
  const res = await request.get(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok()) {
    throw new Error(`REST select failed: ${table} ${res.status()}`);
  }
  return res.json() as Promise<T>;
}
