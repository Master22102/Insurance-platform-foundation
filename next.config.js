/** @type {import('next').NextConfig} */
/**
 * Content-Security-Policy — default Report-Only (audit without blocking).
 * Set CSP_MODE=enforce at build time to send blocking Content-Security-Policy
 * with the *same* directive set (only after triage; see docs/SECURITY_BROWSER_HARDENING.md).
 * Relaxed for Next 13 + inline styles; connect-src allows HTTPS/WSS (Supabase + APIs).
 */
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "media-src 'self' https:",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const cspMode = process.env.CSP_MODE === 'enforce' ? 'enforce' : 'report-only';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  /* Scan + narrate flows need camera/microphone; keep geolocation off by default. */
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
  cspMode === 'enforce'
    ? { key: 'Content-Security-Policy', value: cspDirectives }
    : { key: 'Content-Security-Policy-Report-Only', value: cspDirectives },
];

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer'],
  },
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
