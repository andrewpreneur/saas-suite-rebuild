CREATE TABLE public.ghl_connections (
  agency_id text PRIMARY KEY,
  company_id text NOT NULL,
  token_ciphertext text NOT NULL,
  token_nonce text NOT NULL,
  key_version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'connected',
  company_name text,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  last_sync_at timestamptz,
  connected_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ghl_connections TO service_role;
ALTER TABLE public.ghl_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ghl_locations_cache (
  agency_id text NOT NULL,
  location_id text NOT NULL,
  name text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agency_id, location_id)
);
GRANT ALL ON public.ghl_locations_cache TO service_role;
ALTER TABLE public.ghl_locations_cache ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ghl_custom_menus_cache (
  agency_id text NOT NULL,
  menu_id text NOT NULL,
  title text,
  url text,
  show_on_company boolean,
  location_ids text[],
  all_locations boolean,
  user_roles jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agency_id, menu_id)
);
GRANT ALL ON public.ghl_custom_menus_cache TO service_role;
ALTER TABLE public.ghl_custom_menus_cache ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.menu_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id text NOT NULL,
  name text NOT NULL DEFAULT 'Purchase automation',
  secret_hash text,
  secret_prefix text,
  secret_rotated_at timestamptz,
  product_presets jsonb NOT NULL DEFAULT '{}'::jsonb,
  allow_any_preset boolean NOT NULL DEFAULT true,
  allow_single_location_email boolean NOT NULL DEFAULT true,
  legacy_until timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX menu_automations_secret_hash_idx ON public.menu_automations(secret_hash) WHERE secret_hash IS NOT NULL;
CREATE INDEX menu_automations_agency_idx ON public.menu_automations(agency_id);
GRANT ALL ON public.menu_automations TO service_role;
ALTER TABLE public.menu_automations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.menu_automation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id text NOT NULL,
  automation_id uuid REFERENCES public.menu_automations(id) ON DELETE SET NULL,
  event_id text NOT NULL,
  payload_hash text NOT NULL,
  email text,
  preset_name text,
  product_id text,
  subscription_id text,
  explicit_location_id text,
  status text NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  location_ids text[] NOT NULL DEFAULT '{}',
  candidate_location_ids text[] NOT NULL DEFAULT '{}',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, automation_id, event_id)
);
CREATE INDEX menu_automation_events_due_idx ON public.menu_automation_events(status, next_run_at);
GRANT ALL ON public.menu_automation_events TO service_role;
ALTER TABLE public.menu_automation_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.location_mappings (
  agency_id text NOT NULL,
  key_type text NOT NULL,
  key_value text NOT NULL,
  location_id text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agency_id, key_type, key_value)
);
GRANT ALL ON public.location_mappings TO service_role;
ALTER TABLE public.location_mappings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.menu_link_rules ADD COLUMN IF NOT EXISTS automation_id uuid;