CREATE TABLE public.academy_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('lesson','prompt','skill','tech')),
  slug text,
  stage text CHECK (stage IN ('foundation','build','market','sell')),
  title text NOT NULL DEFAULT '',
  description text,
  category text,
  video_url text,
  external_url text,
  thumbnail_url text,
  duration_minutes integer,
  format text,
  prompt_text text,
  file_url text,
  file_label text,
  is_new boolean NOT NULL DEFAULT false,
  owner_only boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.academy_content TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_content TO authenticated;
GRANT ALL ON public.academy_content TO service_role;

ALTER TABLE public.academy_content ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_academy_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce((auth.jwt() ->> 'email'), '')) = 'andrew@dna-media.net'
$$;

CREATE POLICY "Anyone can view published academy content"
ON public.academy_content FOR SELECT
USING (is_published OR public.is_academy_owner());

CREATE POLICY "Owner can insert academy content"
ON public.academy_content FOR INSERT TO authenticated
WITH CHECK (public.is_academy_owner());

CREATE POLICY "Owner can update academy content"
ON public.academy_content FOR UPDATE TO authenticated
USING (public.is_academy_owner())
WITH CHECK (public.is_academy_owner());

CREATE POLICY "Owner can delete academy content"
ON public.academy_content FOR DELETE TO authenticated
USING (public.is_academy_owner());

CREATE OR REPLACE FUNCTION public.academy_content_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER academy_content_set_updated_at
BEFORE UPDATE ON public.academy_content
FOR EACH ROW EXECUTE FUNCTION public.academy_content_touch_updated_at();

CREATE INDEX academy_content_kind_sort_idx ON public.academy_content (kind, sort_order);

CREATE POLICY "Public can read academy assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'academy-assets');

CREATE POLICY "Owner can upload academy assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'academy-assets' AND public.is_academy_owner());

CREATE POLICY "Owner can update academy assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'academy-assets' AND public.is_academy_owner());

CREATE POLICY "Owner can delete academy assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'academy-assets' AND public.is_academy_owner());