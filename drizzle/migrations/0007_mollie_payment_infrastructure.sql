ALTER TABLE public.profiles
  ADD COLUMN mollie_customer_id text,
  ADD COLUMN mollie_subscription_id text;

ALTER TABLE public.invoices
  ADD COLUMN mollie_payment_id text;