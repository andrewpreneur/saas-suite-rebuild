CREATE POLICY "Authenticated users can read community skill packs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'community-skill-packs');

CREATE POLICY "Andrew can upload community skill packs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'community-skill-packs'
  AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'andrew@dna-media.net'
);

CREATE POLICY "Andrew can replace community skill packs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'community-skill-packs'
  AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'andrew@dna-media.net'
)
WITH CHECK (
  bucket_id = 'community-skill-packs'
  AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'andrew@dna-media.net'
);

CREATE POLICY "Andrew can remove community skill packs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'community-skill-packs'
  AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'andrew@dna-media.net'
);