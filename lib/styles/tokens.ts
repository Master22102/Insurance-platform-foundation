export const colors = {
  // Primary brand
  navy: '#1A2B4A',
  blue: '#2E5FA3',
  lightBlue: '#eff4fc',

  // Status
  success: '#059669',
  successBg: '#ecfdf5',
  warning: '#d97706',
  warningBg: '#fffbeb',
  error: '#dc2626',
  errorBg: '#fef2f2',
  info: '#0369a1',
  infoBg: '#f0f9ff',

  // Neutral
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textTertiary: '#94a3b8',
  border: '#e5e7eb',
  borderLight: '#f0f0f0',
  backgroundPrimary: '#ffffff',
  backgroundSecondary: '#f7f8fa',
  backgroundTertiary: '#fafafa',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

/** Layout constants (e.g. app shell tab bar clearance on mobile). */
export const layout = {
  mobileTabBarClearance: 120,
} as const;

/** Minimum touch targets (iOS HIG / Material). */
export const touch = {
  minTap: 44,
  inputMinHeight: 48,
} as const;
