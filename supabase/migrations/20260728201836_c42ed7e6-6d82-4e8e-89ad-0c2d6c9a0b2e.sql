CREATE TABLE public.document_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('agenda_packet','minutes')),
  version integer NOT NULL,
  file_name text NOT NULL,
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, doc_type, version)
);

GRANT SELECT, INSERT ON public.document_exports TO authenticated;
GRANT ALL ON public.document_exports TO service_role;

ALTER TABLE public.document_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view document exports"
  ON public.document_exports FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can record document exports"
  ON public.document_exports FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND generated_by = auth.uid());

CREATE INDEX document_exports_meeting_idx ON public.document_exports (meeting_id, doc_type, version DESC);