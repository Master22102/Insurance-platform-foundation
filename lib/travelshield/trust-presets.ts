export type TrustLevel = 'close_friend' | 'just_met' | 'custom';

export interface TrustPresetValues {
  trust_level: TrustLevel;
  check_in_interval_hours: number;
  deactivation_requires_code: boolean;
  /** When preset clears lock (just_met). */
  clear_lock_code: boolean;
}

export function presetForTrustLevel(level: TrustLevel): TrustPresetValues {
  switch (level) {
    case 'close_friend':
      return {
        trust_level: 'close_friend',
        check_in_interval_hours: 4,
        deactivation_requires_code: true,
        clear_lock_code: false,
      };
    case 'just_met':
      return {
        trust_level: 'just_met',
        check_in_interval_hours: 2,
        deactivation_requires_code: false,
        clear_lock_code: true,
      };
    default:
      return {
        trust_level: 'custom',
        check_in_interval_hours: 2,
        deactivation_requires_code: false,
        clear_lock_code: false,
      };
  }
}
