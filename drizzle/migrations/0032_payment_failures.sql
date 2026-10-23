-- Seconde analyse du 23 octobre : prélèvements d'abonnement rejetés, gardés pour l'équipe.
CREATE TABLE IF NOT EXISTS public.payment_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  mollie_payment_id text NOT NULL UNIQUE,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS payment_failures_open_idx ON public.payment_failures (created_at DESC) WHERE resolved_at IS NULL;
REVOKE ALL ON public.payment_failures FROM anon, authenticated;
GRANT ALL ON public.payment_failures TO service_role;
ALTER TABLE public.payment_failures ENABLE ROW LEVEL SECURITY;
