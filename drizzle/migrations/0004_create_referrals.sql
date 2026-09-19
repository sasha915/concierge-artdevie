CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'Invitation envoyée',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own referrals" ON public.referrals
  FOR SELECT TO authenticated USING (inviter_id = auth.uid());

CREATE POLICY "Members create own referrals" ON public.referrals
  FOR INSERT TO authenticated WITH CHECK (inviter_id = auth.uid());

CREATE INDEX referrals_inviter_created_idx ON public.referrals (inviter_id, created_at DESC);