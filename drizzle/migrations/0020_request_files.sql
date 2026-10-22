-- Lot 5.2 : pièces jointes d'une demande.
-- Espace de stockage privé ; envoi et téléchargement uniquement par les fonctions serveur (liens signés).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('request-files', 'request-files', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.request_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  path text NOT NULL UNIQUE,
  name text NOT NULL,
  size integer NOT NULL CHECK (size > 0 AND size <= 10485760),
  mime text NOT NULL,
  uploaded_by uuid,
  visible_to_member boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS request_files_request_idx ON public.request_files (request_id, created_at);

GRANT ALL ON public.request_files TO service_role;
REVOKE ALL ON public.request_files FROM anon, authenticated;
GRANT SELECT ON public.request_files TO authenticated;
ALTER TABLE public.request_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membres voient les documents visibles de leurs demandes" ON public.request_files
  FOR SELECT TO authenticated
  USING (visible_to_member AND EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND r.user_id = auth.uid()));
