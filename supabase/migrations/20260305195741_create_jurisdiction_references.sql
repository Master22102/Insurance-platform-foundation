/*
  # M-02: Create jurisdiction_references
  
  1. New Table
    - jurisdiction_references: governing jurisdictions for policies and trips
    - Contains ISO country codes, region codes, EU/EEA flags
  
  2. Security
    - Enable RLS with public read access
    - Seed with common jurisdictions
*/

CREATE TABLE IF NOT EXISTS jurisdiction_references (
  jurisdiction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iso_country_code text NOT NULL,
  country_name text NOT NULL,
  region_code text,
  is_eu_eea boolean NOT NULL DEFAULT false,
  is_us_state boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE jurisdiction_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY jur_select ON jurisdiction_references FOR SELECT USING (true);

-- Seed with common jurisdictions
INSERT INTO jurisdiction_references (iso_country_code, country_name, is_eu_eea) VALUES
  ('US', 'United States', false),
  ('GB', 'United Kingdom', false),
  ('CA', 'Canada', false),
  ('AU', 'Australia', false),
  ('FR', 'France', true),
  ('DE', 'Germany', true),
  ('IT', 'Italy', true),
  ('ES', 'Spain', true),
  ('JP', 'Japan', false),
  ('MX', 'Mexico', false)
ON CONFLICT DO NOTHING;