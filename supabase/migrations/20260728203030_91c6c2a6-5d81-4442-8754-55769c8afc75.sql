CREATE TABLE public.body_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  body_id uuid NOT NULL REFERENCES public.bodies(id) ON DELETE CASCADE,
  can_submit boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, body_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_permissions TO authenticated;
GRANT ALL ON public.body_permissions TO service_role;

ALTER TABLE public.body_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permissions readable by staff"
  ON public.body_permissions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "admins manage permissions"
  ON public.body_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER body_permissions_updated_at
  BEFORE UPDATE ON public.body_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX body_permissions_user_idx ON public.body_permissions (user_id);

CREATE OR REPLACE FUNCTION public.can_submit_to_body(_user_id uuid, _body_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_manage(_user_id)
     OR EXISTS (
       SELECT 1 FROM public.body_permissions
       WHERE user_id = _user_id AND body_id = _body_id AND can_submit
     );
$$;

REVOKE EXECUTE ON FUNCTION public.can_submit_to_body(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_submit_to_body(uuid, uuid) TO authenticated, service_role;

DROP POLICY "staff create items" ON public.legislative_items;

CREATE POLICY "staff create items for permitted bodies"
  ON public.legislative_items FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid())
    AND created_by = auth.uid()
    AND (body_id IS NULL OR public.can_submit_to_body(auth.uid(), body_id))
  );