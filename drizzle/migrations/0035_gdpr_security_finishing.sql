-- 30 octobre : RGPD (anonymisation d'un membre), finitions de sécurité, numérotation des factures, invitations de proches discrètes.
-- Écrite pour pouvoir être rejouée sans effet de bord.

-- 1) Fonctions d'appartenance : plus exécutables par un visiteur non connecté.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_team(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_team(uuid) TO authenticated, service_role;

-- 2) Tarifs des formules : lisibles par les membres et l'équipe seulement (pas par les proches).
DROP POLICY IF EXISTS "Membres lisent les formules" ON public.membership_plans;
CREATE POLICY "Membres lisent les formules" ON public.membership_plans
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()) OR public.is_team(auth.uid()));

-- 3) Numéros de facture : plus de troncature au-delà de 9 999 (ADV-AAAA-0001 … ADV-AAAA-10000).
CREATE OR REPLACE FUNCTION public.create_invoice(_user_id uuid, _kind text, _status text, _amount_cents integer, _request_id uuid DEFAULT NULL::uuid, _service_cents integer DEFAULT NULL::integer, _commission_cents integer DEFAULT NULL::integer, _commission_rate numeric DEFAULT NULL::numeric, _mollie_payment_id text DEFAULT NULL::text)
RETURNS TABLE(id uuid, number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n integer;
  inv_number text;
  inv_id uuid;
BEGIN
  UPDATE public.invoice_counter SET last = last + 1 WHERE invoice_counter.id = 1 RETURNING last INTO n;
  inv_number := 'ADV-' || to_char(now() AT TIME ZONE 'Europe/Paris', 'YYYY') || '-' || CASE WHEN n < 10000 THEN lpad(n::text, 4, '0') ELSE n::text END;
  INSERT INTO public.invoices (user_id, number, kind, status, amount_cents, request_id, service_cents, commission_cents, commission_rate, mollie_payment_id, issued_on)
  VALUES (_user_id, inv_number, _kind, _status, _amount_cents, _request_id, _service_cents, _commission_cents, _commission_rate, _mollie_payment_id, (now() AT TIME ZONE 'Europe/Paris')::date)
  RETURNING invoices.id INTO inv_id;
  RETURN QUERY SELECT inv_id, inv_number;
END;
$$;

-- 4) Invitations de proches : une même adresse peut être invitée par plusieurs membres (rien n'est révélé au membre) ;
--    un seul accès actif par adresse, contrôlé à la confirmation par l'équipe.
DROP INDEX IF EXISTS public.member_delegates_open_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS member_delegates_active_email_key ON public.member_delegates (lower(email)) WHERE status = 'actif';
CREATE UNIQUE INDEX IF NOT EXISTS member_delegates_pending_member_email_key ON public.member_delegates (member_id, lower(email)) WHERE status IN ('en_attente', 'actif');

-- 5) RGPD : anonymisation d'un membre désactivé. Les factures sont conservées (obligation comptable) ;
--    les données personnelles et les contenus libres sont effacés.
CREATE OR REPLACE FUNCTION public.anonymize_member(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND disabled_at IS NOT NULL) THEN
    RAISE EXCEPTION 'compte_actif' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.request_messages SET body = '[Message supprimé à la demande du membre]'
    WHERE request_id IN (SELECT id FROM public.requests WHERE user_id = _user_id);
  UPDATE public.request_changes SET body = ''
    WHERE request_id IN (SELECT id FROM public.requests WHERE user_id = _user_id);
  UPDATE public.request_reviews SET comment = NULL WHERE user_id = _user_id;
  DELETE FROM public.request_notes WHERE request_id IN (SELECT id FROM public.requests WHERE user_id = _user_id);
  DELETE FROM public.request_files WHERE request_id IN (SELECT id FROM public.requests WHERE user_id = _user_id);
  UPDATE public.requests SET description = '', delegate_record = NULL WHERE user_id = _user_id;

  DELETE FROM public.member_notifications WHERE user_id = _user_id;
  DELETE FROM public.member_preferences WHERE user_id = _user_id;
  DELETE FROM public.recurring_requests WHERE user_id = _user_id;
  DELETE FROM public.member_delegates WHERE member_id = _user_id;
  DELETE FROM public.referrals WHERE inviter_id = _user_id;
  UPDATE public.referrals SET converted_member_id = NULL WHERE converted_member_id = _user_id;

  UPDATE public.profiles SET
    full_name = 'Membre supprimé',
    email = NULL,
    phone = NULL,
    concierge_referent = NULL,
    concierge_whatsapp = NULL,
    mollie_subscription_id = NULL
  WHERE id = _user_id;

  DELETE FROM auth.identities WHERE user_id = _user_id;
  DELETE FROM auth.sessions WHERE user_id = _user_id;
  UPDATE auth.users SET
    email = 'supprime-' || _user_id::text || '@invalid.artdevie.co',
    phone = NULL,
    raw_user_meta_data = '{}'::jsonb
  WHERE id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.anonymize_member(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_member(uuid) TO service_role;
