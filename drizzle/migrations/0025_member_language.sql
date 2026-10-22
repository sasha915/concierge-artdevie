-- Lot 6.5 : langue de l'espace membre (fr par défaut, en).
-- Le membre la choisit depuis Membership (fonction serveur setMyLanguage) ; l'équipe la voit et la modifie sur la fiche membre.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'fr' CHECK (language IN ('fr', 'en'));
