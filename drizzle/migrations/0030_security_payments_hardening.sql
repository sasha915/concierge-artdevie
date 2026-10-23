-- Analyse du 23 octobre : sécurité, paiements, mise en service, robustesse.

-- 1. Factures : numéro attribué dans la même transaction que la facture (aucun trou possible),
--    un paiement Mollie ne peut produire qu'une seule facture.
CREATE TABLE IF NOT EXISTS public.invoice_counter (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last integer NOT NULL DEFAULT 0 CHECK (last >= 0)
);
REVOKE ALL ON public.invoice_counter FROM anon, authenticated;
GRANT ALL ON public.invoice_counter TO service_role;
ALTER TABLE public.invoice_counter ENABLE ROW LEVEL SECURITY;
INSERT INTO public.invoice_counter (id, last) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_mollie_payment_id_key ON public.invoices (mollie_payment_id) WHERE mollie_payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_invoice(
  _user_id uuid,
  _kind text,
  _status text,
  _amount_cents integer,
  _request_id uuid DEFAULT NULL,
  _service_cents integer DEFAULT NULL,
  _commission_cents integer DEFAULT NULL,
  _commission_rate numeric DEFAULT NULL,
  _mollie_payment_id text DEFAULT NULL
)
RETURNS TABLE (id uuid, number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n integer;
  inv_number text;
  inv_id uuid;
BEGIN
  -- Le compteur est verrouillé jusqu'à la fin de la transaction : si l'insertion échoue, le numéro n'est pas consommé.
  UPDATE public.invoice_counter SET last = last + 1 WHERE invoice_counter.id = 1 RETURNING last INTO n;
  inv_number := 'ADV-' || to_char(now() AT TIME ZONE 'Europe/Paris', 'YYYY') || '-' || lpad(n::text, 4, '0');
  INSERT INTO public.invoices (user_id, number, kind, status, amount_cents, request_id, service_cents, commission_cents, commission_rate, mollie_payment_id, issued_on)
  VALUES (_user_id, inv_number, _kind, _status, _amount_cents, _request_id, _service_cents, _commission_cents, _commission_rate, _mollie_payment_id, (now() AT TIME ZONE 'Europe/Paris')::date)
  RETURNING invoices.id INTO inv_id;
  RETURN QUERY SELECT inv_id, inv_number;
END;
$$;
REVOKE ALL ON FUNCTION public.create_invoice(uuid, text, text, integer, uuid, integer, integer, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice(uuid, text, text, integer, uuid, integer, integer, numeric, text) TO service_role;
-- L'ancienne numérotation par séquence n'est plus utilisée.
REVOKE ALL ON FUNCTION public.next_invoice_number() FROM service_role;

-- 2. Notifications WhatsApp : nouveau secret (jamais écrit dans le code), adresse du webhook rangée dans le coffre.
DO $$
DECLARE sid uuid;
BEGIN
  SELECT id INTO sid FROM vault.secrets WHERE name = 'notify_concierge_webhook_secret';
  IF sid IS NULL THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'notify_concierge_webhook_secret', 'Secret du webhook notify-concierge (WhatsApp)');
  ELSE
    PERFORM vault.update_secret(sid, encode(extensions.gen_random_bytes(32), 'hex'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'notify_concierge_endpoint') THEN
    PERFORM vault.create_secret('https://project--41b1075b-2b17-4a5b-8120-aca5edc05f47-dev.lovable.app/api/public/notify-concierge', 'notify_concierge_endpoint', 'Adresse du webhook notify-concierge : à remplacer par l''adresse de production à la publication');
  END IF;
END $$;

-- Lecture du secret par le serveur de l'application (clé de service seulement).
CREATE OR REPLACE FUNCTION public.notify_webhook_secret()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notify_concierge_webhook_secret' LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.notify_webhook_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_webhook_secret() TO service_role;

-- Le trigger n'envoie plus que l'identifiant : le serveur relit la demande en base.
CREATE OR REPLACE FUNCTION public.notify_concierge_on_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  endpoint text;
  webhook_secret text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO webhook_secret FROM vault.decrypted_secrets WHERE name = 'notify_concierge_webhook_secret' LIMIT 1;
    SELECT decrypted_secret INTO endpoint FROM vault.decrypted_secrets WHERE name = 'notify_concierge_endpoint' LIMIT 1;
    IF webhook_secret IS NULL OR endpoint IS NULL THEN
      RAISE WARNING 'notify_concierge_on_request: secret ou adresse absents du coffre';
      RETURN NEW;
    END IF;
    PERFORM net.http_post(
      url := endpoint,
      headers := jsonb_build_object('content-type', 'application/json', 'authorization', 'Bearer ' || webhook_secret),
      body := jsonb_build_object('record', jsonb_build_object('id', NEW.id)),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    -- Une notification en échec ne doit jamais empêcher la création de la demande.
    RAISE WARNING 'notify_concierge_on_request failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

-- 3. Verrou d'équipe : tentatives comptées par compte.
CREATE TABLE IF NOT EXISTS public.admin_gate_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  succeeded boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_gate_attempts_user_idx ON public.admin_gate_attempts (user_id, created_at DESC);
REVOKE ALL ON public.admin_gate_attempts FROM anon, authenticated;
GRANT ALL ON public.admin_gate_attempts TO service_role;
ALTER TABLE public.admin_gate_attempts ENABLE ROW LEVEL SECURITY;

-- 4. Plus de lecture ni de modification directe par les administrateurs : tout passe par les fonctions
--    serveur, derrière le verrou d'équipe. Chaque compte garde la lecture de ses propres lignes.
DROP POLICY IF EXISTS "Admins lisent toutes les factures" ON public.invoices;
DROP POLICY IF EXISTS "Admins lisent tous les profils" ON public.profiles;
DROP POLICY IF EXISTS "Admins modifient tous les profils" ON public.profiles;
DROP POLICY IF EXISTS "Admins lisent toutes les demandes" ON public.requests;
DROP POLICY IF EXISTS "Admins lisent tous les roles" ON public.user_roles;

-- Droits de table réduits au nécessaire (la RLS restait la seule barrière).
REVOKE ALL ON public.invoices, public.offers, public.profiles, public.referrals, public.requests, public.user_roles FROM anon;
GRANT SELECT ON public.offers TO anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.invoices, public.offers, public.user_roles FROM authenticated;
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.profiles FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.referrals FROM authenticated;

-- 5. Demande créée par un membre : champs système imposés.
CREATE OR REPLACE FUNCTION public.enforce_member_request_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.status := 'Nouvelle';
    NEW.concierge := 'À attribuer';
    NEW.concierge_id := NULL;
    NEW.team_reply := NULL;
    NEW.team_reply_at := NULL;
    NEW.amount_cents := NULL;
    NEW.recurring_id := NULL;
    NEW.delegate_record := NULL;
    NEW.created_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

-- 6. Récurrences : rien n'est créé pour un membre désactivé.
CREATE OR REPLACE FUNCTION public.generate_recurring_requests(_today date DEFAULT ((now() AT TIME ZONE 'Europe/Paris'::text))::date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r public.recurring_requests%ROWTYPE;
  occ date;
  created integer := 0;
  horizon date := _today + 7;
  new_id uuid;
BEGIN
  FOR r IN
    SELECT rr.* FROM public.recurring_requests rr
    JOIN public.profiles p ON p.id = rr.user_id AND p.disabled_at IS NULL
    WHERE NOT rr.paused
    FOR UPDATE OF rr SKIP LOCKED
  LOOP
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
      INSERT INTO public.requests (user_id, category, title, description, scheduled_date, scheduled_time, guests, image_key, recurring_id)
      VALUES (r.user_id, r.category, r.title, r.description, occ, r.scheduled_time, r.guests, r.image_key, r.id)
      RETURNING id INTO new_id;
      INSERT INTO public.request_events (request_id, actor_id, kind, detail) VALUES (new_id, NULL, 'créée par récurrence', NULL);
      UPDATE public.recurring_requests SET last_occurrence = occ WHERE id = r.id;
      created := created + 1;
    END LOOP;
  END LOOP;
  RETURN created;
END;
$function$;

-- 7. Comptes par membre pour l'interface équipe, sans charger toutes les lignes.
CREATE OR REPLACE FUNCTION public.team_member_counts()
RETURNS TABLE (user_id uuid, requests_count integer, invoices_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id,
    (SELECT count(*)::int FROM public.requests r WHERE r.user_id = p.id),
    (SELECT count(*)::int FROM public.invoices i WHERE i.user_id = p.id)
  FROM public.profiles p
$$;
REVOKE ALL ON FUNCTION public.team_member_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_member_counts() TO service_role;
