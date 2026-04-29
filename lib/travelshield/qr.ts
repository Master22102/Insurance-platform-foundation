import QRCode from 'qrcode';

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (typeof process.env.VERCEL_URL === 'string' ? `https://${process.env.VERCEL_URL}` : '') ||
  'http://localhost:3000';

export function getJoinUrl(token: string): string {
  const base = BASE_URL.replace(/\/$/, '');
  return `${base}/join/${encodeURIComponent(token)}`;
}

export async function generateQRCodeSvg(token: string): Promise<string> {
  const url = getJoinUrl(token);
  return QRCode.toString(url, {
    type: 'svg',
    width: 256,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
}
