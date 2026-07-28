-- 1. public_comments: hide PII columns from anon/authenticated broad reads
REVOKE SELECT ON public.public_comments FROM anon, authenticated;
GRANT SELECT (id, meeting_id, agenda_item_id, full_name, comment_type, position, body, status, created_at, updated_at) ON public.public_comments TO anon, authenticated;
GRANT INSERT ON public.public_comments TO anon, authenticated;

-- 2. members: hide email from public reads
REVOKE SELECT ON public.members FROM anon, authenticated;
GRANT SELECT (id, full_name, photo_url, bio, active, created_at, updated_at) ON public.members TO anon;
GRANT SELECT (id, full_name, email, photo_url, bio, user_id, active, created_at, updated_at) ON public.members TO authenticated;

-- 3. SECURITY DEFINER functions: revoke execute from anon/authenticated/public
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_manage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_submit_to_body(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- keep the two intentionally public records-request RPCs callable (they validate their own input)
GRANT EXECUTE ON FUNCTION public.lookup_records_request(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.file_records_request(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_item_number(uuid) TO authenticated;