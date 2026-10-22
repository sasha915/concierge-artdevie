-- Lot 6.1 : proposition à valider par le membre.
CREATE TABLE IF NOT EXISTS public.request_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'en attente' CHECK (status IN ('en attente', 'acceptée', 'déclinée')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
-- Une seule proposition en attente par demande.
CREATE UNIQUE INDEX IF NOT EXISTS request_proposals_one_pending ON public.request_proposals (request_id) WHERE status = 'en attente';

CREATE TABLE IF NOT EXISTS public.request_proposal_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.request_proposals(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(btrim(label)) > 0 AND length(label) <= 160),
  detail text NOT NULL DEFAULT '' CHECK (length(detail) <= 2000),
  estimate_cents integer CHECK (estimate_cents IS NULL OR estimate_cents >= 0),
  chosen boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS request_proposal_options_proposal_idx ON public.request_proposal_options (proposal_id, sort_order);

GRANT ALL ON public.request_proposals, public.request_proposal_options TO service_role;
REVOKE ALL ON public.request_proposals, public.request_proposal_options FROM anon, authenticated;
GRANT SELECT ON public.request_proposals, public.request_proposal_options TO authenticated;
ALTER TABLE public.request_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_proposal_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membres voient les propositions de leurs demandes" ON public.request_proposals
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND r.user_id = auth.uid()));
CREATE POLICY "Membres voient les options de leurs propositions" ON public.request_proposal_options
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.request_proposals p JOIN public.requests r ON r.id = p.request_id WHERE p.id = proposal_id AND r.user_id = auth.uid()));
