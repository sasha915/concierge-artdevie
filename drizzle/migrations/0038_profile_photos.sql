-- 30 octobre : photo de profil des membres et de l'équipe.
-- Stockage privé ; envoi, retrait et lecture uniquement par les fonctions serveur (liens signés).
-- La colonne n'est pas modifiable directement par un compte connecté. Écrite pour pouvoir être rejouée.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', false, 2097152, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_path text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_avatar_path_format') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_path_format CHECK (avatar_path IS NULL OR avatar_path ~ '^[0-9a-f-]{36}/[0-9]+\.jpg$');
  END IF;
END $$;
