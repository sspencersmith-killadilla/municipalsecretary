-- ============ enums ============
CREATE TYPE public.meeting_kind AS ENUM ('regular','special','emergency','continued','workshop');
CREATE TYPE public.notice_kind AS ENUM ('original','amended','cancellation','continuation','emergency');
CREATE TYPE public.comment_type AS ENUM ('speak','written');
CREATE TYPE public.comment_position AS ENUM ('support','oppose','neutral');
CREATE TYPE public.moderation_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.speaker_status AS ENUM ('waiting','speaking','done','yielded');
CREATE TYPE public.request_status AS ENUM ('received','in_progress','awaiting_clarification','fulfilled','denied','withdrawn');

-- ============ meetings / agenda / minutes extensions ============
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS meeting_kind public.meeting_kind NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS continued_from_meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS emergency_justification text,
  ADD COLUMN IF NOT EXISTS comments_open boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS comment_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS speaker_seconds integer NOT NULL DEFAULT 180;

ALTER TABLE public.agenda_items
  ADD COLUMN IF NOT EXISTS is_closed_session boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_session_citation text,
  ADD COLUMN IF NOT EXISTS public_action_note text;

ALTER TABLE public.minutes
  ADD COLUMN IF NOT EXISTS certified_by uuid,
  ADD COLUMN IF NOT EXISTS certified_at timestamptz,
  ADD COLUMN IF NOT EXISTS certification_note text,
  ADD COLUMN IF NOT EXISTS integrity_hash text;

ALTER TABLE public.legislative_items
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS publication_date date,
  ADD COLUMN IF NOT EXISTS codification_reference text,
  ADD COLUMN IF NOT EXISTS plain_summary text,
  ADD COLUMN IF NOT EXISTS veto_status text;

-- ============ meeting_notices ============
CREATE TABLE public.meeting_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  kind public.notice_kind NOT NULL DEFAULT 'original',
  version integer NOT NULL DEFAULT 1,
  content text NOT NULL,
  posting_locations text[] NOT NULL DEFAULT '{}',
  posted_at timestamptz NOT NULL DEFAULT now(),
  posted_by uuid,
  posted_by_name text,
  deadline_at timestamptz,
  compliant boolean NOT NULL DEFAULT true,
  compliance_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meeting_notices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_notices TO authenticated;
GRANT ALL ON public.meeting_notices TO service_role;
ALTER TABLE public.meeting_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notices are public" ON public.meeting_notices FOR SELECT USING (true);
CREATE POLICY "Staff manage notices" ON public.meeting_notices FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

-- ============ closed session minutes ============
CREATE TABLE public.closed_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  citation text NOT NULL,
  content text NOT NULL DEFAULT '',
  sealed boolean NOT NULL DEFAULT true,
  public_action_taken text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.closed_minutes TO authenticated;
GRANT ALL ON public.closed_minutes TO service_role;
ALTER TABLE public.closed_minutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read closed minutes" ON public.closed_minutes FOR SELECT TO authenticated
  USING (public.can_manage(auth.uid()));
CREATE POLICY "Staff manage closed minutes" ON public.closed_minutes FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE TRIGGER closed_minutes_updated BEFORE UPDATE ON public.closed_minutes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ public comments ============
CREATE TABLE public.public_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  agenda_item_id uuid REFERENCES public.agenda_items(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  address text,
  organization text,
  comment_type public.comment_type NOT NULL DEFAULT 'written',
  position public.comment_position NOT NULL DEFAULT 'neutral',
  body text NOT NULL,
  status public.moderation_status NOT NULL DEFAULT 'pending',
  moderated_by uuid,
  moderated_at timestamptz,
  moderation_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.public_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_comments TO authenticated;
GRANT ALL ON public.public_comments TO service_role;
ALTER TABLE public.public_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved comments are public" ON public.public_comments FOR SELECT
  USING (status = 'approved' OR public.can_manage(auth.uid()));
CREATE POLICY "Anyone may submit a comment" ON public.public_comments FOR INSERT
  WITH CHECK (status = 'pending' AND length(body) BETWEEN 1 AND 8000 AND length(full_name) BETWEEN 1 AND 200);
CREATE POLICY "Staff moderate comments" ON public.public_comments FOR UPDATE TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "Staff delete comments" ON public.public_comments FOR DELETE TO authenticated
  USING (public.can_manage(auth.uid()));
CREATE TRIGGER public_comments_updated BEFORE UPDATE ON public.public_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ speaker queue ============
CREATE TABLE public.speaker_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  agenda_item_id uuid REFERENCES public.agenda_items(id) ON DELETE SET NULL,
  comment_id uuid REFERENCES public.public_comments(id) ON DELETE SET NULL,
  speaker_name text NOT NULL,
  affiliation text,
  position integer NOT NULL DEFAULT 0,
  seconds_allowed integer NOT NULL DEFAULT 180,
  seconds_used integer,
  status public.speaker_status NOT NULL DEFAULT 'waiting',
  started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.speaker_queue TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.speaker_queue TO authenticated;
GRANT ALL ON public.speaker_queue TO service_role;
ALTER TABLE public.speaker_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Speaker queue is public" ON public.speaker_queue FOR SELECT USING (true);
CREATE POLICY "Staff manage speaker queue" ON public.speaker_queue FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE TRIGGER speaker_queue_updated BEFORE UPDATE ON public.speaker_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ subscriptions ============
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  body_id uuid REFERENCES public.bodies(id) ON DELETE CASCADE,
  notify_agendas boolean NOT NULL DEFAULT true,
  notify_minutes boolean NOT NULL DEFAULT true,
  notify_changes boolean NOT NULL DEFAULT true,
  confirmed boolean NOT NULL DEFAULT false,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX subscriptions_email_body_idx
  ON public.subscriptions (lower(email), COALESCE(body_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT INSERT ON public.subscriptions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone may subscribe" ON public.subscriptions FOR INSERT
  WITH CHECK (length(email) BETWEEN 3 AND 320);
CREATE POLICY "Staff manage subscriptions" ON public.subscriptions FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE TRIGGER subscriptions_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ retention ============
CREATE TABLE public.retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_class text NOT NULL UNIQUE,
  label text NOT NULL,
  retention_years integer,
  permanent boolean NOT NULL DEFAULT false,
  citation text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.retention_policies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retention_policies TO authenticated;
GRANT ALL ON public.retention_policies TO service_role;
ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Retention schedule is public" ON public.retention_policies FOR SELECT USING (true);
CREATE POLICY "Staff manage retention" ON public.retention_policies FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE TRIGGER retention_policies_updated BEFORE UPDATE ON public.retention_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.legal_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_class text NOT NULL,
  entity_id uuid,
  scope_note text,
  reason text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  placed_by uuid,
  placed_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_holds TO authenticated;
GRANT ALL ON public.legal_holds TO service_role;
ALTER TABLE public.legal_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read legal holds" ON public.legal_holds FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Managers manage legal holds" ON public.legal_holds FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE TRIGGER legal_holds_updated BEFORE UPDATE ON public.legal_holds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.disposition_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_class text NOT NULL,
  entity_id uuid,
  description text NOT NULL,
  disposed_at timestamptz NOT NULL DEFAULT now(),
  disposed_by uuid,
  authority text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.disposition_log TO authenticated;
GRANT ALL ON public.disposition_log TO service_role;
ALTER TABLE public.disposition_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read disposition log" ON public.disposition_log FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Managers write disposition log" ON public.disposition_log FOR INSERT TO authenticated
  WITH CHECK (public.can_manage(auth.uid()));

-- ============ public records requests ============
CREATE TABLE public.records_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_code text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  requester_name text NOT NULL,
  requester_email text,
  requester_phone text,
  description text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  status public.request_status NOT NULL DEFAULT 'received',
  assigned_to uuid,
  redaction_note text,
  response_note text,
  closed_at timestamptz,
  fee_estimate numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.records_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.records_requests TO authenticated;
GRANT ALL ON public.records_requests TO service_role;
ALTER TABLE public.records_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone may file a records request" ON public.records_requests FOR INSERT
  WITH CHECK (length(description) BETWEEN 1 AND 8000 AND length(requester_name) BETWEEN 1 AND 200);
CREATE POLICY "Staff read records requests" ON public.records_requests FOR SELECT TO authenticated
  USING (public.can_manage(auth.uid()));
CREATE POLICY "Staff manage records requests" ON public.records_requests FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE TRIGGER records_requests_updated BEFORE UPDATE ON public.records_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.records_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.records_requests(id) ON DELETE CASCADE,
  action text NOT NULL,
  note text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.records_request_events TO authenticated;
GRANT ALL ON public.records_request_events TO service_role;
ALTER TABLE public.records_request_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read request events" ON public.records_request_events FOR SELECT TO authenticated
  USING (public.can_manage(auth.uid()));
CREATE POLICY "Staff write request events" ON public.records_request_events FOR INSERT TO authenticated
  WITH CHECK (public.can_manage(auth.uid()));

-- ============ meeting media ============
CREATE TABLE public.meeting_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  media_type text NOT NULL DEFAULT 'video',
  url text NOT NULL,
  provider text,
  captions_available boolean NOT NULL DEFAULT false,
  captions_url text,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meeting_media TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_media TO authenticated;
GRANT ALL ON public.meeting_media TO service_role;
ALTER TABLE public.meeting_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published media is public" ON public.meeting_media FOR SELECT
  USING (published OR public.can_manage(auth.uid()));
CREATE POLICY "Staff manage media" ON public.meeting_media FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE TRIGGER meeting_media_updated BEFORE UPDATE ON public.meeting_media
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.media_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL REFERENCES public.meeting_media(id) ON DELETE CASCADE,
  agenda_item_id uuid REFERENCES public.agenda_items(id) ON DELETE SET NULL,
  label text NOT NULL,
  offset_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.media_index TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_index TO authenticated;
GRANT ALL ON public.media_index TO service_role;
ALTER TABLE public.media_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Media index is public" ON public.media_index FOR SELECT USING (true);
CREATE POLICY "Staff manage media index" ON public.media_index FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

-- ============ seed retention schedule ============
INSERT INTO public.retention_policies (record_class, label, retention_years, permanent, citation, note) VALUES
  ('minutes','Meeting minutes', NULL, true, 'General records schedule — governing body minutes', 'Minutes of a governing body are permanent records.'),
  ('ordinances','Ordinances and resolutions', NULL, true, 'General records schedule — enactments', 'Adopted enactments are permanent records.'),
  ('agendas','Agendas and packets', 5, false, 'General records schedule — meeting agendas', 'Retain agendas and support packets five years.'),
  ('notices','Public meeting notices and proofs of posting', 5, false, 'Open meetings act recordkeeping', 'Proof of posting supports open-meetings compliance.'),
  ('public_comments','Public comment cards', 3, false, 'General records schedule — citizen correspondence', 'Retain submitted comment cards three years.'),
  ('records_requests','Public records requests', 3, false, 'General records schedule — records requests', 'Retain request files three years after closure.'),
  ('recordings','Meeting audio and video recordings', 3, false, 'General records schedule — recordings', 'Retain recordings at least until minutes are approved; local rule may extend.')
ON CONFLICT (record_class) DO NOTHING;