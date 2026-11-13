CREATE OR REPLACE FUNCTION public.save_ai_chat_message(
  p_agency_id text,
  p_user_identifier text,
  p_role text,
  p_content text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_id uuid;
  clean_agency_id text;
  clean_user_identifier text;
BEGIN
  clean_agency_id := lower(btrim(coalesce(p_agency_id, '')));
  clean_user_identifier := lower(btrim(coalesce(p_user_identifier, '')));

  IF clean_agency_id = '' THEN
    RAISE EXCEPTION 'agency_id is required';
  END IF;

  IF clean_user_identifier = '' THEN
    RAISE EXCEPTION 'user_identifier is required';
  END IF;

  INSERT INTO public.ai_chat_messages (agency_id, user_identifier, role, content)
  VALUES (clean_agency_id, clean_user_identifier, p_role, p_content)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_ai_chat_messages(
  p_agency_id text,
  p_user_identifier text,
  p_days_back integer DEFAULT 90
)
RETURNS TABLE(id uuid, role text, content text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  clean_agency_id text;
  clean_user_identifier text;
BEGIN
  clean_agency_id := lower(btrim(coalesce(p_agency_id, '')));
  clean_user_identifier := lower(btrim(coalesce(p_user_identifier, '')));

  IF clean_agency_id = '' THEN
    RAISE EXCEPTION 'agency_id is required';
  END IF;

  IF clean_user_identifier = '' THEN
    RAISE EXCEPTION 'user_identifier is required';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.role,
    m.content,
    m.created_at
  FROM public.ai_chat_messages m
  WHERE lower(btrim(m.agency_id)) = clean_agency_id
    AND lower(btrim(m.user_identifier)) = clean_user_identifier
    AND m.created_at > (now() - (p_days_back || ' days')::interval)
  ORDER BY m.created_at ASC
  LIMIT 100;
END;
$function$;

ALTER TABLE public.ai_chat_rate_limits
ADD COLUMN IF NOT EXISTS agency_id text;

UPDATE public.ai_chat_rate_limits
SET agency_id = 'global'
WHERE agency_id IS NULL OR btrim(agency_id) = '';

ALTER TABLE public.ai_chat_rate_limits
ALTER COLUMN agency_id SET DEFAULT 'global';

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_chat_rate_limits_agency_user
ON public.ai_chat_rate_limits (agency_id, user_identifier);

CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(
  p_user_identifier text,
  p_max_requests integer DEFAULT 10,
  p_window_hours integer DEFAULT 1,
  p_agency_id text DEFAULT 'global'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_record ai_chat_rate_limits%ROWTYPE;
  v_window_start timestamp with time zone;
  v_remaining integer;
  clean_agency_id text;
  clean_user_identifier text;
BEGIN
  clean_agency_id := lower(btrim(coalesce(p_agency_id, 'global')));
  clean_user_identifier := lower(btrim(coalesce(p_user_identifier, '')));

  IF clean_agency_id = '' THEN
    clean_agency_id := 'global';
  END IF;

  IF clean_user_identifier = '' THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'error', 'user_identifier is required');
  END IF;

  v_window_start := now() - (p_window_hours || ' hours')::interval;

  SELECT * INTO v_record
  FROM public.ai_chat_rate_limits
  WHERE agency_id = clean_agency_id
    AND user_identifier = clean_user_identifier
  LIMIT 1;

  IF v_record.id IS NULL THEN
    INSERT INTO public.ai_chat_rate_limits (agency_id, user_identifier, request_count, window_start)
    VALUES (clean_agency_id, clean_user_identifier, 1, now())
    RETURNING * INTO v_record;

    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', p_max_requests - 1,
      'reset_at', v_record.window_start + (p_window_hours || ' hours')::interval
    );
  END IF;

  IF v_record.window_start < v_window_start THEN
    UPDATE public.ai_chat_rate_limits
    SET request_count = 1, window_start = now(), updated_at = now()
    WHERE id = v_record.id
    RETURNING * INTO v_record;

    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', p_max_requests - 1,
      'reset_at', v_record.window_start + (p_window_hours || ' hours')::interval
    );
  END IF;

  IF v_record.request_count >= p_max_requests THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'reset_at', v_record.window_start + (p_window_hours || ' hours')::interval,
      'error', 'Rate limit exceeded. Maximum ' || p_max_requests || ' messages per hour.'
    );
  END IF;

  UPDATE public.ai_chat_rate_limits
  SET request_count = request_count + 1, updated_at = now()
  WHERE id = v_record.id
  RETURNING * INTO v_record;

  v_remaining := greatest(p_max_requests - v_record.request_count, 0);

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', v_remaining,
    'reset_at', v_record.window_start + (p_window_hours || ' hours')::interval
  );
END;
$function$;

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_agency_user_lower
ON public.ai_chat_messages (lower(btrim(agency_id)), lower(btrim(user_identifier)), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agency_owner_messages_agency_user_lower
ON public.agency_owner_messages (lower(btrim(agency_id)), lower(btrim(user_identifier)), created_at DESC);