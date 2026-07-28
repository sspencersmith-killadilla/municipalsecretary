ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS records_response_days integer NOT NULL DEFAULT 5;

CREATE OR REPLACE FUNCTION public.lookup_records_request(_tracking_code text)
RETURNS TABLE (
  tracking_code text,
  requester_name text,
  description text,
  status public.request_status,
  received_at timestamptz,
  due_at timestamptz,
  closed_at timestamptz,
  response_note text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.tracking_code, r.requester_name, r.description, r.status,
         r.received_at, r.due_at, r.closed_at, r.response_note
  FROM public.records_requests r
  WHERE upper(r.tracking_code) = upper(trim(_tracking_code))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_records_request(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_records_request(text) TO anon, authenticated;