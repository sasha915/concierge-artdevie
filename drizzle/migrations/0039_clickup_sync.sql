-- 30 octobre : l'application (source de vérité) alimente ClickUp — Conciergerie > Fiches clients et Demandes Clients.
-- Chaque changement utile est mis en file (clickup_outbox) par des triggers ; une tâche planifiée appelle
-- /api/public/clickup-sync, qui écrit dans ClickUp et réessaie en cas d'échec. Écrite pour pouvoir être rejouée.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clickup_task_id text;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS clickup_task_id text;
-- Dernières valeurs envoyées à ClickUp : seul ce qui a changé dans l'app est réécrit, le reste de ClickUp est préservé.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clickup_state jsonb;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS clickup_state jsonb;

CREATE TABLE IF NOT EXISTS public.clickup_outbox (
  kind text NOT NULL CHECK (kind IN ('membre', 'demande')),
  ref_id uuid NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, ref_id)
);
REVOKE ALL ON public.clickup_outbox FROM anon, authenticated;
GRANT ALL ON public.clickup_outbox TO service_role;
ALTER TABLE public.clickup_outbox ENABLE ROW LEVEL SECURITY;

-- Interrupteur : la liaison ne s'active qu'une fois le secret « clickup_sync_enabled » présent dans le coffre (mis par Claude à l'ouverture).
CREATE OR REPLACE FUNCTION public.clickup_sync_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'clickup_sync_enabled' AND decrypted_secret = 'oui');
$$;
REVOKE ALL ON FUNCTION public.clickup_sync_enabled() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clickup_sync_enabled() TO service_role;

CREATE OR REPLACE FUNCTION public.clickup_enqueue(_kind text, _ref uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.clickup_sync_enabled() THEN
    RETURN;
  END IF;
  INSERT INTO public.clickup_outbox (kind, ref_id) VALUES (_kind, _ref)
  ON CONFLICT (kind, ref_id) DO UPDATE SET version = clickup_outbox.version + 1, attempts = 0, next_attempt_at = now(), last_error = NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.clickup_enqueue(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clickup_enqueue(text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.clickup_enqueue_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Un incident de la file ne doit jamais empêcher l'écriture dans l'application.
  BEGIN
  IF TG_TABLE_NAME = 'profiles' THEN
    PERFORM public.clickup_enqueue('membre', NEW.id);
  ELSIF TG_TABLE_NAME = 'requests' THEN
    PERFORM public.clickup_enqueue('demande', NEW.id);
  ELSIF NEW.request_id IS NOT NULL THEN
    PERFORM public.clickup_enqueue('demande', NEW.request_id);
  END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'clickup_enqueue: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clickup_sync_profile ON public.profiles;
CREATE TRIGGER clickup_sync_profile AFTER INSERT OR UPDATE OF full_name, plan, disabled_at, concierge_referent
  ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.clickup_enqueue_trigger();
DROP TRIGGER IF EXISTS clickup_sync_request ON public.requests;
CREATE TRIGGER clickup_sync_request AFTER INSERT OR UPDATE OF status, title, description, category, scheduled_date, scheduled_time, guests, concierge_id, amount_cents, delegate_record
  ON public.requests FOR EACH ROW EXECUTE FUNCTION public.clickup_enqueue_trigger();
DROP TRIGGER IF EXISTS clickup_sync_invoice ON public.invoices;
CREATE TRIGGER clickup_sync_invoice AFTER INSERT OR UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.clickup_enqueue_trigger();
DROP TRIGGER IF EXISTS clickup_sync_proposal ON public.request_proposals;
CREATE TRIGGER clickup_sync_proposal AFTER INSERT OR UPDATE OF status ON public.request_proposals
  FOR EACH ROW EXECUTE FUNCTION public.clickup_enqueue_trigger();
DROP TRIGGER IF EXISTS clickup_sync_review ON public.request_reviews;
CREATE TRIGGER clickup_sync_review AFTER INSERT OR UPDATE ON public.request_reviews
  FOR EACH ROW EXECUTE FUNCTION public.clickup_enqueue_trigger();

-- Appel de l'application : même adresse et même secret que les alertes WhatsApp (coffre), sur le chemin /api/public/clickup-sync.
CREATE OR REPLACE FUNCTION public.kick_clickup_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  endpoint text;
  webhook_secret text;
BEGIN
  IF NOT public.clickup_sync_enabled() OR NOT EXISTS (SELECT 1 FROM public.clickup_outbox WHERE next_attempt_at <= now()) THEN
    RETURN;
  END IF;
  SELECT decrypted_secret INTO webhook_secret FROM vault.decrypted_secrets WHERE name = 'notify_concierge_webhook_secret' LIMIT 1;
  SELECT decrypted_secret INTO endpoint FROM vault.decrypted_secrets WHERE name = 'notify_concierge_endpoint' LIMIT 1;
  IF webhook_secret IS NULL OR endpoint IS NULL THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := replace(endpoint, '/api/public/notify-concierge', '/api/public/clickup-sync'),
    headers := jsonb_build_object('content-type', 'application/json', 'authorization', 'Bearer ' || webhook_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
END;
$$;
REVOKE ALL ON FUNCTION public.kick_clickup_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kick_clickup_sync() TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'art-de-vie-clickup') THEN
    PERFORM cron.schedule('art-de-vie-clickup', '* * * * *', 'SELECT public.kick_clickup_sync()');
  END IF;
END $$;

-- Échecs ClickUp visibles dans « À surveiller » (kind = 'clickup') ; une fiche membre n'a pas de demande, d'où user_id.
ALTER TABLE public.notification_failures ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;
