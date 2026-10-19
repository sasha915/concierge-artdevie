CREATE OR REPLACE FUNCTION public.is_team(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin'::app_role, 'concierge'::app_role))
$$;
GRANT EXECUTE ON FUNCTION public.is_team(uuid) TO authenticated, service_role;

ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS concierge_id uuid;
CREATE INDEX IF NOT EXISTS requests_concierge_id_idx ON public.requests(concierge_id);

WITH team AS (
  SELECT p.id, lower(btrim(p.full_name)) AS n FROM public.profiles p
  WHERE public.is_team(p.id) AND btrim(p.full_name) <> ''
), uniq AS (SELECT n, min(id::text)::uuid AS id FROM team GROUP BY n HAVING count(*) = 1)
UPDATE public.requests r SET concierge_id = u.id FROM uniq u
WHERE r.concierge_id IS NULL AND lower(btrim(r.concierge)) = u.n;

CREATE OR REPLACE FUNCTION public.protect_last_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE remaining integer;
BEGIN
  IF OLD.role <> 'admin'::app_role THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.role = 'admin'::app_role THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO remaining FROM public.user_roles WHERE role = 'admin'::app_role AND id <> OLD.id;
  IF remaining = 0 THEN
    RAISE EXCEPTION 'Il doit toujours rester au moins un administrateur.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS protect_last_admin ON public.user_roles;
CREATE TRIGGER protect_last_admin BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_last_admin();