-- 1. Public notices must follow the parent meeting's publication status
DROP POLICY IF EXISTS "Notices are public" ON public.meeting_notices;
CREATE POLICY "Notices for public meetings are readable"
ON public.meeting_notices
FOR SELECT
USING (
  public.is_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_notices.meeting_id
      AND m.status IN ('published','in_progress','adjourned')
      AND m.cancelled_at IS NULL
  )
);

-- 2. Role helpers answer only for the caller; no cross-account probing
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role IN ('admin','clerk','attorney','department_staff','board_member')
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role IN ('admin','clerk')
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_submit_to_body(_user_id uuid, _body_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE public.can_manage(_user_id)
      OR EXISTS (
        SELECT 1 FROM public.body_permissions
        WHERE user_id = _user_id AND body_id = _body_id AND can_submit
      )
  END;
$$;

-- 3. Remove needless API exposure of definer routines that policies/RPC do not need
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.can_manage(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.can_submit_to_body(uuid, uuid) FROM anon;