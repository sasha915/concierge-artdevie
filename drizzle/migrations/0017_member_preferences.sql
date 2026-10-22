-- Lot 4.3 : préférences et habitudes du membre, consignées par l'équipe.
-- Aucun accès membre à ce stade : lecture et écriture uniquement par les fonctions serveur de l'équipe.
CREATE TABLE IF NOT EXISTS public.member_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  tables text NOT NULL DEFAULT '',
  sejours text NOT NULL DEFAULT '',
  transferts text NOT NULL DEFAULT '',
  dates_cles text NOT NULL DEFAULT '',
  calendrier text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT ALL ON public.member_preferences TO service_role;
REVOKE ALL ON public.member_preferences FROM anon, authenticated;
ALTER TABLE public.member_preferences ENABLE ROW LEVEL SECURITY;
