ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS concierge_whatsapp TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, member_number, concierge_referent, concierge_whatsapp)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',
    'N° ADV · ' || to_char(now(), 'MMYY') || ' · ' || lpad((floor(random() * 9999))::int::text, 4, '0'),
    'Clara M.',
    '+33612345678'
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
$function$;