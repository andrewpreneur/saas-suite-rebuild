
-- One-time tokens agency owners generate to link their Slack workspace
CREATE TABLE public.slack_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id TEXT NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  used_at TIMESTAMPTZ,
  used_by_team_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slack_link_tokens TO authenticated;
GRANT ALL ON public.slack_link_tokens TO service_role;

ALTER TABLE public.slack_link_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their own link tokens"
  ON public.slack_link_tokens FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

CREATE POLICY "Owners create their own link tokens"
  ON public.slack_link_tokens FOR INSERT TO authenticated
  WITH CHECK (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

CREATE POLICY "Owners delete their own link tokens"
  ON public.slack_link_tokens FOR DELETE TO authenticated
  USING (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

CREATE INDEX idx_slack_link_tokens_email ON public.slack_link_tokens(lower(email));
CREATE INDEX idx_slack_link_tokens_hash ON public.slack_link_tokens(token_hash);


-- Permanent Slack workspace → agency binding
CREATE TABLE public.slack_workspace_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL UNIQUE,
  team_name TEXT,
  agency_id TEXT NOT NULL,
  linked_by_email TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slack_workspace_links TO authenticated;
GRANT ALL ON public.slack_workspace_links TO service_role;

ALTER TABLE public.slack_workspace_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their own workspace links"
  ON public.slack_workspace_links FOR SELECT TO authenticated
  USING (lower(linked_by_email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

CREATE POLICY "Owners unlink their own workspace"
  ON public.slack_workspace_links FOR DELETE TO authenticated
  USING (lower(linked_by_email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

CREATE INDEX idx_slack_workspace_links_team ON public.slack_workspace_links(team_id);
CREATE INDEX idx_slack_workspace_links_agency ON public.slack_workspace_links(agency_id);

CREATE OR REPLACE FUNCTION public.update_slack_workspace_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_slack_workspace_links_updated_at
  BEFORE UPDATE ON public.slack_workspace_links
  FOR EACH ROW EXECUTE FUNCTION public.update_slack_workspace_links_updated_at();
