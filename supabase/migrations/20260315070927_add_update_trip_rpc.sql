/*
  # Add update_trip RPC

  1. Purpose
    - Allows authenticated users to update editable trip fields
    - Enforces ownership: only the trip creator can update
    - Updates: trip_name, destination_summary, departure_date, return_date, travel_mode_primary

  2. Security
    - SECURITY DEFINER
    - Validates auth.uid() === created_by before allowing update
    - EXECUTE granted to authenticated only
*/

CREATE OR REPLACE FUNCTION update_trip(
  p_trip_id             uuid,
  p_trip_name           text    DEFAULT NULL,
  p_destination_summary text    DEFAULT NULL,
  p_departure_date      date    DEFAULT NULL,
  p_return_date         date    DEFAULT NULL,
  p_travel_mode_primary text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF p_trip_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip_id is required');
  END IF;

  SELECT created_by INTO v_owner FROM trips WHERE trip_id = p_trip_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'trip not found');
  END IF;
  IF v_owner IS DISTINCT FROM v_actor THEN
    RETURN jsonb_build_object('success', false, 'error', 'not authorized');
  END IF;

  UPDATE trips SET
    trip_name           = COALESCE(p_trip_name, trip_name),
    destination_summary = COALESCE(p_destination_summary, destination_summary),
    departure_date      = COALESCE(p_departure_date, departure_date),
    return_date         = COALESCE(p_return_date, return_date),
    travel_mode_primary = COALESCE(p_travel_mode_primary, travel_mode_primary),
    updated_at          = now()
  WHERE trip_id = p_trip_id;

  RETURN jsonb_build_object('success', true, 'trip_id', p_trip_id);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'update_trip failed: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION update_trip(uuid, text, text, date, date, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION update_trip(uuid, text, text, date, date, text) FROM anon;
