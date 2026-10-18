ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS converted_member_id uuid;

ALTER TABLE public.referrals ADD CONSTRAINT referrals_status_check CHECK (status IN ('Invitation envoyée', 'Contacté', 'Converti'));

CREATE OR REPLACE FUNCTION public.enforce_member_referral_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.status := 'Invitation envoyée';
    NEW.converted_member_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_member_referral_defaults ON public.referrals;
CREATE TRIGGER enforce_member_referral_defaults
BEFORE INSERT ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.enforce_member_referral_defaults();