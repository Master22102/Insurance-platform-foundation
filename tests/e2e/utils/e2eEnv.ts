/**
 * Env flags for E2E (Playwright process; playwright.config loads .env.local).
 */
export function hasOpenRouterKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export function hasServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/** Disposable auth.users id for destructive erasure contract tests. */
export function erasureDisposableUserId(): string | null {
  const v = process.env.E2E_ERASURE_DISPOSABLE_USER_ID?.trim();
  return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}
