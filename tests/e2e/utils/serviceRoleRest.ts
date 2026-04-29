import type { APIRequestContext } from '@playwright/test';
import { hasServiceRoleKey } from './e2eEnv';

function supabaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!u) throw new Error('NEXT_PUBLIC_SUPABASE_URL missing');
  return u;
}

function serviceHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    'content-type': 'application/json',
  };
}

export { hasServiceRoleKey };

export async function serviceRoleRpc(
  request: APIRequestContext,
  fn: string,
  body: Record<string, unknown>,
): Promise<{ data: unknown; status: number }> {
  const res = await request.post(`${supabaseUrl()}/rest/v1/rpc/${fn}`, {
    headers: { ...serviceHeaders(), prefer: 'return=representation' },
    data: body,
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { data, status: res.status() };
}

export async function serviceRoleGet<T>(request: APIRequestContext, table: string, query: string): Promise<T> {
  const res = await request.get(`${supabaseUrl()}/rest/v1/${table}?${query}`, {
    headers: serviceHeaders(),
  });
  if (!res.ok()) throw new Error(`service GET ${table} ${res.status()}`);
  return res.json() as Promise<T>;
}

export async function serviceRolePost(
  request: APIRequestContext,
  table: string,
  row: Record<string, unknown>,
  prefer = 'return=representation',
): Promise<{ data: unknown; status: number }> {
  const res = await request.post(`${supabaseUrl()}/rest/v1/${table}`, {
    headers: { ...serviceHeaders(), prefer },
    data: row,
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { data, status: res.status() };
}

export async function serviceRolePatch(
  request: APIRequestContext,
  table: string,
  query: string,
  patch: Record<string, unknown>,
): Promise<{ data: unknown; status: number }> {
  const res = await request.patch(`${supabaseUrl()}/rest/v1/${table}?${query}`, {
    headers: { ...serviceHeaders(), prefer: 'return=representation' },
    data: patch,
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { data, status: res.status() };
}

export async function serviceRoleDelete(request: APIRequestContext, table: string, query: string): Promise<number> {
  const res = await request.delete(`${supabaseUrl()}/rest/v1/${table}?${query}`, {
    headers: serviceHeaders(),
  });
  return res.status();
}
