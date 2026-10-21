CREATE TABLE public.request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  actor_id uuid,
  kind text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.request_events TO service_role;
REVOKE ALL ON public.request_events FROM anon, authenticated;
ALTER TABLE public.request_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.reply_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  body text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.reply_templates TO service_role;
REVOKE ALL ON public.reply_templates FROM anon, authenticated;
ALTER TABLE public.reply_templates ENABLE ROW LEVEL SECURITY;

INSERT INTO public.reply_templates (label, body, sort_order) VALUES
  ('Confirmation', '', 1),
  ('Demande de précisions', '', 2),
  ('Proposition alternative', '', 3),
  ('Prestation indisponible', '', 4);

-- Événement « reçue » uniquement pour les créations par un membre (session présente) ;
-- les créations par l'équipe (clé service, sans session) sont journalisées par la fonction serveur.
CREATE OR REPLACE FUNCTION public.log_request_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.request_events (request_id, actor_id, kind, detail)
    VALUES (NEW.id, NEW.user_id, 'reçue', NULL);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_request_created_log_event
AFTER INSERT ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.log_request_received();