CREATE OR REPLACE FUNCTION public.audit_item_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (entity_type, entity_id, action, detail, actor_id)
    VALUES ('legislative_item', NEW.id, 'created', NEW.title, auth.uid());
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.audit_log (entity_type, entity_id, action, detail, actor_id)
      VALUES ('legislative_item', NEW.id, 'status_changed',
              coalesce(OLD.status::text,'-') || ' -> ' || NEW.status::text, auth.uid());
    END IF;
    IF NEW.adopted_at IS DISTINCT FROM OLD.adopted_at AND NEW.adopted_at IS NOT NULL THEN
      INSERT INTO public.audit_log (entity_type, entity_id, action, detail, actor_id)
      VALUES ('legislative_item', NEW.id, 'adopted', coalesce(NEW.assigned_number, NEW.title), auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.audit_meeting_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.audit_log (entity_type, entity_id, action, detail, actor_id)
    VALUES ('meeting', NEW.id, 'status_changed',
            coalesce(OLD.status::text,'-') || ' -> ' || NEW.status::text, auth.uid());
  END IF;
  IF NEW.published_at IS DISTINCT FROM OLD.published_at AND NEW.published_at IS NOT NULL THEN
    INSERT INTO public.audit_log (entity_type, entity_id, action, detail, actor_id)
    VALUES ('meeting', NEW.id, 'agenda_published', NEW.title, auth.uid());
  END IF;
  IF NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at AND NEW.cancelled_at IS NOT NULL THEN
    INSERT INTO public.audit_log (entity_type, entity_id, action, detail, actor_id)
    VALUES ('meeting', NEW.id, 'cancelled', coalesce(NEW.cancellation_reason, NEW.title), auth.uid());
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.audit_minutes_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.finalized AND (TG_OP = 'INSERT' OR NOT OLD.finalized) THEN
    INSERT INTO public.audit_log (entity_type, entity_id, action, detail, actor_id)
    VALUES ('minutes', NEW.meeting_id, 'minutes_finalized',
            'SHA-256 ' || coalesce(left(NEW.integrity_hash, 16), 'unsealed'), auth.uid());
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.audit_records_request_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.audit_log (entity_type, entity_id, action, detail, actor_id)
    VALUES ('records_request', NEW.id, 'status_changed',
            NEW.tracking_code || ': ' || coalesce(OLD.status::text,'-') || ' -> ' || NEW.status::text, auth.uid());
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.audit_item_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_meeting_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_minutes_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_records_request_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_items ON public.legislative_items;
CREATE TRIGGER trg_audit_items AFTER INSERT OR UPDATE ON public.legislative_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_item_change();

DROP TRIGGER IF EXISTS trg_audit_meetings ON public.meetings;
CREATE TRIGGER trg_audit_meetings AFTER UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.audit_meeting_change();

DROP TRIGGER IF EXISTS trg_audit_minutes ON public.minutes;
CREATE TRIGGER trg_audit_minutes AFTER INSERT OR UPDATE ON public.minutes
  FOR EACH ROW EXECUTE FUNCTION public.audit_minutes_change();

DROP TRIGGER IF EXISTS trg_audit_records_requests ON public.records_requests;
CREATE TRIGGER trg_audit_records_requests AFTER UPDATE ON public.records_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_records_request_change();