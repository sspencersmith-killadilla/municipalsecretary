REVOKE SELECT ON public.members FROM authenticated;
GRANT SELECT (id, full_name, photo_url, bio, user_id, active, created_at, updated_at) ON public.members TO authenticated;