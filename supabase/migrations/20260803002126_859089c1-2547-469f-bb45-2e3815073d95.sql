-- Notification log
CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  recipient text NOT NULL,
  subject text,
  entity_type text,
  entity_id uuid,
  body_id uuid REFERENCES public.bodies(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'sent',
  detail text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read the notification log"
ON public.notification_log FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE INDEX notification_log_sent_at_idx ON public.notification_log (sent_at DESC);
CREATE INDEX notification_log_entity_idx ON public.notification_log (entity_type, entity_id);

-- Staff invites
CREATE TABLE public.staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text,
  title text,
  department text,
  role app_role NOT NULL DEFAULT 'viewer',
  body_ids uuid[] NOT NULL DEFAULT '{}',
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  invited_by uuid,
  accepted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_invites TO authenticated;
GRANT ALL ON public.staff_invites TO service_role;
ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can read invites"
ON public.staff_invites FOR SELECT TO authenticated
USING (public.can_manage(auth.uid()));

CREATE POLICY "Managers can manage invites"
ON public.staff_invites FOR ALL TO authenticated
USING (public.can_manage(auth.uid()))
WITH CHECK (public.can_manage(auth.uid()));

CREATE UNIQUE INDEX staff_invites_email_open_idx
  ON public.staff_invites (lower(email))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE TRIGGER staff_invites_set_updated_at
BEFORE UPDATE ON public.staff_invites
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Subscriptions: double opt-in bookkeeping
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

-- Settings: onboarding + branding fields
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS setup_completed_at timestamptz;