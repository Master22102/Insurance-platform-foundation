/*
  # Lock Down trips RLS to Read-Only
  
  1. Purpose
    - Remove direct INSERT/UPDATE policies from trips table
    - Force all writes through create_trip() RPC
    - Matches governance pattern used for incidents
  
  2. Changes
    - DROP trips_insert and trips_update policies
    - Keep trips_select for read access
    - All mutations must go through guarded RPCs
  
  3. Security
    - Prevents RLS bypass
    - Enforces governance guard checks
    - Ensures event emission on all state changes
*/

-- Drop write policies
DROP POLICY IF EXISTS trips_insert ON trips;
DROP POLICY IF EXISTS trips_update ON trips;

-- Keep read-only policy
-- trips_select already exists from rename migration