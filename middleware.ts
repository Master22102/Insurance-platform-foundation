import { NextResponse } from 'next/server';

// Auth is handled entirely client-side by AuthProvider in app/(app)/layout.tsx.
// Middleware just passes through — no cookie checks needed.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
