export type LocationCertainty = 'confirmed' | 'likely' | 'approximate' | 'unknown';

export interface PresenceDisplay {
  certainty: LocationCertainty;
  label: string;
  can_render_as_confirmed: boolean;
  disclosure: string | null;
}

export function guardPresence(input: {
  source?: string | null;
  accuracy_meters?: number | null;
  certainty?: LocationCertainty | null;
}): PresenceDisplay {
  const source = (input.source ?? '').toLowerCase();
  const accuracy = input.accuracy_meters ?? 9999;

  let certainty: LocationCertainty = input.certainty ?? 'unknown';
  if (!input.certainty) {
    if ((source === 'gps' || source === 'gnss') && accuracy <= 50) certainty = 'confirmed';
    else if (source === 'wifi' && accuracy <= 150) certainty = 'likely';
    else if (source === 'cell' || source === 'cellular' || source === 'ip') certainty = 'approximate';
    else certainty = 'unknown';
  }

  const can_render_as_confirmed = certainty === 'confirmed';

  const map: Record<LocationCertainty, { label: string; disclosure: string | null }> = {
    confirmed:   { label: 'Confirmed location', disclosure: null },
    likely:      { label: 'Likely location',    disclosure: 'Based on nearby network signal.' },
    approximate: { label: 'Approximate (IP inferred)', disclosure: 'Inferred from your network. Not a confirmed position.' },
    unknown:     { label: 'Location unknown',   disclosure: 'No recent location signal available.' },
  };

  return {
    certainty,
    label: map[certainty].label,
    can_render_as_confirmed,
    disclosure: map[certainty].disclosure,
  };
}
