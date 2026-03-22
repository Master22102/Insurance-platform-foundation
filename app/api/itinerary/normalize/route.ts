import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { readDocument } from '@/lib/document-intelligence';
import JSZip from 'jszip';
import { createServerClient } from '@supabase/ssr';
import { userRateLimitedJsonResponse } from '@/lib/rate-limit/simple-memory';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set(['pdf', 'docx', 'ics', 'txt']);

type ProposedItinerary = {
  trip_name: string;
  destination_summary: string;
  departure_date: string;
  return_date: string;
  travel_mode_primary: string;
  route_segments: Array<{ origin: string; destination: string }>;
};

function normalizeWhitespace(input: string): string {
  return input.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function getExt(fileName: string): string {
  const p = fileName.toLowerCase().split('.');
  return p.length > 1 ? p[p.length - 1] : '';
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const docXml = zip.file('word/document.xml');
  if (!docXml) return '';
  const xml = await docXml.async('string');
  return normalizeWhitespace(
    xml
      .replace(/<w:p[^>]*>/g, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  );
}

function parseTextToItinerary(text: string): ProposedItinerary {
  const parsed: ProposedItinerary = {
    trip_name: '',
    destination_summary: '',
    departure_date: '',
    return_date: '',
    travel_mode_primary: 'air',
    route_segments: [],
  };

  const lower = text.toLowerCase();
  if (/\b(train|rail|amtrak|eurostar)\b/.test(lower)) parsed.travel_mode_primary = 'rail';
  if (/\b(cruise|ship|ferry|sail)\b/.test(lower)) parsed.travel_mode_primary = 'sea';
  if (/\b(drive|car|road trip)\b/.test(lower)) parsed.travel_mode_primary = 'road';
  if (/\b(flight|airline|airport|depart|arrival)\b/.test(lower)) parsed.travel_mode_primary = 'air';

  const months: Record<string, string> = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12',
  };
  const dateRegex = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/gi;
  const dates: string[] = [];
  let match: RegExpExecArray | null = null;
  while ((match = dateRegex.exec(text)) !== null) {
    const month = months[match[1].toLowerCase()];
    const day = match[2].padStart(2, '0');
    const year = match[3] || String(new Date().getFullYear());
    dates.push(`${year}-${month}-${day}`);
  }
  parsed.departure_date = dates[0] || '';
  parsed.return_date = dates[1] || '';

  const destinationMatch = text.match(/(?:trip to|going to|travel(?:ing)? to|visiting|destination)\s+([A-Z][A-Za-z\s,.-]{1,80})/i);
  if (destinationMatch) {
    parsed.destination_summary = destinationMatch[1].replace(/\s+/g, ' ').trim().replace(/[.,;]+$/, '');
  }

  const routeRegex = /\bfrom\s+([A-Za-z][A-Za-z\s.-]{1,50})\s+to\s+([A-Za-z][A-Za-z\s.-]{1,50})/gi;
  while ((match = routeRegex.exec(text)) !== null) {
    const origin = match[1].trim();
    const destination = match[2].trim();
    if (origin && destination) parsed.route_segments.push({ origin, destination });
  }

  if (!parsed.destination_summary && parsed.route_segments[0]?.destination) {
    parsed.destination_summary = parsed.route_segments[0].destination;
  }

  if (parsed.destination_summary) {
    const year = parsed.departure_date ? parsed.departure_date.slice(0, 4) : '';
    parsed.trip_name = year ? `${parsed.destination_summary} ${year}` : `Trip to ${parsed.destination_summary}`;
  } else {
    parsed.trip_name = 'New Trip';
  }

  return parsed;
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const normLimited = userRateLimitedJsonResponse(user.id, 'itinerary-normalize', 30, 15 * 60 * 1000);
    if (normLimited) return normLimited;

    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'That file is too large to upload.' }, { status: 400 });
    }

    const ext = getExt(file.name);
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: "Unfortunately, we can't use that file type yet." }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    let extractedText = '';

    if (ext === 'txt' || ext === 'ics') {
      extractedText = normalizeWhitespace(fileBuffer.toString('utf-8'));
    } else if (ext === 'docx') {
      extractedText = await extractDocxText(fileBuffer);
    } else if (ext === 'pdf') {
      const tmpPath = join('/tmp', `${randomUUID()}.pdf`);
      await writeFile(tmpPath, fileBuffer);
      try {
        const extracted = await readDocument(tmpPath);
        extractedText = normalizeWhitespace(extracted.text || '');
      } finally {
        await unlink(tmpPath).catch(() => {});
      }
    }

    if (!extractedText) {
      return NextResponse.json({ error: 'Could not extract itinerary text from this file.' }, { status: 422 });
    }

    const proposed = parseTextToItinerary(extractedText);
    const itineraryHash = createHash('sha256')
      .update(
        JSON.stringify({
          text: extractedText,
          proposed,
          file_name: file.name,
          ext,
        }),
      )
      .digest('hex');

    return NextResponse.json({
      file_name: file.name,
      extension: ext,
      extracted_text: extractedText,
      proposed,
      itinerary_hash: itineraryHash,
      warnings: [],
    });
  } catch (err) {
    console.error('[itinerary/normalize]', err);
    return NextResponse.json({ error: 'Failed to normalize itinerary file.' }, { status: 500 });
  }
}

