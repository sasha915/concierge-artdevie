-- 30 octobre (analyse complète) : anonymisation RGPD complète, trace des alertes WhatsApp qui n'atteignent pas l'application.
-- Écrite pour pouvoir être rejouée sans effet de bord.

-- 1) Anonymisation : tout texte libre lié au membre est effacé ; les factures restent (obligation comptable).
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
  UPDATE public.request_proposal_options SET label = 'Option', detail = ''
    WHERE proposal_id IN (SELECT p.id FROM public.request_proposals p JOIN public.requests r ON r.id = p.request_id WHERE r.user_id = _user_id);
  UPDATE public.request_events SET detail = NULL
    WHERE request_id IN (SELECT id FROM public.requests WHERE user_id = _user_id);
  DELETE FROM public.request_notes WHERE request_id IN (SELECT id FROM public.requests WHERE user_id = _user_id);
  DELETE FROM public.request_files WHERE request_id IN (SELECT id FROM public.requests WHERE user_id = _user_id);
  UPDATE public.requests SET
    title = 'Demande ' || lower(category),
    description = '',
    team_reply = NULL,
    team_reply_at = NULL,
    delegate_record = NULL
  WHERE user_id = _user_id;

  DELETE FROM public.member_notifications WHERE user_id = _user_id;
  DELETE FROM public.member_preferences WHERE user_id = _user_id;
  DELETE FROM public.recurring_requests WHERE user_id = _user_id;
  DELETE FROM public.member_delegates WHERE member_id = _user_id;
  DELETE FROM public.referrals WHERE inviter_id = _user_id;
  -- Recommandation dont le membre était la personne recommandée : ses nom et adresse disparaissent aussi.
  UPDATE public.referrals SET
    full_name = 'Personne recommandée',
    email = 'supprime-' || id::text || '@invalid.artdevie.co',
    message = NULL,
    converted_member_id = NULL
  WHERE converted_member_id = _user_id;

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
    encrypted_password = NULL,
    raw_user_meta_data = '{}'::jsonb,
    raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'account_kind', 'supprime')
  WHERE id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.anonymize_member(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_member(uuid) TO service_role;

-- 2) Alertes WhatsApp : chaque appel vers l'application est suivi ; une réponse absente ou en erreur est consignée.
CREATE TABLE IF NOT EXISTS public.notification_calls (
  net_request_id bigint PRIMARY KEY,
  request_id uuid REFERENCES public.requests(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  checked_at timestamptz
);
REVOKE ALL ON public.notification_calls FROM anon, authenticated;
GRANT ALL ON public.notification_calls TO service_role;
ALTER TABLE public.notification_calls ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.post_concierge_notification(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  endpoint text;
  webhook_secret text;
  call_id bigint;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO webhook_secret FROM vault.decrypted_secrets WHERE name = 'notify_concierge_webhook_secret' LIMIT 1;
    SELECT decrypted_secret INTO endpoint FROM vault.decrypted_secrets WHERE name = 'notify_concierge_endpoint' LIMIT 1;
    IF webhook_secret IS NULL OR endpoint IS NULL THEN
      RAISE WARNING 'post_concierge_notification: secret ou adresse absents du coffre';
      INSERT INTO public.notification_failures (request_id, kind, reason) VALUES (_request_id, 'demande', 'adresse_ou_secret_absent');
      RETURN;
    END IF;
    SELECT net.http_post(
      url := endpoint,
      headers := jsonb_build_object('content-type', 'application/json', 'authorization', 'Bearer ' || webhook_secret),
      body := jsonb_build_object('record', jsonb_build_object('id', _request_id)),
      timeout_milliseconds := 5000
    ) INTO call_id;
    INSERT INTO public.notification_calls (net_request_id, request_id) VALUES (call_id, _request_id) ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'post_concierge_notification failed: %', SQLERRM;
    INSERT INTO public.notification_failures (request_id, kind, reason) VALUES (_request_id, 'demande', 'application_injoignable');
  END;
END;
$$;
REVOKE ALL ON FUNCTION public.post_concierge_notification(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_concierge_notification(uuid) TO service_role;

-- Relève des réponses : toutes les 5 minutes, un appel sans réponse 2xx après 2 minutes devient un échec visible.
CREATE OR REPLACE FUNCTION public.check_notification_calls()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net'
AS $$
DECLARE
  c record;
  failed integer := 0;
BEGIN
  FOR c IN
    SELECT nc.net_request_id, nc.request_id, r.status_code, r.timed_out, r.error_msg
    FROM public.notification_calls nc
    LEFT JOIN net._http_response r ON r.id = nc.net_request_id
    WHERE nc.checked_at IS NULL AND nc.created_at < now() - interval '2 minutes'
  LOOP
    IF c.status_code IS NULL OR c.status_code < 200 OR c.status_code >= 300 OR coalesce(c.timed_out, false) THEN
      INSERT INTO public.notification_failures (request_id, kind, reason)
      VALUES (c.request_id, 'demande', 'application_injoignable' || CASE WHEN c.status_code IS NOT NULL THEN ':' || c.status_code ELSE '' END);
      failed := failed + 1;
    END IF;
    UPDATE public.notification_calls SET checked_at = now() WHERE net_request_id = c.net_request_id;
  END LOOP;
  DELETE FROM public.notification_calls WHERE checked_at < now() - interval '7 days';
  RETURN failed;
END;
$$;
REVOKE ALL ON FUNCTION public.check_notification_calls() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_notification_calls() TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'art-de-vie-alertes-whatsapp') THEN
    PERFORM cron.schedule('art-de-vie-alertes-whatsapp', '*/5 * * * *', 'SELECT public.check_notification_calls()');
  END IF;
END $$;
