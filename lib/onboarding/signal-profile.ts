/** Confirmed onboarding / account travel signal (Section 5 — signal capture). */
export interface SignalProfile {
  places: string[];
  activities: string[];
  food_interests: string[];
  travel_style: string;
  detail_preference: 'simple' | 'balanced' | 'detailed';
  interests_other: string[];
  capture_rounds: number;
  last_updated: string;
}

export const defaultSignalProfile = (): SignalProfile => ({
  places: [],
  activities: [],
  food_interests: [],
  travel_style: '',
  detail_preference: 'balanced',
  interests_other: [],
  capture_rounds: 0,
  last_updated: new Date().toISOString(),
});

export type CategorizedChips = {
  places: string[];
  activities: string[];
  food: string[];
  travelStyle: string[];
  other: string[];
};

const ACTIVITY_WORDS =
  /\b(hiking|museum|museums|surfing|skiing|ski|concert|concerts|tour|tours|snorkel|diving|kayak|cycling|trekking|sightseeing|spa|yoga|festival|festivals|golf|tennis|running|climbing|safari)\b/i;
const FOOD_WORDS =
  /\b(food|cuisine|dining|restaurant|restaurants|street food|fine dining|cooking|wine|coffee|bakery|brunch|seafood|vegan|vegetarian|tour)\b/i;
const TRAVEL_STYLE_WORDS =
  /\b(solo|group|family|couple|backpack|backpacking|luxury|adventure|relaxed|relax|budget|business|digital nomad|slow travel)\b/i;

/** MVP keyword / heuristic categorization from chip tokens. */
export function categorizeSignalChips(chips: string[]): CategorizedChips {
  const places: string[] = [];
  const activities: string[] = [];
  const food: string[] = [];
  const travelStyle: string[] = [];
  const other: string[] = [];

  for (const raw of chips) {
    const w = raw.trim();
    if (w.length < 3) continue;
    if (ACTIVITY_WORDS.test(w)) {
      activities.push(w);
      continue;
    }
    if (FOOD_WORDS.test(w)) {
      food.push(w);
      continue;
    }
    if (TRAVEL_STYLE_WORDS.test(w)) {
      travelStyle.push(w);
      continue;
    }
    if (/^[A-Z][a-z]+/.test(w) || w.length >= 5) {
      places.push(w);
      continue;
    }
    other.push(w);
  }

  return {
    places: uniq(places),
    activities: uniq(activities),
    food: uniq(food),
    travelStyle: uniq(travelStyle),
    other: uniq(other),
  };
}

function uniq(a: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of a) {
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

export function mergeCategorized(into: CategorizedChips, add: CategorizedChips): CategorizedChips {
  return {
    places: uniq([...into.places, ...add.places]),
    activities: uniq([...into.activities, ...add.activities]),
    food: uniq([...into.food, ...add.food]),
    travelStyle: uniq([...into.travelStyle, ...add.travelStyle]),
    other: uniq([...into.other, ...add.other]),
  };
}

export function chipsFromText(text: string): string[] {
  const raw = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const uniqSet = new Set<string>();
  for (const w of raw) {
    if (w.length < 4) continue;
    if (['this', 'that', 'with', 'have', 'from', 'your', 'what', 'when', 'where', 'help', 'want', 'like', 'just', 'some'].includes(w)) continue;
    uniqSet.add(w);
    if (uniqSet.size >= 24) break;
  }
  return Array.from(uniqSet);
}

/** Merge API /voice/parse signal_categorize fields into CategorizedChips. */
export function fieldsToCategorized(fields: Record<string, unknown>): CategorizedChips {
  const arr = (k: string) =>
    Array.isArray(fields[k]) ? (fields[k] as unknown[]).map((x) => String(x).trim()).filter(Boolean) : [];
  return {
    places: arr('places'),
    activities: arr('activities'),
    food: arr('food_interests').length ? arr('food_interests') : arr('food'),
    travelStyle: fields.travel_style ? [String(fields.travel_style)] : arr('travel_style'),
    other: arr('interests_other').length ? arr('interests_other') : arr('other'),
  };
}

export function categorizedToSignalProfile(
  cat: CategorizedChips,
  captureRounds: number,
  detailPreference: SignalProfile['detail_preference'] = 'balanced',
): SignalProfile {
  const travel =
    cat.travelStyle.join(', ') ||
    (cat.other.find((o) => TRAVEL_STYLE_WORDS.test(o)) ?? '');
  return {
    places: [...cat.places],
    activities: [...cat.activities],
    food_interests: [...cat.food],
    travel_style: travel,
    detail_preference: detailPreference,
    interests_other: [...cat.other],
    capture_rounds: captureRounds,
    last_updated: new Date().toISOString(),
  };
}
