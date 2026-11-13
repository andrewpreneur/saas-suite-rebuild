CREATE TABLE public.one_feature_kit_actions (action_key text PRIMARY KEY, stripe_id text, completed boolean NOT NULL DEFAULT false, lease_until timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.one_feature_kit_actions TO service_role;
ALTER TABLE public.one_feature_kit_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY kit_actions_server ON public.one_feature_kit_actions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE FUNCTION public.claim_one_feature_kit_action(p_key text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN INSERT INTO public.one_feature_kit_actions(action_key, lease_until) VALUES(p_key, now() + interval '5 minutes') ON CONFLICT DO NOTHING; IF FOUND THEN RETURN true; END IF; UPDATE public.one_feature_kit_actions SET lease_until = now() + interval '5 minutes', updated_at = now() WHERE action_key = p_key AND NOT completed AND lease_until <= now(); RETURN FOUND; END; $$;
REVOKE ALL ON FUNCTION public.claim_one_feature_kit_action(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_one_feature_kit_action(text) TO service_role;
CREATE FUNCTION public.kit_action_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER kit_action_touch BEFORE UPDATE ON public.one_feature_kit_actions FOR EACH ROW EXECUTE FUNCTION public.kit_action_updated_at();