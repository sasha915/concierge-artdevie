-- Point ouvert du 21 octobre : le secret du webhook WhatsApp n'est plus écrit en clair dans la fonction.
-- 1. Si le coffre ne le contient pas encore, il y est versé depuis la définition actuelle (la valeur ne figure pas dans ce fichier).
DO $$
DECLARE
  def text := pg_get_functiondef('public.notify_concierge_on_request'::regproc);
  found text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'notify_concierge_webhook_secret') THEN
    found := substring(def from 'webhook_secret text := ''([^'']+)''');
    IF found IS NULL THEN
      RAISE EXCEPTION 'Secret du webhook introuvable : migration interrompue, rien n''est modifié.';
    END IF;
    PERFORM vault.create_secret(found, 'notify_concierge_webhook_secret', 'Secret du webhook notify-concierge (WhatsApp)');
  END IF;
END $$;

-- 2. La fonction lit le secret dans le coffre au moment de l'appel ; même comportement.
CREATE OR REPLACE FUNCTION public.notify_concierge_on_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  endpoint text := 'https://project--41b1075b-2b17-4a5b-8120-aca5edc05f47-dev.lovable.app/api/public/notify-concierge';
  webhook_secret text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO webhook_secret FROM vault.decrypted_secrets WHERE name = 'notify_concierge_webhook_secret' LIMIT 1;
    IF webhook_secret IS NULL THEN
      RAISE WARNING 'notify_concierge_on_request: secret absent du coffre';
      RETURN NEW;
    END IF;
    PERFORM net.http_post(
      url := endpoint,
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'authorization', 'Bearer ' || webhook_secret
      ),
      body := jsonb_build_object('record', to_jsonb(NEW)),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    -- Une notification en échec ne doit jamais empêcher la création de la demande.
    RAISE WARNING 'notify_concierge_on_request failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;
