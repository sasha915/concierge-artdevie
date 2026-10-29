-- 29 octobre : comptes désactivés coupés sur-le-champ, alertes des échéances récurrentes, échecs d'alerte gardés pour l'équipe.
-- Écrite pour pouvoir être rejouée sans effet de bord.

-- 1) Un compte désactivé n'a plus accès à aucune donnée, même avec un jeton encore valide.
CREATE OR REPLACE FUNCTION public.account_enabled(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND disabled_at IS NOT NULL)
$$;
REVOKE ALL ON FUNCTION public.account_enabled(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_enabled(uuid) TO authenticated, service_role;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'invoices', 'member_delegates', 'member_notifications', 'membership_plans', 'offers', 'profiles',
    'recurring_requests', 'referrals', 'request_changes', 'request_files', 'request_messages',
    'request_proposal_options', 'request_proposals', 'request_reviews', 'requests', 'user_roles'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'Comptes désactivés exclus') THEN
      EXECUTE format(
        'CREATE POLICY "Comptes désactivés exclus" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.account_enabled(auth.uid())) WITH CHECK (public.account_enabled(auth.uid()))',
        t
      );
    END IF;
  END LOOP;
END $$;

-- Fermeture des sessions ouvertes (appelée à la désactivation, avec la clé de service uniquement).
CREATE OR REPLACE FUNCTION public.revoke_user_sessions(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'auth'
AS $$
  DELETE FROM auth.sessions WHERE user_id = _user_id
$$;
REVOKE ALL ON FUNCTION public.revoke_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(uuid) TO service_role;

-- 2) Échecs d'alerte WhatsApp, gardés pour l'équipe (« À surveiller »).
CREATE TABLE IF NOT EXISTS public.notification_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.requests(id) ON DELETE CASCADE,
  kind text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS notification_failures_open_idx ON public.notification_failures (created_at DESC) WHERE resolved_at IS NULL;
REVOKE ALL ON public.notification_failures FROM anon, authenticated;
GRANT ALL ON public.notification_failures TO service_role;
ALTER TABLE public.notification_failures ENABLE ROW LEVEL SECURITY;

-- 3) Envoi de l'alerte d'une demande, partagé par le trigger des membres et par la tâche des échéances récurrentes.
CREATE OR REPLACE FUNCTION public.post_concierge_notification(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  endpoint text;
  webhook_secret text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO webhook_secret FROM vault.decrypted_secrets WHERE name = 'notify_concierge_webhook_secret' LIMIT 1;
    SELECT decrypted_secret INTO endpoint FROM vault.decrypted_secrets WHERE name = 'notify_concierge_endpoint' LIMIT 1;
    IF webhook_secret IS NULL OR endpoint IS NULL THEN
      RAISE WARNING 'post_concierge_notification: secret ou adresse absents du coffre';
      INSERT INTO public.notification_failures (request_id, kind, reason) VALUES (_request_id, 'demande', 'adresse_ou_secret_absent');
      RETURN;
    END IF;
    PERFORM net.http_post(
      url := endpoint,
      headers := jsonb_build_object('content-type', 'application/json', 'authorization', 'Bearer ' || webhook_secret),
      body := jsonb_build_object('record', jsonb_build_object('id', _request_id)),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'post_concierge_notification failed: %', SQLERRM;
  END;
END;
$$;
REVOKE ALL ON FUNCTION public.post_concierge_notification(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_concierge_notification(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.notify_concierge_on_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  PERFORM public.post_concierge_notification(NEW.id);
  RETURN NEW;
END;
$$;

-- 4) Échéances récurrentes : concierge de la série repris, alerte envoyée pour chacune.
CREATE OR REPLACE FUNCTION public.generate_recurring_requests(_today date DEFAULT ((now() AT TIME ZONE 'Europe/Paris'::text))::date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r public.recurring_requests%ROWTYPE;
  occ date;
  created integer := 0;
  horizon date := _today + 7;
  new_id uuid;
  prev_concierge text;
  prev_concierge_id uuid;
BEGIN
  FOR r IN
    SELECT rr.* FROM public.recurring_requests rr
    JOIN public.profiles p ON p.id = rr.user_id AND p.disabled_at IS NULL
    WHERE NOT rr.paused
    FOR UPDATE OF rr SKIP LOCKED
  LOOP
    -- Concierge de la dernière échéance attribuée de la série (première demande comprise).
    prev_concierge := NULL;
    prev_concierge_id := NULL;
    SELECT q.concierge, q.concierge_id INTO prev_concierge, prev_concierge_id
    FROM public.requests q
    WHERE q.recurring_id = r.id AND q.concierge_id IS NOT NULL
    ORDER BY q.created_at DESC
    LIMIT 1;

    FOR occ IN
      SELECT d FROM (
        SELECT gs::date AS d FROM generate_series(r.start_date, horizon, interval '7 days') gs WHERE r.rhythm = 'hebdomadaire'
        UNION ALL
        SELECT (r.start_date + make_interval(months => k))::date FROM generate_series(0, 600) k
          WHERE r.rhythm = 'mensuelle' AND (r.start_date + make_interval(months => k))::date <= horizon
        UNION ALL
        SELECT unnest(r.dates) WHERE r.rhythm = 'dates'
      ) s
      WHERE d >= _today AND d <= horizon
        AND d > COALESCE(r.last_occurrence, _today - 1)
        AND (r.end_date IS NULL OR d <= r.end_date)
      ORDER BY d
    LOOP
      INSERT INTO public.requests (user_id, category, title, description, scheduled_date, scheduled_time, guests, image_key, recurring_id, concierge, concierge_id)
      VALUES (r.user_id, r.category, r.title, r.description, occ, r.scheduled_time, r.guests, r.image_key, r.id,
              COALESCE(prev_concierge, 'À attribuer'), prev_concierge_id)
      RETURNING id INTO new_id;
      INSERT INTO public.request_events (request_id, actor_id, kind, detail) VALUES (new_id, NULL, 'créée par récurrence', NULL);
      UPDATE public.recurring_requests SET last_occurrence = occ WHERE id = r.id;
      PERFORM public.post_concierge_notification(new_id);
      created := created + 1;
    END LOOP;
  END LOOP;
  RETURN created;
END;
$$;
