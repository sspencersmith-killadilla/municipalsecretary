CREATE OR REPLACE FUNCTION public.assign_item_number(_item_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  it record; rule record; yr integer := extract(year from now())::int;
  nextseq integer; result text; m text; width integer;
BEGIN
  IF NOT public.can_manage(auth.uid()) THEN
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
  VALUES ('legislative_item', _item_id, 'number_assigned', result, auth.uid());
  RETURN result;
END; $fn$;

REVOKE ALL ON FUNCTION public.assign_item_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_item_number(uuid) TO authenticated;