CREATE OR REPLACE FUNCTION public.file_records_request(
  _requester_name text,
  _description text,
  _requester_email text DEFAULT NULL,
  _requester_phone text DEFAULT NULL
)
RETURNS TABLE (tracking_code text, due_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  days integer;
  due timestamptz := now();
  added integer := 0;
  rec record;
BEGIN
  IF length(coalesce(trim(_requester_name), '')) < 1 OR length(_requester_name) > 200 THEN
    RAISE EXCEPTION 'A name is required';
  END IF;
  IF length(coalesce(trim(_description), '')) < 1 OR length(_description) > 8000 THEN
    RAISE EXCEPTION 'A description of the records is required';
  END IF;

  SELECT coalesce(records_response_days, 5) INTO days FROM public.settings WHERE id = 1;
  days := coalesce(days, 5);

  WHILE added < days LOOP
    due := due + interval '1 day';
    IF extract(isodow from due) < 6 THEN added := added + 1; END IF;
  END LOOP;

  INSERT INTO public.records_requests (requester_name, description, requester_email, requester_phone, due_at)
  VALUES (trim(_requester_name), trim(_description), nullif(trim(_requester_email), ''), nullif(trim(_requester_phone), ''), due)
  RETURNING records_requests.tracking_code, records_requests.due_at INTO rec;

  INSERT INTO public.records_request_events (request_id, action, note)
  SELECT r.id, 'filed', NULL FROM public.records_requests r WHERE r.tracking_code = rec.tracking_code;

  tracking_code := rec.tracking_code;
  due_at := rec.due_at;
  RETURN NEXT;
END; $$;

REVOKE ALL ON FUNCTION public.file_records_request(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.file_records_request(text, text, text, text) TO anon, authenticated;