-- Points ouverts du 21 octobre.
-- 1. Tarifs des formules : lus en base (plus écrits dans le code de la page Factures).
CREATE TABLE IF NOT EXISTS public.membership_plans (
  name text PRIMARY KEY,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  period text NOT NULL CHECK (period IN ('an', 'mois')),
  min_commitment_months integer CHECK (min_commitment_months IS NULL OR min_commitment_months > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.membership_plans TO service_role;
REVOKE ALL ON public.membership_plans FROM anon, authenticated;
GRANT SELECT ON public.membership_plans TO authenticated;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Membres lisent les formules" ON public.membership_plans;
CREATE POLICY "Membres lisent les formules" ON public.membership_plans FOR SELECT TO authenticated USING (true);
INSERT INTO public.membership_plans (name, price_cents, period, min_commitment_months) VALUES
  ('Essentiel', 89000, 'an', NULL),
  ('Signature', 149000, 'mois', 12)
ON CONFLICT (name) DO NOTHING;

-- 2. Factures de démonstration (comptes de test, numéros en double) : supprimées ; la numérotation devient strictement unique.
DELETE FROM public.invoices
WHERE number IN ('ADV-2026-0812', 'ADV-2026-0831', 'ADV-2026-0912') AND mollie_payment_id IS NULL AND request_id IS NULL;
DROP INDEX IF EXISTS public.invoices_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_number_key ON public.invoices (number);

-- 3. Offres fictives : retirées de l'espace membre (dépubliées, non supprimées ; republiables depuis l'interface équipe).
UPDATE public.offers SET published = false
WHERE partner IN ('Maison Bellefeuille', 'Atelier Serein', 'Casa del Mare', 'Cercle des Arts');
