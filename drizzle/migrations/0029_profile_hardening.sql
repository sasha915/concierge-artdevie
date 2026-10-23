-- Analyse du 23 octobre, points critiques 1 et 2.
-- 1. Le membre ne modifie plus que ses coordonnées, sa langue et ses notifications.
--    Formule, validité, numéro de carte, concierge, identifiants Mollie, e-mail et dates restent à l'équipe
--    (fonctions serveur, clé de service).
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (full_name, phone, language, notify_requests, notify_offers, notify_messages) ON public.profiles TO authenticated;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_full_name_length;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_full_name_length CHECK (length(full_name) <= 80);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_length;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_length CHECK (phone IS NULL OR length(phone) <= 40);

-- 2. Plus de profil membre par défaut : un profil n'est créé que pour un compte ouvert par l'équipe
--    (raw_app_meta_data.account_kind = 'membre' ou 'equipe', posé uniquement avec la clé de service).
--    Une inscription publique, un parrainage ou un proche ne reçoivent donc jamais de profil.
CREATE OR REPLACE FUNCTION public.handle_new_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.raw_app_meta_data->>'account_kind', '') NOT IN ('membre', 'equipe') THEN
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
