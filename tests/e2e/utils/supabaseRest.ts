import fs from 'node:fs';
import path from 'node:path';
import type { APIRequestContext } from '@playwright/test';
import { getStorageStatePath } from './authState';

export type RpcResult = { data: unknown; error: unknown; status: number };

/** Use in `test.skip(!accessToken, …)` so expired JWTs are treated like missing auth. */
export const E2E_AUTH_SKIP_REASON =
  'Missing or **expired** Supabase JWT in `.playwright/storageState.json`. Run `npm run e2e:auth` again (with `npm run dev` running). `.env.local` must use the **same** `NEXT_PUBLIC_SUPABASE_URL` + anon key as the project you sign into. With **@supabase/ssr**, the session is often split across cookies (`…auth-token.0`, `.1`, …); the test helper reassembles those — if you still see this, the **access_token** is likely expired (~1h): save a fresh `storageState.json` after signing in.';

/** @internal Decode JWT `exp` (seconds since epoch). Returns null if not a normal JWT. */
export function readJwtExpUnix(token: string): number | null {
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) return null;
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as { exp?: unknown };
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * True when JWT `exp` is in the past (with skew). Unknown / opaque tokens → false (do not drop).
 */
export function isPlaywrightJwtExpired(token: string, skewSeconds = 120): boolean {
  const exp = readJwtExpUnix(token);
  if (exp == null) return false;
  return Date.now() / 1000 >= exp - skewSeconds;
}

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

/**
 * `@supabase/ssr` stores oversized sessions as multiple cookies: `sb-…-auth-token.0`, `.1`, …
 * (see `node_modules/@supabase/ssr/dist/main/utils/chunker.js`). Playwright saves each chunk
 * separately; we must join them before `parseSupabaseAuthCookieValue`, same as the browser client.
 */
function readAccessTokenFromSupabaseSsrCookies(
  cookies: Array<{ name: string; value: string }>,
): string | null {
  const relevant = cookies.filter(
    (c) => typeof c.name === 'string' && c.name.toLowerCase().includes('auth-token'),
  );
  if (!relevant.length) return null;

  const chunkSuffix = /^(.+)\.(\d+)$/;
  type Group = { monolith?: string; chunks: Array<{ i: number; v: string }> };
  const byBase = new Map<string, Group>();

  for (const c of relevant) {
    const m = c.name.match(chunkSuffix);
    if (m) {
      const base = m[1];
      if (!base.includes('auth-token')) continue;
      const i = Number.parseInt(m[2] ?? '', 10);
      if (!Number.isFinite(i)) continue;
      const g = byBase.get(base) ?? { chunks: [] };
      g.chunks.push({ i, v: c.value });
      byBase.set(base, g);
    } else {
      const g = byBase.get(c.name) ?? { chunks: [] };
      g.monolith = c.value;
      byBase.set(c.name, g);
    }
  }

  for (const [, g] of Array.from(byBase.entries())) {
    if (g.monolith !== undefined) {
      const t = parseSupabaseAuthCookieValue(g.monolith);
      if (t) return t;
    }
    if (g.chunks.length > 0) {
      g.chunks.sort((a: { i: number; v: string }, b: { i: number; v: string }) => a.i - b.i);
      const joined = g.chunks.map((x: { i: number; v: string }) => x.v).join('');
      const t = parseSupabaseAuthCookieValue(joined);
      if (t) return t;
    }
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

  const fromCookies = readAccessTokenFromSupabaseSsrCookies(json.cookies ?? []);
  if (fromCookies) return fromCookies;

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

/**
 * Supabase JWT from Playwright storage state. Returns **null** if missing **or expired**
 * (Supabase access tokens are short-lived; stale `storageState.json` causes REST/RPC **401**).
 * Set `E2E_IGNORE_JWT_EXPIRY=1` only for debugging (tests will still fail at PostgREST if expired).
 */
export function readAccessTokenFromStorageState(): string | null {
  const t = readAccessTokenFromStorageStateFile(getStorageStatePath());
  if (!t) return null;
  if (process.env.E2E_IGNORE_JWT_EXPIRY === '1') return t;
  if (isPlaywrightJwtExpired(t)) return null;
  return t;
}

/** `sub` from access_token JWT — works even when token is **expired** (for E2E setup via service role). */
export function readSupabaseUserIdFromStorageState(): string | null {
  const t = readAccessTokenFromStorageStateFile(getStorageStatePath());
  if (!t) return null;
  const parts = t.split('.');
  if (parts.length < 2 || !parts[1]) return null;
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as { sub?: unknown };
    return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
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

export async function supabaseRestPost<T = unknown>(
  request: APIRequestContext,
  accessToken: string,
  table: string,
  body: Record<string, unknown>,
  prefer?: string,
): Promise<{ data: T; status: number }> {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase env');
  }
  const headers: Record<string, string> = {
    apikey: supabaseAnonKey,
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
  };
  if (prefer) {
    headers.prefer = prefer;
  }
  const res = await request.post(`${supabaseUrl}/rest/v1/${table}`, {
    headers,
    data: body,
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { data: data as T, status: res.status() };
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
    const hint =
      res.status() === 401
        ? ' — JWT expired or wrong Supabase project vs NEXT_PUBLIC_* in .env.local; run `npm run e2e:auth` again.'
        : '';
    throw new Error(`REST select failed: ${table} ${res.status()}${hint}`);
  }
  return res.json() as Promise<T>;
}
