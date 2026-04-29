'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useAppPageSurface } from '@/lib/hooks/useAppPageSurface';

/** Standard root for authenticated pages: applies mobile/tablet insets (shell owns tab-bar clearance). */
export default function AppPageRoot({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const surface = useAppPageSurface(style ?? {});
  return <div style={surface}>{children}</div>;
}
