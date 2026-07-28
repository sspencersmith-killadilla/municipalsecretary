CREATE TABLE public.agenda_item_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_item_id uuid NOT NULL REFERENCES public.agenda_items(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  plain_summary text NOT NULL DEFAULT '',
  why_it_matters text,
  department text,
  category text NOT NULL DEFAULT 'other',
  cost_disclosed boolean NOT NULL DEFAULT false,
  cost_amount numeric,
  is_grant boolean NOT NULL DEFAULT false,
  grant_award_amount numeric,
  local_match_amount numeric,
  considerations text[] NOT NULL DEFAULT '{}',
  generated_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (agenda_item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_item_briefings TO authenticated;
GRANT ALL ON public.agenda_item_briefings TO service_role;

ALTER TABLE public.agenda_item_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view briefings"
  ON public.agenda_item_briefings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Clerks can manage briefings"
  ON public.agenda_item_briefings FOR ALL TO authenticated
  USING (public.can_manage(auth.uid()))
  WITH CHECK (public.can_manage(auth.uid()));

CREATE TRIGGER set_agenda_item_briefings_updated_at
  BEFORE UPDATE ON public.agenda_item_briefings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_agenda_item_briefings_meeting ON public.agenda_item_briefings(meeting_id);