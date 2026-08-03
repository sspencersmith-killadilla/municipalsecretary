-- 1. members: column-scoped public/staff reads, no email exposure
REVOKE ALL ON public.members FROM anon, authenticated;
GRANT SELECT (id, full_name, photo_url, bio, active, created_at, updated_at) ON public.members TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;

-- 2. public_comments: column-scoped reads, no commenter contact exposure
REVOKE ALL ON public.public_comments FROM anon, authenticated;
GRANT SELECT (id, meeting_id, agenda_item_id, full_name, organization, comment_type, "position", body, status, created_at, updated_at) ON public.public_comments TO anon, authenticated;
GRANT INSERT ON public.public_comments TO anon, authenticated;
GRANT UPDATE, DELETE ON public.public_comments TO authenticated;
GRANT ALL ON public.public_comments TO service_role;

-- 3. cancelled meetings are no longer public
DROP POLICY IF EXISTS "public read published meetings" ON public.meetings;
CREATE POLICY "public read published meetings" ON public.meetings
FOR SELECT USING (status = ANY (ARRAY['published'::meeting_status,'in_progress'::meeting_status,'adjourned'::meeting_status]));

DROP POLICY IF EXISTS "public read agenda items" ON public.agenda_items;
CREATE POLICY "public read agenda items" ON public.agenda_items
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.meetings m
  WHERE m.id = agenda_items.meeting_id
    AND m.status = ANY (ARRAY['published'::meeting_status,'in_progress'::meeting_status,'adjourned'::meeting_status])
));

-- 4. numbering: remove direct signed-in access to the SECURITY DEFINER routine
CREATE OR REPLACE FUNCTION public.admin_assign_item_number(_item_id uuid, _actor uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  it record; rule record; yr integer := extract(year from now())::int;
  nextseq integer; result text; m text; width integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _actor AND role IN ('admin','clerk')) THEN
    RAISE EXCEPTION 'Not authorized to assign numbers';
  END IF;
  SELECT * INTO it FROM public.legislative_items WHERE id = _item_id;
  IF it IS NULL THEN RAISE EXCEPTION 'Item not found'; END IF;
  IF it.assigned_number IS NOT NULL THEN RETURN it.assigned_number; END IF;

  SELECT * INTO rule FROM public.numbering_rules
   WHERE item_type_id = it.item_type_id
   ORDER BY (body_id IS NOT DISTINCT FROM it.body_id) DESC, body_id NULLS LAST
   LIMIT 1;
  IF rule IS NULL THEN RAISE EXCEPTION 'No numbering rule configured for this item type'; END IF;

  IF rule.reset = 'annual' AND COALESCE(rule.last_reset_year, 0) <> yr THEN
    nextseq := 1;
  ELSE
    nextseq := rule.current_seq + 1;
  END IF;

  UPDATE public.numbering_rules SET current_seq = nextseq, last_reset_year = yr WHERE id = rule.id;

  result := replace(replace(rule.pattern, '{YYYY}', yr::text), '{YY}', to_char(now(),'YY'));
  m := substring(result from '\{seq:(0+)\}');
  IF m IS NOT NULL THEN
    width := length(m);
    result := regexp_replace(result, '\{seq:0+\}', lpad(nextseq::text, width, '0'));
  ELSE
    result := replace(result, '{seq}', nextseq::text);
  END IF;

  UPDATE public.legislative_items SET assigned_number = result WHERE id = _item_id;
  INSERT INTO public.audit_log (entity_type, entity_id, action, detail, actor_id)
  VALUES ('legislative_item', _item_id, 'number_assigned', result, _actor);
  RETURN result;
END; $function$;

REVOKE ALL ON FUNCTION public.admin_assign_item_number(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_item_number(uuid, uuid) TO service_role;

DROP FUNCTION IF EXISTS public.assign_item_number(uuid);