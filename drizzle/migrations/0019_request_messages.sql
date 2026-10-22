-- Lot 5.1 : fil d'échanges entre le membre et l'équipe sur une demande.
-- Écritures uniquement par les fonctions serveur (membre ou équipe) ; le membre lit les messages de ses seules demandes.
CREATE TABLE IF NOT EXISTS public.request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  author_id uuid,
  author_role text NOT NULL CHECK (author_role IN ('membre', 'équipe')),
  body text NOT NULL CHECK (length(btrim(body)) > 0 AND length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS request_messages_request_idx ON public.request_messages (request_id, created_at);

GRANT ALL ON public.request_messages TO service_role;
REVOKE ALL ON public.request_messages FROM anon, authenticated;
GRANT SELECT ON public.request_messages TO authenticated;
ALTER TABLE public.request_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membres lisent les échanges de leurs demandes" ON public.request_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND r.user_id = auth.uid()));

-- La réponse unique publiée jusqu'ici devient le premier message de l'équipe.
INSERT INTO public.request_messages (request_id, author_id, author_role, body, created_at)
SELECT r.id, NULL, 'équipe', r.team_reply, COALESCE(r.team_reply_at, now())
FROM public.requests r
WHERE r.team_reply IS NOT NULL AND btrim(r.team_reply) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.request_messages m WHERE m.request_id = r.id);
