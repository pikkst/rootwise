-- Rootwise: locations helper RPC for RLS-safe profile updates
-- Run in Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_or_create_location(
  p_normalized_name TEXT,
  p_country TEXT DEFAULT 'Estonia',
  p_county TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_locality TEXT DEFAULT NULL,
  p_postal_code TEXT DEFAULT NULL,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_location_id UUID;
BEGIN
  IF p_normalized_name IS NULL OR length(trim(p_normalized_name)) = 0 THEN
    RAISE EXCEPTION 'normalized_name is required' USING ERRCODE = '23514';
  END IF;

  INSERT INTO locations (
    normalized_name,
    country,
    county,
    city,
    locality,
    postal_code,
    latitude,
    longitude
  )
  VALUES (
    trim(lower(p_normalized_name)),
    COALESCE(NULLIF(trim(p_country), ''), 'Estonia'),
    NULLIF(trim(p_county), ''),
    NULLIF(trim(p_city), ''),
    NULLIF(trim(p_locality), ''),
    NULLIF(trim(p_postal_code), ''),
    p_latitude,
    p_longitude
  )
  ON CONFLICT (normalized_name)
  DO NOTHING
  RETURNING id INTO v_location_id;

  IF v_location_id IS NULL THEN
    SELECT id
      INTO v_location_id
    FROM locations
    WHERE normalized_name = trim(lower(p_normalized_name))
    LIMIT 1;
  END IF;

  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'failed to resolve location id' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_location_id;
END;
$$;

REVOKE ALL ON FUNCTION get_or_create_location(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) FROM public;
GRANT EXECUTE ON FUNCTION get_or_create_location(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
