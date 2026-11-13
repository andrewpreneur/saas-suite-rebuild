CREATE TABLE public.challenge_point_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 entry_id uuid NOT NULL REFERENCES public.giveaway_entries(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,
 user_name text NOT NULL,
 completion_ids uuid[] NOT NULL,
 module_ids text[] NOT NULL,
 started_at timestamptz NOT NULL,
 ended_at timestamptz NOT NULL,
 reason text NOT NULL,
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(entry_id,user_id,started_at,ended_at)
);
GRANT SELECT ON public.challenge_point_reviews TO authenticated;
GRANT ALL ON public.challenge_point_reviews TO service_role;
ALTER TABLE public.challenge_point_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account members read their private challenge review" ON public.challenge_point_reviews FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.giveaway_entries e WHERE e.id=entry_id AND (e.email=public.current_auth_email() OR EXISTS(SELECT 1 FROM public.account_admins a WHERE lower(a.owner_email)=e.email AND lower(a.admin_email)=public.current_auth_email() AND a.status='accepted'))));
CREATE OR REPLACE FUNCTION public.challenge_review_touch() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TRIGGER challenge_review_touch BEFORE UPDATE ON public.challenge_point_reviews FOR EACH ROW EXECUTE FUNCTION public.challenge_review_touch();
CREATE OR REPLACE FUNCTION public.challenge_suspicious_bursts(_from timestamptz, _until timestamptz)
RETURNS TABLE(entry_id uuid,user_id uuid,user_name text,completion_ids uuid[],module_ids text[],started_at timestamptz,ended_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH ids AS (
 SELECT DISTINCT e.id entry_id,e.opted_in_at,unnest(array_remove(ARRAY[e.agency_id,s.agency_id,s.agency_id_basic,s.agency_id_advanced,s.agency_id_elite],NULL)) agency_id
 FROM public.giveaway_entries e LEFT JOIN public.saas_suite_users s ON lower(s.email)=e.email
), eligible AS (
 SELECT ei.entry_id,mc.id,mc.user_id,coalesce(nullif(trim(up.name),''),'Unnamed user') user_name,mc.module_id,mc.completed_at,
 lag(mc.completed_at) OVER(PARTITION BY ei.entry_id,mc.user_id ORDER BY mc.completed_at,mc.id) prev
 FROM ids ei JOIN public.user_progress up ON up.agency_id=ei.agency_id JOIN public.module_completion mc ON mc.user_id=up.id
 WHERE mc.completed IS TRUE AND mc.completed_at>=greatest(ei.opted_in_at,_from) AND mc.completed_at<=least(_until,'2026-10-26 04:59:00+00'::timestamptz)
), grouped AS (
 SELECT *,sum(CASE WHEN prev IS NULL OR completed_at-prev>interval '10 seconds' THEN 1 ELSE 0 END) OVER(PARTITION BY entry_id,user_id ORDER BY completed_at,id) burst FROM eligible
)
SELECT entry_id,user_id,max(user_name),array_agg(id ORDER BY completed_at,id),array_agg(module_id ORDER BY completed_at,id),min(completed_at),max(completed_at)
FROM grouped GROUP BY entry_id,user_id,burst
HAVING count(*)>=10 AND max(completed_at)-min(completed_at)<=interval '2 minutes';
$$;
REVOKE ALL ON FUNCTION public.challenge_suspicious_bursts(timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_suspicious_bursts(timestamptz,timestamptz) TO service_role;
CREATE OR REPLACE FUNCTION public.challenge_my_point_reviews(_owner_email text)
RETURNS SETOF public.challenge_point_reviews LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT r.* FROM public.challenge_point_reviews r JOIN public.giveaway_entries e ON e.id=r.entry_id
 WHERE e.email=lower(trim(_owner_email)) AND auth.uid() IS NOT NULL AND
 (e.email=public.current_auth_email() OR EXISTS(SELECT 1 FROM public.account_admins a WHERE lower(a.owner_email)=e.email AND lower(a.admin_email)=public.current_auth_email() AND a.status='accepted'))
 ORDER BY r.started_at DESC;
$$;
REVOKE ALL ON FUNCTION public.challenge_my_point_reviews(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.challenge_my_point_reviews(text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.giveaway_recalculate(_email text)
RETURNS public.giveaway_entries LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$
DECLARE
 v_entry public.giveaway_entries; v_ids text[]; v_since timestamptz; v_until timestamptz;
 n_users int:=0; n_modules int:=0; n_checklists int:=0; n_login_days int:=0; has_slack boolean:=false; v_points int:=0;
BEGIN
 SELECT * INTO v_entry FROM public.giveaway_entries WHERE email=lower(_email);
 IF NOT FOUND THEN RETURN NULL; END IF;
 v_since:=v_entry.opted_in_at;
 v_until:=LEAST(now(),'2026-10-26 04:59:00+00'::timestamptz);
 SELECT COALESCE(array_remove(ARRAY[s.agency_id,s.agency_id_basic,s.agency_id_advanced,s.agency_id_elite],NULL),ARRAY[]::text[]) INTO v_ids FROM public.saas_suite_users s WHERE lower(s.email)=v_entry.email LIMIT 1;
 v_ids:=COALESCE(v_ids,ARRAY[]::text[]);
 IF v_entry.agency_id IS NOT NULL AND NOT(v_entry.agency_id=ANY(v_ids)) THEN v_ids:=v_ids||v_entry.agency_id; END IF;
 IF array_length(v_ids,1)>0 THEN
 SELECT count(*) INTO n_users FROM public.user_progress up WHERE up.agency_id=ANY(v_ids) AND up.created_at>=v_since AND up.created_at<=v_until;
 SELECT count(*) INTO n_modules FROM public.module_completion mc JOIN public.user_progress up ON up.id=mc.user_id
 WHERE up.agency_id=ANY(v_ids) AND mc.completed IS TRUE AND mc.completed_at>=v_since AND mc.completed_at<=v_until
 AND NOT EXISTS(SELECT 1 FROM public.challenge_point_reviews r WHERE r.entry_id=v_entry.id AND mc.id=ANY(r.completion_ids));
 SELECT count(*) INTO n_checklists FROM public.user_onboarding_checklist_completion c WHERE c.agency_id=ANY(v_ids) AND c.completed_at>=v_since AND c.completed_at<=v_until;
 SELECT count(*) INTO n_login_days FROM (SELECT DISTINCT lower(pe.user_email) u,(pe.created_at AT TIME ZONE 'America/Chicago')::date d FROM public.platform_events pe WHERE pe.agency_id=ANY(v_ids) AND pe.trigger_type IN ('existing_user_login','new_user_login') AND pe.user_email IS NOT NULL AND pe.created_at>=v_since AND pe.created_at<=v_until) x;
 SELECT EXISTS(SELECT 1 FROM public.slack_workspace_links w WHERE (w.agency_id=ANY(v_ids) OR w.agency_ids&&v_ids) AND w.created_at>=v_since AND w.created_at<=v_until) INTO has_slack;
 END IF;
 v_points:=n_users+n_modules+n_checklists+n_login_days+CASE WHEN has_slack THEN 20 ELSE 0 END;
 UPDATE public.giveaway_entries SET points=v_points,tickets=0,last_scored_at=now(),breakdown=jsonb_build_object('users_onboarded',n_users,'users_onboarded_points',n_users,'module_completions',n_modules,'module_completion_points',n_modules,'checklist_completions',n_checklists,'checklist_completion_points',n_checklists,'login_days',n_login_days,'login_day_points',n_login_days,'slack_connected',has_slack,'slack_points',CASE WHEN has_slack THEN 20 ELSE 0 END),updated_at=now() WHERE email=v_entry.email RETURNING * INTO v_entry;
 RETURN v_entry;
END;
$function$;