-- Lot 5.3 : demandes de modification et avis après prestation.
CREATE TABLE IF NOT EXISTS public.request_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('date', 'couverts', 'precision', 'annulation')),
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 2000),
  status text NOT NULL DEFAULT 'en attente' CHECK (status IN ('en attente', 'acceptée', 'refusée')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Une seule demande de modification en attente par demande.
CREATE UNIQUE INDEX IF NOT EXISTS request_changes_one_pending ON public.request_changes (request_id) WHERE status = 'en attente';

GRANT ALL ON public.request_changes TO service_role;
REVOKE ALL ON public.request_changes FROM anon, authenticated;
GRANT SELECT ON public.request_changes TO authenticated;
ALTER TABLE public.request_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membres voient les modifications de leurs demandes" ON public.request_changes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND r.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.request_reviews (
  request_id uuid PRIMARY KEY REFERENCES public.requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating text NOT NULL CHECK (rating IN ('Parfaite', 'Bien', 'À revoir')),
  comment text NOT NULL DEFAULT '' CHECK (length(comment) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.request_reviews TO service_role;
REVOKE ALL ON public.request_reviews FROM anon, authenticated;
GRANT SELECT ON public.request_reviews TO authenticated;
ALTER TABLE public.request_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membres voient leurs avis" ON public.request_reviews
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
