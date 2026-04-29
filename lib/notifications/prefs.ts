export const NOTIFICATION_CATEGORIES = [
  'travelshield_checkin',
  'travelshield_emergency',
  'presence_alert',
  'presence_border',
  'filing_deadline',
  'coverage_gap',
  'disruption_detected',
  'evidence_reminder',
  'system_announcement',
  'trip_update',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type CategoryChannelPrefs = { push: boolean; email: boolean; sms: boolean };

export type NotificationPrefs = {
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  /** E.164 or empty — required before SMS sends */
  sms_phone_e164?: string;
  categories: Record<string, CategoryChannelPrefs>;
};

const defaultCategoryPrefs = (): CategoryChannelPrefs => ({ push: false, email: false, sms: false });

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  push_enabled: false,
  email_enabled: false,
  sms_enabled: false,
  sms_phone_e164: '',
  categories: Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c, defaultCategoryPrefs()])) as Record<
    string,
    CategoryChannelPrefs
  >,
};

export function mergeNotificationPrefs(raw: unknown): NotificationPrefs {
  const base = JSON.parse(JSON.stringify(DEFAULT_NOTIFICATION_PREFS)) as NotificationPrefs;
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  if (typeof o.push_enabled === 'boolean') base.push_enabled = o.push_enabled;
  if (typeof o.email_enabled === 'boolean') base.email_enabled = o.email_enabled;
  if (typeof o.sms_enabled === 'boolean') base.sms_enabled = o.sms_enabled;
  if (typeof o.sms_phone_e164 === 'string') base.sms_phone_e164 = o.sms_phone_e164;
  const cats = o.categories;
  if (cats && typeof cats === 'object') {
    for (const k of NOTIFICATION_CATEGORIES) {
      const row = (cats as Record<string, unknown>)[k];
      if (row && typeof row === 'object') {
        const r = row as Record<string, unknown>;
        base.categories[k] = {
          push: Boolean(r.push),
          email: Boolean(r.email),
          sms: Boolean(r.sms),
        };
      }
    }
  }
  return base;
}

export function isChannelAllowedForCategory(
  prefs: NotificationPrefs,
  channel: 'push' | 'email' | 'sms' | 'in_app',
  category: string,
): boolean {
  if (channel === 'in_app') return true;
  if (channel === 'push' && !prefs.push_enabled) return false;
  if (channel === 'email' && !prefs.email_enabled) return false;
  if (channel === 'sms' && !prefs.sms_enabled) return false;
  if (channel === 'sms' && !(prefs.sms_phone_e164 || '').trim()) return false;
  const cat = prefs.categories[category];
  if (!cat) return false;
  if (channel === 'push') return cat.push;
  if (channel === 'email') return cat.email;
  return cat.sms;
}
