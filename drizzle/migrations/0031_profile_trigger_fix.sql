-- Seconde analyse du 23 octobre : régressions de la migration 0029/0030.
-- 1. Le service d'authentification écrit raw_app_meta_data APRÈS l'insertion du compte (UPDATE séparé) :
--    le profil est donc aussi créé à cette mise à jour, une seule fois.
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
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_app_metadata ON auth.users;
CREATE TRIGGER on_auth_user_app_metadata
  AFTER UPDATE OF raw_app_meta_data ON auth.users
  FOR EACH ROW
  WHEN (OLD.raw_app_meta_data IS DISTINCT FROM NEW.raw_app_meta_data)
  EXECUTE FUNCTION public.handle_new_member();

-- 2. Compteur de factures : jamais en dessous d'un numéro déjà attribué (séquence ou factures existantes).
UPDATE public.invoice_counter SET last = GREATEST(
  last,
  COALESCE((SELECT max(NULLIF(substring(number from '-(\d+)$'), '')::int) FROM public.invoices), 0),
  (SELECT CASE WHEN is_called THEN last_value ELSE 0 END FROM public.invoice_number_seq)
) WHERE id = 1;

-- 3. Les fonctions de déclencheur ne sont pas appelables directement ; les rôles d'équipe ne se lisent plus anonymement.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_team(uuid) FROM anon;
