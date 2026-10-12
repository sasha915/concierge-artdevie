ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS team_reply text, ADD COLUMN IF NOT EXISTS team_reply_at timestamptz;

DROP POLICY IF EXISTS "Membres modifient leurs demandes" ON public.requests;
DROP POLICY IF EXISTS "Membres suppriment leurs demandes" ON public.requests;
REVOKE UPDATE, DELETE ON public.requests FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.enforce_member_request_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.status := 'Nouvelle';
    NEW.concierge := 'À attribuer';
    NEW.team_reply := NULL;
    NEW.team_reply_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_member_request_defaults ON public.requests;
CREATE TRIGGER enforce_member_request_defaults
BEFORE INSERT ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_member_request_defaults();