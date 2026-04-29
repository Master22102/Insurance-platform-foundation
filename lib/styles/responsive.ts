// Shared responsive style helpers
// Avoids duplication across pages

import { colors, layout, radii, spacing, touch } from './tokens';

/**
 * Inside `app/(app)/layout` main content: the shell already applies bottom padding for the
 * tab bar (≤1023px). Use this on page roots to avoid double 120px clearance.
 */
export const mobileStyles = {
  appContentMobile: {
    padding: `${spacing.lg}px ${spacing.md}px 0`,
    boxSizing: 'border-box' as const,
    maxWidth: '100%',
    overflowX: 'hidden' as const,
  },
  /** Full-viewport mobile pages *outside* the app shell (e.g. auth). */
  standalonePageMobile: {
    padding: `${spacing.lg}px ${spacing.md}px ${layout.mobileTabBarClearance}px`,
    boxSizing: 'border-box' as const,
    maxWidth: '100%',
    overflowX: 'hidden' as const,
  },
  /** @deprecated Use appContentMobile inside app layout, or standalonePageMobile off-shell. */
  pageContainer: {
    padding: `${spacing.lg}px ${spacing.md}px ${layout.mobileTabBarClearance}px`,
    boxSizing: 'border-box' as const,
    maxWidth: '100%',
    overflowX: 'hidden' as const,
  },
  sectionCard: {
    background: colors.backgroundPrimary,
    borderRadius: radii.lg,
    border: `0.5px solid ${colors.border}`,
    padding: '14px 16px',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 600 as const,
    color: colors.navy,
    margin: '0 0 8px',
  },
  actionButton: {
    padding: '12px 16px',
    borderRadius: radii.md,
    border: 'none',
    background: colors.navy,
    color: 'white',
    fontSize: 14,
    fontWeight: 600 as const,
    width: '100%',
    minHeight: touch.inputMinHeight,
    cursor: 'pointer' as const,
  },
  secondaryButton: {
    padding: '12px 16px',
    borderRadius: radii.md,
    border: `1px solid ${colors.border}`,
    background: colors.backgroundPrimary,
    color: '#333',
    fontSize: 14,
    fontWeight: 500 as const,
    width: '100%',
    minHeight: touch.inputMinHeight,
    cursor: 'pointer' as const,
  },
  inputField: {
    padding: '12px 14px',
    borderRadius: radii.md,
    border: `1px solid ${colors.border}`,
    fontSize: 15,
    width: '100%',
    minHeight: touch.inputMinHeight,
  },
  badge: (color: string, bg: string) => ({
    fontSize: 11,
    fontWeight: 500 as const,
    padding: '3px 8px',
    borderRadius: 20,
    color,
    background: bg,
    display: 'inline-block' as const,
  }),
};

/** Tablet (768–1023): app shell still shows tab bar; no extra bottom padding on page root. */
export const tabletStyles = {
  appContent: {
    boxSizing: 'border-box' as const,
    maxWidth: '100%' as const,
    overflowX: 'hidden' as const,
    padding: `0 ${spacing.md}px 0`,
  },
};

export const desktopStyles = {
  pageContainer: { padding: '32px 24px' },
  twoColumnLayout: {
    display: 'grid' as const,
    gridTemplateColumns: '1fr 380px',
    gap: 24,
    alignItems: 'start' as const,
  },
};
