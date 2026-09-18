CREATE TYPE public.request_status AS ENUM ('Nouvelle','En cours','Confirmée','Terminée','Annulée');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  plan text NOT NULL DEFAULT 'Signature',
  role_label text NOT NULL DEFAULT 'Membre Signature',
  member_number text NOT NULL DEFAULT '',
  member_since date NOT NULL DEFAULT current_date,
  valid_until date NOT NULL DEFAULT ((current_date + interval '2 years')::date),
  notify_requests boolean NOT NULL DEFAULT true,
  notify_offers boolean NOT NULL DEFAULT false,
  notify_messages boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membres lisent leur profil" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Membres modifient leur profil" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Membres creent leur profil" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  promo text NOT NULL,
  title text NOT NULL,
  partner text NOT NULL,
  place text NOT NULL,
  validity text NOT NULL,
  image_key text NOT NULL DEFAULT 'restaurant',
  featured boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.offers TO anon;
GRANT SELECT ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Offres visibles publiquement" ON public.offers FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'Tables',
  status public.request_status NOT NULL DEFAULT 'Nouvelle',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  scheduled_date date,
  scheduled_time text,
  guests integer,
  concierge text NOT NULL DEFAULT 'À attribuer',
  image_key text NOT NULL DEFAULT 'restaurant',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX requests_user_idx ON public.requests (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membres lisent leurs demandes" ON public.requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Membres creent leurs demandes" ON public.requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Membres modifient leurs demandes" ON public.requests FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Membres suppriment leurs demandes" ON public.requests FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  number text NOT NULL,
  kind text NOT NULL DEFAULT 'Abonnement',
  issued_on date NOT NULL DEFAULT current_date,
  amount_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Payée',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoices_user_idx ON public.invoices (user_id, issued_on DESC);
GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membres lisent leurs factures" ON public.invoices FOR SELECT TO authenticated USING (auth.uid() = user_id);

INSERT INTO public.offers (category, promo, title, partner, place, validity, image_key, sort_order) VALUES
  ('Restaurant','Table signature','Un dîner au-dessus de Paris','Maison Bellefeuille','Paris, 16e','Valable jusqu''au 30 novembre','restaurant',1),
  ('Bien-être','-25%','Le rituel minéral','Atelier Serein','Paris, 8e','Valable jusqu''au 15 décembre','spa',2),
  ('Voyage','Upgrade offert','Une parenthèse sur la Riviera','Casa del Mare','Cap d''Antibes','Valable jusqu''au 31 octobre','hotel',3),
  ('Culture','Visite privée','Les collections après la fermeture','Cercle des Arts','Paris, 1er','Sur réservation','restaurant',4);

CREATE OR REPLACE FUNCTION public.handle_new_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, member_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',
    'N° ADV · ' || to_char(now(), 'MMYY') || ' · ' || lpad((floor(random() * 9999))::int::text, 4, '0')
  );

  INSERT INTO public.requests (user_id, category, status, title, description, scheduled_date, scheduled_time, concierge, image_key) VALUES
    (NEW.id,'Tables','Confirmée','Dîner à Girafe','Une table avec vue pour célébrer votre anniversaire, dans un espace calme et privilégié.', current_date + 7, '20h30','Clara M.','restaurant'),
    (NEW.id,'Séjours','En cours','Escapade en Provence','Une maison confidentielle entre vignes, avec chef privé et transfert depuis Paris.', current_date + 21, 'Départ à 9h00','Antoine L.','hotel'),
    (NEW.id,'Soins','Nouvelle','Rituel bien-être à domicile','Un soin relaxant de 90 minutes et une sélection d''huiles sur mesure.', current_date + 13, '18h00','À attribuer','spa'),
    (NEW.id,'Culture','Terminée','Soirée à l''Opéra Garnier','Deux places en loge et dîner après la représentation.', current_date - 8, '19h30','Clara M.','restaurant'),
    (NEW.id,'Transferts','Annulée','Transfert vers la Riviera','Transfert privé depuis l''aéroport de Nice jusqu''à Saint-Jean-Cap-Ferrat.', current_date - 18, '14h15','Antoine L.','hotel');

  INSERT INTO public.invoices (user_id, number, kind, issued_on, amount_cents, status) VALUES
    (NEW.id,'ADV-' || to_char(current_date, 'YYYY') || '-0912','Abonnement', current_date - 6, 149000,'Payée'),
    (NEW.id,'ADV-' || to_char(current_date, 'YYYY') || '-0831','Prestations', current_date - 18, 68000,'Payée'),
    (NEW.id,'ADV-' || to_char(current_date, 'YYYY') || '-0812','Abonnement', current_date - 37, 149000,'Payée');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_member();