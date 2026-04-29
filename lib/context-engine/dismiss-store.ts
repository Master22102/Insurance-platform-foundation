/** Stored in `user_profiles.preferences.contextual_dismissals` as `string[]` of `tripId:contextKey`. */

export function isDismissed(tripId: string, contextKey: string, dismissals: string[]): boolean {
  return dismissals.includes(`${tripId}:${contextKey}`);
}

export function addDismissal(tripId: string, contextKey: string, current: string[]): string[] {
  const key = `${tripId}:${contextKey}`;
  if (current.includes(key)) return current;
  return [...current, key];
}

export function parseDismissalsFromPreferences(preferences: unknown): string[] {
  if (!preferences || typeof preferences !== 'object') return [];
  const raw = (preferences as { contextual_dismissals?: unknown }).contextual_dismissals;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string');
}

export function mergeDismissalsIntoPreferences(
  preferences: Record<string, unknown> | null | undefined,
  nextDismissals: string[],
): Record<string, unknown> {
  const base =
    preferences && typeof preferences === 'object' ? { ...preferences } : {};
  return {
    ...base,
    contextual_dismissals: nextDismissals,
  };
}
