'use client';

import type { CSSProperties } from 'react';
import { useIsMobile, useIsTablet } from '@/lib/hooks/useIsMobile';
import { mobileStyles, tabletStyles } from '@/lib/styles/responsive';

/**
 * Root styles for pages under `app/(app)/layout` main: shell already pads bottom for the tab bar.
 */
export function useAppPageSurface(extra: CSSProperties = {}): CSSProperties {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const base: CSSProperties = isMobile
    ? mobileStyles.appContentMobile
    : isTablet
      ? tabletStyles.appContent
      : {};
  return { ...base, ...extra };
}
