/** @type {import('next').NextConfig} */
/**
 * Content-Security-Policy — default enforce (block violations). Set CSP_MODE=report-only
 * to send Content-Security-Policy-Report-Only for triage (see docs/SECURITY_BROWSER_HARDENING.md).
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

const cspMode = process.env.CSP_MODE === 'report-only' ? 'report-only' : 'enforce';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  /* Scan + narrate flows need camera/microphone; keep geolocation off by default. */
  /* TravelShield (F-6.6.13) opt-in live location uses Geolocation API in-app only. */
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
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
