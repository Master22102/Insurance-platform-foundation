/** Minimal IATA → WGS84 for missed-connection distance heuristics (deterministic, no external calls). */
export const AIRPORT_COORDINATES: Record<string, { lat: number; lon: number; name: string }> = {
  JFK: { lat: 40.6413, lon: -73.7781, name: 'John F. Kennedy Intl' },
  LAX: { lat: 33.9416, lon: -118.4085, name: 'Los Angeles Intl' },
  SFO: { lat: 37.6213, lon: -122.379, name: 'San Francisco Intl' },
  ORD: { lat: 41.9742, lon: -87.9073, name: "Chicago O'Hare" },
  ATL: { lat: 33.6407, lon: -84.4277, name: 'Hartsfield-Jackson Atlanta' },
  DFW: { lat: 32.8998, lon: -97.0403, name: 'Dallas/Fort Worth' },
  DEN: { lat: 39.8561, lon: -104.6737, name: 'Denver Intl' },
  SEA: { lat: 47.4502, lon: -122.3088, name: 'Seattle-Tacoma Intl' },
  MIA: { lat: 25.7959, lon: -80.287, name: 'Miami Intl' },
  LHR: { lat: 51.47, lon: -0.4543, name: 'London Heathrow' },
  LGW: { lat: 51.1537, lon: -0.1821, name: 'London Gatwick' },
  CDG: { lat: 49.0097, lon: 2.5479, name: 'Paris Charles de Gaulle' },
  ORY: { lat: 48.7262, lon: 2.3652, name: 'Paris Orly' },
  FRA: { lat: 50.0379, lon: 8.5622, name: 'Frankfurt' },
  MUC: { lat: 48.3538, lon: 11.7861, name: 'Munich' },
  ZRH: { lat: 47.4647, lon: 8.5492, name: 'Zurich' },
  GVA: { lat: 46.2381, lon: 6.109, name: 'Geneva' },
  FCO: { lat: 41.8003, lon: 12.2389, name: 'Rome Fiumicino' },
  MAD: { lat: 40.4983, lon: -3.5676, name: 'Madrid-Barajas' },
  BCN: { lat: 41.2974, lon: 2.0833, name: 'Barcelona' },
  AMS: { lat: 52.3105, lon: 4.7683, name: 'Amsterdam Schiphol' },
  OSL: { lat: 60.1975, lon: 11.1004, name: 'Oslo Gardermoen' },
  ARN: { lat: 59.6519, lon: 17.9186, name: 'Stockholm Arlanda' },
  CPH: { lat: 55.618, lon: 12.656, name: 'Copenhagen' },
  NRT: { lat: 35.7647, lon: 140.3864, name: 'Narita' },
  HND: { lat: 35.5494, lon: 139.7798, name: 'Haneda' },
  SYD: { lat: -33.9399, lon: 151.1753, name: 'Sydney' },
  MEL: { lat: -37.669, lon: 144.841, name: 'Melbourne' },
  DXB: { lat: 25.2532, lon: 55.3657, name: 'Dubai Intl' },
  SIN: { lat: 1.3644, lon: 103.9915, name: 'Changi' },
  BKK: { lat: 13.6811, lon: 100.747, name: 'Suvarnabhumi' },
  CUN: { lat: 21.0365, lon: -86.8771, name: 'Cancun Intl' },
  MEX: { lat: 19.4363, lon: -99.0721, name: 'Mexico City Intl' },
};

const IATA_RE = /\b([A-Z]{3})\b/;

export function extractIataCode(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = String(text).toUpperCase().match(IATA_RE);
  return m ? m[1] : null;
}

export function resolveAirportFromSegment(origin: string | null | undefined): { lat: number; lon: number; label: string } | null {
  const code = extractIataCode(origin || '');
  if (!code) return null;
  const row = AIRPORT_COORDINATES[code];
  if (!row) return null;
  return { lat: row.lat, lon: row.lon, label: `${code} — ${row.name}` };
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Rough urban driving minutes (no traffic model). */
export function estimateDriveMinutes(distanceKm: number): number {
  const avgKmh = 28;
  return Math.max(5, Math.round((distanceKm / avgKmh) * 60));
}
