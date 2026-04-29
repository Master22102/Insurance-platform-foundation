export type RestrictionLevel =
  | 'prohibited'
  | 'requires_documentation'
  | 'restricted_quantity'
  | 'requires_declaration'
  | 'allowed';

export type MedicationRestrictionRow = {
  country_code: string;
  medication_class: string;
  specific_drug_names: string[] | null;
  restriction_level: RestrictionLevel;
  required_documentation: string | null;
  notes: string | null;
  documentation_url: string | null;
};

export type MedicationAlert = {
  medication: string;
  country_code: string;
  medication_class: string;
  restriction_level: RestrictionLevel;
  required_documentation: string | null;
  notes: string | null;
  documentation_url: string | null;
};

function tokenizeMedication(input: string): string[] {
  return input
    .split(/[,\n/;|]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

export function detectMedicationAlerts(
  medicationsInput: string[],
  rows: MedicationRestrictionRow[],
): MedicationAlert[] {
  const meds = medicationsInput.flatMap(tokenizeMedication);
  if (!meds.length || !rows.length) return [];

  const out: MedicationAlert[] = [];
  for (const row of rows) {
    const names = (row.specific_drug_names || []).map((x) => String(x).toLowerCase());
    for (const med of meds) {
      const medLc = med.toLowerCase();
      const hitByName = names.some((n) => medLc.includes(n) || n.includes(medLc));
      const hitByClass = medLc.includes(String(row.medication_class || '').toLowerCase());
      if (!hitByName && !hitByClass) continue;
      out.push({
        medication: med,
        country_code: row.country_code,
        medication_class: row.medication_class,
        restriction_level: row.restriction_level,
        required_documentation: row.required_documentation,
        notes: row.notes,
        documentation_url: row.documentation_url,
      });
    }
  }

  const dedup = new Map<string, MedicationAlert>();
  for (const item of out) {
    dedup.set(`${item.medication}|${item.country_code}|${item.medication_class}`, item);
  }
  return Array.from(dedup.values());
}
