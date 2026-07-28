CREATE TYPE public.app_role AS ENUM ('admin','clerk','attorney','department_staff','board_member','viewer');
CREATE TYPE public.item_status AS ENUM ('draft','in_review','approved','scheduled','adopted','failed','tabled','withdrawn');
CREATE TYPE public.meeting_status AS ENUM ('draft','published','in_progress','adjourned','cancelled');
CREATE TYPE public.vote_choice AS ENUM ('aye','nay','abstain','recuse','absent');
CREATE TYPE public.attendance_status AS ENUM ('present','absent','excused','remote');
CREATE TYPE public.vote_basis AS ENUM ('present','full_membership','quorum');
CREATE TYPE public.reset_policy AS ENUM ('annual','never');
CREATE TYPE public.workflow_state AS ENUM ('pending','approved','rejected','skipped');

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $fn$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  title text,
  department text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$fn$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id);
$fn$;

CREATE OR REPLACE FUNCTION public.can_manage(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','clerk'));
$fn$;

CREATE POLICY "profiles readable by staff" ON public.profiles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles readable by staff" ON public.user_roles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $fn$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.bodies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  seat_count integer NOT NULL DEFAULT 5,
  quorum_type text NOT NULL DEFAULT 'majority_of_full',
  quorum_value numeric,
  default_location text,
  meeting_cadence text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  photo_url text,
  bio text,
  user_id uuid,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.body_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body_id uuid NOT NULL REFERENCES public.bodies(id) ON DELETE CASCADE,
  seat_label text NOT NULL,
  title text,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  term_start date,
  term_end date,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vote_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  fraction numeric NOT NULL DEFAULT 0.5,
  basis public.vote_basis NOT NULL DEFAULT 'present',
  abstain_counts_as text NOT NULL DEFAULT 'not_counted',
  recusal_reduces_base boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.workflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  approver_role public.app_role,
  approver_user_id uuid,
  step_order integer NOT NULL DEFAULT 0,
  required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.item_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  readings_required integer NOT NULL DEFAULT 1,
  requires_public_hearing boolean NOT NULL DEFAULT false,
  default_vote_rule_id uuid REFERENCES public.vote_rules(id) ON DELETE SET NULL,
  default_workflow_template_id uuid REFERENCES public.workflow_templates(id) ON DELETE SET NULL,
  custom_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.numbering_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type_id uuid NOT NULL REFERENCES public.item_types(id) ON DELETE CASCADE,
  body_id uuid REFERENCES public.bodies(id) ON DELETE CASCADE,
  pattern text NOT NULL DEFAULT 'ORD-{YYYY}-{seq:000}',
  current_seq integer NOT NULL DEFAULT 0,
  reset public.reset_policy NOT NULL DEFAULT 'annual',
  last_reset_year integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.agenda_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  body_id uuid REFERENCES public.bodies(id) ON DELETE CASCADE,
  numbering_style text NOT NULL DEFAULT 'numeric',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.agenda_template_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.agenda_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  section_order integer NOT NULL DEFAULT 0,
  is_consent boolean NOT NULL DEFAULT false,
  allows_items boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.legislative_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_number text,
  assigned_number text,
  title text NOT NULL,
  summary text,
  body_text text,
  fiscal_impact text,
  sponsor text,
  department text,
  item_type_id uuid REFERENCES public.item_types(id) ON DELETE SET NULL,
  body_id uuid REFERENCES public.bodies(id) ON DELETE SET NULL,
  status public.item_status NOT NULL DEFAULT 'draft',
  readings_completed integer NOT NULL DEFAULT 0,
  custom_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  adopted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX legislative_items_status_idx ON public.legislative_items (status);
CREATE INDEX legislative_items_body_idx ON public.legislative_items (body_id);

CREATE TABLE public.item_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.legislative_items(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  title text,
  body_text text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.item_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.legislative_items(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.workflow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.legislative_items(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.workflow_templates(id) ON DELETE SET NULL,
  state public.workflow_state NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.workflow_step_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
  step_id uuid REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  step_name text NOT NULL,
  step_order integer NOT NULL DEFAULT 0,
  approver_role public.app_role,
  approver_user_id uuid,
  state public.workflow_state NOT NULL DEFAULT 'pending',
  acted_by uuid,
  acted_at timestamptz,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body_id uuid NOT NULL REFERENCES public.bodies(id) ON DELETE CASCADE,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  location text,
  status public.meeting_status NOT NULL DEFAULT 'draft',
  agenda_template_id uuid REFERENCES public.agenda_templates(id) ON DELETE SET NULL,
  published_at timestamptz,
  current_agenda_item_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meetings_starts_at_idx ON public.meetings (starts_at);

CREATE TABLE public.agenda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.legislative_items(id) ON DELETE SET NULL,
  section_name text NOT NULL DEFAULT 'New Business',
  section_order integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  display_number text,
  title text NOT NULL,
  is_consent boolean NOT NULL DEFAULT false,
  time_certain timestamptz,
  outcome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agenda_items_meeting_idx ON public.agenda_items (meeting_id);

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL DEFAULT 'present',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, member_id)
);

CREATE TABLE public.motions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  agenda_item_id uuid REFERENCES public.agenda_items(id) ON DELETE CASCADE,
  text text NOT NULL,
  mover_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  seconder_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  vote_rule_id uuid REFERENCES public.vote_rules(id) ON DELETE SET NULL,
  is_open boolean NOT NULL DEFAULT true,
  result text,
  tally jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motion_id uuid NOT NULL REFERENCES public.motions(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  choice public.vote_choice NOT NULL,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (motion_id, member_id)
);

CREATE TABLE public.minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL UNIQUE REFERENCES public.meetings(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  finalized boolean NOT NULL DEFAULT false,
  finalized_at timestamptz,
  finalized_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  detail text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.settings (
  id integer PRIMARY KEY DEFAULT 1,
  municipality_name text NOT NULL DEFAULT 'City of Example',
  tagline text,
  notice_days integer NOT NULL DEFAULT 3,
  posting_deadline_hours integer NOT NULL DEFAULT 72,
  public_comment_enabled boolean NOT NULL DEFAULT true,
  contact_email text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_singleton CHECK (id = 1)
);

DO $blk$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','bodies','members','body_seats','vote_rules','workflow_templates','item_types','numbering_rules','agenda_templates','legislative_items','workflow_instances','meetings','agenda_items','attendance','motions','minutes','settings']
  LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $blk$;

DO $blk$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bodies','members','body_seats','vote_rules','workflow_templates','workflow_steps','item_types','numbering_rules','agenda_templates','agenda_template_sections','legislative_items','item_versions','item_attachments','workflow_instances','workflow_step_actions','meetings','agenda_items','attendance','motions','votes','minutes','audit_log','settings']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $blk$;

DO $blk$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bodies','members','body_seats','item_types','agenda_templates','agenda_template_sections','vote_rules','settings']
  LOOP
    EXECUTE format('CREATE POLICY "public read" ON public.%I FOR SELECT USING (true)', t);
    EXECUTE format('CREATE POLICY "managers write" ON public.%I FOR ALL TO authenticated USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()))', t);
  END LOOP;
END $blk$;

DO $blk$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['workflow_templates','workflow_steps','numbering_rules','workflow_instances','workflow_step_actions','audit_log']
  LOOP
    EXECUTE format('CREATE POLICY "staff read" ON public.%I FOR SELECT TO authenticated USING (public.is_staff(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "managers write" ON public.%I FOR ALL TO authenticated USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()))', t);
  END LOOP;
END $blk$;

CREATE POLICY "public read published items" ON public.legislative_items FOR SELECT
  USING (status NOT IN ('draft','in_review','withdrawn'));
CREATE POLICY "staff read all items" ON public.legislative_items FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "staff create items" ON public.legislative_items FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "author or manager update items" ON public.legislative_items FOR UPDATE TO authenticated
  USING (public.can_manage(auth.uid()) OR (created_by = auth.uid() AND status IN ('draft','in_review')));
CREATE POLICY "manager delete items" ON public.legislative_items FOR DELETE TO authenticated
  USING (public.can_manage(auth.uid()));

CREATE POLICY "public read item versions" ON public.item_versions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.legislative_items i WHERE i.id = item_id AND i.status NOT IN ('draft','in_review','withdrawn')));
CREATE POLICY "staff manage item versions" ON public.item_versions FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "public read item attachments" ON public.item_attachments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.legislative_items i WHERE i.id = item_id AND i.status NOT IN ('draft','in_review','withdrawn')));
CREATE POLICY "staff manage item attachments" ON public.item_attachments FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "public read published meetings" ON public.meetings FOR SELECT
  USING (status IN ('published','in_progress','adjourned','cancelled'));
CREATE POLICY "staff read meetings" ON public.meetings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "managers write meetings" ON public.meetings FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

CREATE POLICY "public read agenda items" ON public.agenda_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND m.status IN ('published','in_progress','adjourned','cancelled')));
CREATE POLICY "staff read agenda items" ON public.agenda_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "managers write agenda items" ON public.agenda_items FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

DO $blk$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['attendance','motions']
  LOOP
    EXECUTE format('CREATE POLICY "public read" ON public.%I FOR SELECT USING (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND m.status IN (''published'',''in_progress'',''adjourned'')))', t);
    EXECUTE format('CREATE POLICY "staff read" ON public.%I FOR SELECT TO authenticated USING (public.is_staff(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "managers write" ON public.%I FOR ALL TO authenticated USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()))', t);
  END LOOP;
END $blk$;

CREATE POLICY "public read votes" ON public.votes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.motions mo JOIN public.meetings m ON m.id = mo.meeting_id WHERE mo.id = motion_id AND m.status IN ('published','in_progress','adjourned')));
CREATE POLICY "staff read votes" ON public.votes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "managers write votes" ON public.votes FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

CREATE POLICY "public read final minutes" ON public.minutes FOR SELECT USING (finalized = true);
CREATE POLICY "staff read minutes" ON public.minutes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "managers write minutes" ON public.minutes FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

INSERT INTO public.settings (id) VALUES (1) ON CONFLICT DO NOTHING;