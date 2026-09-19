CREATE OR REPLACE FUNCTION public.handle_new_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, plan, role_label, member_number, member_since, valid_until, concierge_referent, concierge_whatsapp)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    'Signature',
    'Membre Signature',
    'N° ADV · ' || to_char(now(), 'MMYY') || ' · ' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 4)),
    CURRENT_DATE,
    (CURRENT_DATE + interval '2 years')::date,
    'Clara M.',
    '+33612345678'
  );
  RETURN NEW;
END;
$$;