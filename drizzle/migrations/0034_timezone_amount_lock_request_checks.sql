-- 29 octobre (suite) : fuseau horaire du membre, montant verrouillé à la facturation, contrôles serveur des demandes.
-- Écrite pour pouvoir être rejouée sans effet de bord.

-- 1) Fuseau horaire du membre (horodatages et date du jour dans sa ville ; Paris par défaut).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Paris';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_timezone_format') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_timezone_format CHECK (timezone ~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+){1,2}$' AND length(timezone) <= 64);
  END IF;
END $$;
GRANT UPDATE (timezone) ON public.profiles TO authenticated;

-- 2) Contrôles serveur d'une demande créée par un membre : couverts, date et heure déjà passées dans son fuseau.
CREATE OR REPLACE FUNCTION public.check_member_request_values()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  tz text;
  local_now timestamp;
  parts text[];
  at_minutes integer;
BEGIN
  IF NEW.guests IS NOT NULL AND (NEW.guests < 1 OR NEW.guests > 500) THEN
    RAISE EXCEPTION 'couverts_invalides' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.scheduled_date IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT p.timezone INTO tz FROM public.profiles p WHERE p.id = NEW.user_id;
  IF tz IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = tz) THEN
    tz := 'Europe/Paris';
  END IF;
  local_now := now() AT TIME ZONE tz;
  IF NEW.scheduled_date < local_now::date THEN
    RAISE EXCEPTION 'date_passee' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.scheduled_date = local_now::date AND NEW.scheduled_time IS NOT NULL THEN
    parts := regexp_match(NEW.scheduled_time, '(\d{1,2})\s*[hH:]\s*(\d{2})?');
    IF parts IS NOT NULL AND parts[1]::int <= 23 AND COALESCE(parts[2], '0')::int <= 59 THEN
      at_minutes := parts[1]::int * 60 + COALESCE(parts[2], '0')::int;
      IF at_minutes <= extract(hour FROM local_now)::int * 60 + extract(minute FROM local_now)::int THEN
        RAISE EXCEPTION 'heure_passee' USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS check_member_request_values ON public.requests;
CREATE TRIGGER check_member_request_values
  BEFORE INSERT ON public.requests
  FOR EACH ROW WHEN (CURRENT_USER = 'authenticated'::name)
  EXECUTE FUNCTION public.check_member_request_values();

-- 3) Montant verrouillé dès qu'une facture existe, et facture refusée si le montant a bougé pendant sa création.
CREATE OR REPLACE FUNCTION public.lock_invoiced_amount()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
     AND EXISTS (SELECT 1 FROM public.invoices WHERE request_id = NEW.id) THEN
    RAISE EXCEPTION 'montant_facture_verrouille' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS lock_invoiced_amount ON public.requests;
CREATE TRIGGER lock_invoiced_amount
  BEFORE UPDATE OF amount_cents ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.lock_invoiced_amount();

CREATE OR REPLACE FUNCTION public.check_invoice_amount()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  current_amount integer;
BEGIN
  IF NEW.request_id IS NULL OR NEW.service_cents IS NULL THEN
    RETURN NEW;
  END IF;
  -- Verrou de la demande : une modification concurrente du montant attend, puis est refusée.
  SELECT amount_cents INTO current_amount FROM public.requests WHERE id = NEW.request_id FOR UPDATE;
  IF current_amount IS DISTINCT FROM NEW.service_cents THEN
    RAISE EXCEPTION 'montant_modifie_pendant_facturation' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS check_invoice_amount ON public.invoices;
CREATE TRIGGER check_invoice_amount
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.check_invoice_amount();
