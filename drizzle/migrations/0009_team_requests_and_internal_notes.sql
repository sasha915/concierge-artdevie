-- La notification équipe ne part que pour les demandes insérées par un membre (rôle authenticated).
-- La condition WHEN est évaluée dans le contexte de l'appelant, avant l'appel de la fonction SECURITY DEFINER.
DROP TRIGGER IF EXISTS on_request_created_notify_concierge ON public.requests;
CREATE TRIGGER on_request_created_notify_concierge
AFTER INSERT ON public.requests
FOR EACH ROW
WHEN (current_user = 'authenticated')
EXECUTE FUNCTION public.notify_concierge_on_request();

CREATE TABLE public.request_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX request_notes_request_idx ON public.request_notes (request_id, created_at);

REVOKE ALL ON public.request_notes FROM anon, authenticated;
GRANT ALL ON public.request_notes TO service_role;
ALTER TABLE public.request_notes ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.request_notes IS 'Notes internes de l''équipe ; accès uniquement via les fonctions serveur (clé de service).';