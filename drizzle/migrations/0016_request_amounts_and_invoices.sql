-- Lot 4.2 : montant d'une prestation, commission, facture liée à la demande.

-- Montant de la prestation, renseigné par l'équipe (jamais par le membre).
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS amount_cents integer CHECK (amount_cents IS NULL OR amount_cents >= 0);

-- Détail de la facture : prestation + commission = amount_cents (total facturé).
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_cents integer CHECK (service_cents IS NULL OR service_cents >= 0),
  ADD COLUMN IF NOT EXISTS commission_cents integer CHECK (commission_cents IS NULL OR commission_cents >= 0),
  ADD COLUMN IF NOT EXISTS commission_rate numeric(5,4) CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 1));

-- Une seule facture par demande.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_request_id_key ON public.invoices (request_id) WHERE request_id IS NOT NULL;

-- Numérotation continue ADV-AAAA-NNNN, attribuée par la base (plus de calcul par comptage).
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq;
REVOKE ALL ON SEQUENCE public.invoice_number_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.invoice_number_seq TO service_role;

CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'ADV-' || to_char(now() AT TIME ZONE 'Europe/Paris', 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 4, '0');
$$;
REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO service_role;

-- Numéros uniques ; les trois numéros des factures de démonstration, déjà en double, sont exclus.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_number_key ON public.invoices (number)
  WHERE number NOT IN ('ADV-2026-0812', 'ADV-2026-0831', 'ADV-2026-0912');

-- Création par un membre : statut, concierge, réponse, montant et attribution restent ceux de la maison.
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
  END IF;
  RETURN NEW;
END;
$function$;
