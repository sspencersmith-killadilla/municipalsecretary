DROP POLICY IF EXISTS "managers write" ON public.audit_log;
CREATE POLICY "managers append audit" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage(auth.uid()));
REVOKE UPDATE, DELETE ON public.audit_log FROM authenticated, anon;
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;