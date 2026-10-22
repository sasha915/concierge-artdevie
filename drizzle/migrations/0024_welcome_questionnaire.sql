-- Lot 6.4 : questionnaire d'accueil.
-- profiles.onboarded_at : renseigné quand le membre termine le questionnaire « Faisons connaissance. ».
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

-- Réponses du membre, distinctes des notes consignées par l'équipe (tables, sejours, transferts, dates_cles, calendrier).
-- Aucun accès direct du membre : lecture et écriture par les fonctions serveur (src/lib/messages.functions.ts).
ALTER TABLE public.member_preferences
  ADD COLUMN IF NOT EXISTS tables_choix text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sejours_choix text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS transferts_choix text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dates_membre text NOT NULL DEFAULT '' CHECK (length(dates_membre) <= 2000),
  ADD COLUMN IF NOT EXISTS member_updated_at timestamptz;
