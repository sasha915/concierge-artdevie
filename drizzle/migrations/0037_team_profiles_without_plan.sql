-- 30 octobre : les fiches des comptes de l'équipe ne portent plus de formule (elles n'en ont pas l'usage).
-- Écrite pour pouvoir être rejouée sans effet de bord.

ALTER TABLE public.profiles ALTER COLUMN plan DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_team_account boolean := COALESCE(NEW.raw_app_meta_data->>'account_kind', '') = 'equipe';
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
    CASE WHEN is_team_account THEN NULL ELSE 'Signature' END,
    CASE WHEN is_team_account THEN 'Équipe Art de Vie' ELSE 'Membre Signature' END,
    'N° ADV · ' || to_char(now(), 'MMYY') || ' · ' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 4)),
    CURRENT_DATE,
    (CURRENT_DATE + interval '2 years')::date,
    NULL,
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Fiches existantes de l'équipe (actuelle ou passée).
UPDATE public.profiles SET plan = NULL
WHERE id IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'concierge'))
   OR role_label = 'Équipe Art de Vie';
