/*
  # M-06: Create contacts table
  
  1. New Table
    - contacts: user contact directory for emergencies, carriers, providers
    - Supports multiple contact types with flexible fields
  
  2. Security
    - RLS enabled with user-scoped access
*/

CREATE TABLE IF NOT EXISTS contacts (
  contact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES auth.users(id),
  contact_type text NOT NULL
    CHECK (contact_type IN ('emergency','carrier','medical','airline','hotel','legal','other')),
  name text,
  phone text,
  email text,
  organization text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contacts_select ON contacts FOR SELECT USING (account_id = auth.uid());
CREATE POLICY contacts_insert ON contacts FOR INSERT WITH CHECK (account_id = auth.uid());