-- 1) is_staff should not treat the low-privilege 'viewer' role as staff
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','clerk','attorney','department_staff','board_member')
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

-- 2) Public records-request RPCs must not be callable by anonymous clients directly
REVOKE ALL ON FUNCTION public.file_records_request(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.file_records_request(text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.lookup_records_request(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_records_request(text) TO service_role;

-- 3) Ensure no anon EXECUTE remains on other SECURITY DEFINER helpers
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_submit_to_body(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_item_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_submit_to_body(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_item_number(uuid) TO authenticated, service_role;