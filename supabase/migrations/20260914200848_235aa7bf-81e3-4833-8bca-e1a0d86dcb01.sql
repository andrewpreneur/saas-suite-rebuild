-- Rescore only the entrant(s) tied to an agency id, with a short cool-down.
CREATE OR REPLACE FUNCTION public.giveaway_rescore_for_agency(_agency_id text, _min_interval interval DEFAULT '10 seconds')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
BEGIN
  IF _agency_id IS NULL OR _agency_id = '' THEN
    RETURN;
  END IF;

  FOR v_email IN
    SELECT e.email
    FROM public.giveaway_entries e
    LEFT JOIN public.saas_suite_users s ON lower(s.email) = e.email
    WHERE (
        e.agency_id = _agency_id
        OR s.agency_id = _agency_id
        OR s.agency_id_basic = _agency_id
        OR s.agency_id_advanced = _agency_id
        OR s.agency_id_elite = _agency_id
      )
      AND (e.last_scored_at IS NULL OR e.last_scored_at < now() - _min_interval)
  LOOP
    BEGIN
      PERFORM public.giveaway_recalculate(v_email);
    EXCEPTION WHEN OTHERS THEN
      -- never block the originating app write; the hourly backstop will catch up
      NULL;
    END;
  END LOOP;
END;
$$;

-- Generic trigger: reads the agency id from the changed row and rescores.
CREATE OR REPLACE FUNCTION public.giveaway_event_rescore()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_agency text;
BEGIN
  IF TG_TABLE_NAME = 'module_completion' THEN
    IF NEW.completed IS NOT TRUE THEN RETURN NEW; END IF;
    SELECT up.agency_id INTO v_agency FROM public.user_progress up WHERE up.id = NEW.user_id;
  ELSIF TG_TABLE_NAME = 'platform_events' THEN
    IF NEW.trigger_type NOT IN ('existing_user_login', 'new_user_login') THEN RETURN NEW; END IF;
    v_agency := NEW.agency_id;
  ELSE
    v_agency := NEW.agency_id;
  END IF;

  PERFORM public.giveaway_rescore_for_agency(v_agency);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_giveaway_user_progress ON public.user_progress;
CREATE TRIGGER trg_giveaway_user_progress
AFTER INSERT ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.giveaway_event_rescore();

DROP TRIGGER IF EXISTS trg_giveaway_module_completion ON public.module_completion;
CREATE TRIGGER trg_giveaway_module_completion
AFTER INSERT OR UPDATE OF completed ON public.module_completion
FOR EACH ROW EXECUTE FUNCTION public.giveaway_event_rescore();

DROP TRIGGER IF EXISTS trg_giveaway_checklist ON public.user_onboarding_checklist_completion;
CREATE TRIGGER trg_giveaway_checklist
AFTER INSERT ON public.user_onboarding_checklist_completion
FOR EACH ROW EXECUTE FUNCTION public.giveaway_event_rescore();

DROP TRIGGER IF EXISTS trg_giveaway_platform_events ON public.platform_events;
CREATE TRIGGER trg_giveaway_platform_events
AFTER INSERT ON public.platform_events
FOR EACH ROW EXECUTE FUNCTION public.giveaway_event_rescore();

DROP TRIGGER IF EXISTS trg_giveaway_slack_link ON public.slack_workspace_links;
CREATE TRIGGER trg_giveaway_slack_link
AFTER INSERT ON public.slack_workspace_links
FOR EACH ROW EXECUTE FUNCTION public.giveaway_event_rescore();