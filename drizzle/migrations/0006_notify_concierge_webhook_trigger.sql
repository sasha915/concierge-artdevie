CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_concierge_on_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  endpoint text := 'https://project--41b1075b-2b17-4a5b-8120-aca5edc05f47-dev.lovable.app/api/public/notify-concierge';
  webhook_secret text := 'f051c90e398242b0ff3be544710b9b35e1cf17d91d101bae';
BEGIN
  BEGIN
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
$$;

DROP TRIGGER IF EXISTS on_request_created_notify_concierge ON public.requests;
CREATE TRIGGER on_request_created_notify_concierge
AFTER INSERT ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.notify_concierge_on_request();