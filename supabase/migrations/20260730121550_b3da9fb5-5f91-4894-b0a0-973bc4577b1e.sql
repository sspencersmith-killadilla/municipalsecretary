-- 1. Speaker queue: only expose sign-ups for meetings that are public
DROP POLICY IF EXISTS "Speaker queue is public" ON public.speaker_queue;
CREATE POLICY "Speaker queue is public for published meetings"
ON public.speaker_queue
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = speaker_queue.meeting_id
      AND m.status IN ('published','in_progress','adjourned')
  )
  OR public.can_manage(auth.uid())
);

-- 2. Restrict SECURITY DEFINER role helpers to self-inspection (admins excepted)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL
     AND _user_id IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
    THEN false
    ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL
     AND _user_id IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
    THEN false
    ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','clerk'))
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL
     AND _user_id IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
    THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role IN ('admin','clerk','attorney','department_staff','board_member')
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
    WHEN auth.uid() IS NOT NULL
     AND _user_id IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
    THEN false
    ELSE public.can_manage(_user_id)
      OR EXISTS (
        SELECT 1 FROM public.body_permissions
        WHERE user_id = _user_id AND body_id = _body_id AND can_submit
      )
  END;
$$;
