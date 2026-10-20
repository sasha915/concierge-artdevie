ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS image_url text;
DROP POLICY IF EXISTS "Offres visibles publiquement" ON public.offers;
CREATE POLICY "Offres publiées visibles publiquement" ON public.offers FOR SELECT TO anon, authenticated USING (published = true);
GRANT ALL ON public.offers TO service_role;
CREATE POLICY "Images d offres lisibles publiquement" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'offer-images');