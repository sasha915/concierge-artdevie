-- Lot 5.4 : proches autorisés.
-- Un proche (agent, conjoint, assistant) est invité par le membre, confirmé par l'équipe,
-- et fait des demandes au nom du membre avec son propre compte. Il ne lit jamais les tables
-- directement : tout passe par des fonctions serveur qui vérifient la délégation et ne renvoient
-- que les champs utiles (aucun montant, aucune facture, aucune proposition).

CREATE TABLE IF NOT EXISTS public.member_delegates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delegate_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 2 AND 80),
  email text NOT NULL CHECK (length(email) <= 160),
  relation text CHECK (relation IS NULL OR length(relation) <= 60),
  status text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'actif', 'refuse', 'retire')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid,
  revoked_at timestamptz,
  revoked_by uuid
);
CREATE INDEX IF NOT EXISTS member_delegates_member_idx ON public.member_delegates (member_id);
CREATE INDEX IF NOT EXISTS member_delegates_delegate_idx ON public.member_delegates (delegate_id);
-- Une adresse n'est proche que d'un seul membre à la fois (invitation en attente ou accès actif).
CREATE UNIQUE INDEX IF NOT EXISTS member_delegates_open_email_key ON public.member_delegates (lower(email)) WHERE status IN ('en_attente', 'actif');

GRANT ALL ON public.member_delegates TO service_role;
REVOKE ALL ON public.member_delegates FROM anon, authenticated;
GRANT SELECT ON public.member_delegates TO authenticated;
ALTER TABLE public.member_delegates ENABLE ROW LEVEL SECURITY;
-- Le membre voit ses proches ; aucune écriture directe (fonctions serveur seulement).
DROP POLICY IF EXISTS "Membres voient leurs proches" ON public.member_delegates;
CREATE POLICY "Membres voient leurs proches" ON public.member_delegates FOR SELECT TO authenticated USING (member_id = auth.uid());

-- Demandes faites par un proche : rattachées au membre (user_id), signées par la délégation.
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS delegate_record uuid REFERENCES public.member_delegates(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS requests_delegate_record_idx ON public.requests (delegate_record);

-- Compte membre actif : un profil non désactivé.
CREATE OR REPLACE FUNCTION public.is_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND disabled_at IS NULL)
$$;
REVOKE ALL ON FUNCTION public.is_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_member(uuid) TO authenticated, service_role;

-- Durcissement : seuls les membres créent des demandes et des parrainages en direct ;
-- un compte de proche (sans profil) ne peut ni l'un ni l'autre, ni se créer un profil.
DROP POLICY IF EXISTS "Membres creent leurs demandes" ON public.requests;
CREATE POLICY "Membres creent leurs demandes" ON public.requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND delegate_record IS NULL AND public.is_member(auth.uid()));
DROP POLICY IF EXISTS "Members create own referrals" ON public.referrals;
CREATE POLICY "Members create own referrals" ON public.referrals FOR INSERT TO authenticated
  WITH CHECK (inviter_id = auth.uid() AND public.is_member(auth.uid()));
DROP POLICY IF EXISTS "Membres creent leur profil" ON public.profiles;

-- Les comptes de proche ne reçoivent pas de profil membre à leur création.
CREATE OR REPLACE FUNCTION public.handle_new_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.raw_user_meta_data->>'account_kind' = 'proche' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.profiles (id, full_name, email, phone, plan, role_label, member_number, member_since, valid_until, concierge_referent, concierge_whatsapp)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    'Signature',
    'Membre Signature',
    'N° ADV · ' || to_char(now(), 'MMYY') || ' · ' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 4)),
    CURRENT_DATE,
    (CURRENT_DATE + interval '2 years')::date,
    NULL,
    NULL
  );
  RETURN NEW;
END;
$function$;
