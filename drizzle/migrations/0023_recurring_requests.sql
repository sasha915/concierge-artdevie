-- Lot 6.2 : demandes récurrentes.
-- Une tâche quotidienne (pg_cron) crée chaque demande sept jours avant son échéance, au statut Nouvelle.
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS public.recurring_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  description text NOT NULL DEFAULT '',
  guests integer CHECK (guests IS NULL OR guests > 0),
  scheduled_time time,
  rhythm text NOT NULL CHECK (rhythm IN ('hebdomadaire', 'mensuelle', 'dates')),
  start_date date,
  dates date[] NOT NULL DEFAULT '{}',
  end_date date,
  paused boolean NOT NULL DEFAULT false,
  last_occurrence date,
  image_key text NOT NULL DEFAULT 'entree-de-nuit',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (rhythm = 'dates' OR start_date IS NOT NULL),
  CHECK (rhythm <> 'dates' OR cardinality(dates) > 0)
);
CREATE INDEX IF NOT EXISTS recurring_requests_user_idx ON public.recurring_requests (user_id);

GRANT ALL ON public.recurring_requests TO service_role;
REVOKE ALL ON public.recurring_requests FROM anon, authenticated;
GRANT SELECT ON public.recurring_requests TO authenticated;
ALTER TABLE public.recurring_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membres voient leurs demandes récurrentes" ON public.recurring_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS recurring_id uuid REFERENCES public.recurring_requests(id) ON DELETE SET NULL;

-- Crée les demandes dont l'échéance tombe dans les sept prochains jours et n'a pas encore été créée.
-- Mensuel : même jour chaque mois, ramené au dernier jour du mois si besoin (31 janvier → 28 ou 29 février).
CREATE OR REPLACE FUNCTION public.generate_recurring_requests(_today date DEFAULT (now() AT TIME ZONE 'Europe/Paris')::date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.recurring_requests%ROWTYPE;
  occ date;
  created integer := 0;
  horizon date := _today + 7;
  new_id uuid;
BEGIN
  FOR r IN SELECT * FROM public.recurring_requests WHERE NOT paused FOR UPDATE SKIP LOCKED LOOP
    FOR occ IN
      SELECT d FROM (
        SELECT gs::date AS d FROM generate_series(r.start_date, horizon, interval '7 days') gs WHERE r.rhythm = 'hebdomadaire'
        UNION ALL
        SELECT (r.start_date + make_interval(months => k))::date FROM generate_series(0, 600) k
          WHERE r.rhythm = 'mensuelle' AND (r.start_date + make_interval(months => k))::date <= horizon
        UNION ALL
        SELECT unnest(r.dates) WHERE r.rhythm = 'dates'
      ) s
      WHERE d >= _today AND d <= horizon
        AND d > COALESCE(r.last_occurrence, _today - 1)
        AND (r.end_date IS NULL OR d <= r.end_date)
      ORDER BY d
    LOOP
      INSERT INTO public.requests (user_id, category, title, description, scheduled_date, scheduled_time, guests, image_key, recurring_id)
      VALUES (r.user_id, r.category, r.title, r.description, occ, r.scheduled_time, r.guests, r.image_key, r.id)
      RETURNING id INTO new_id;
      INSERT INTO public.request_events (request_id, actor_id, kind, detail) VALUES (new_id, NULL, 'créée par récurrence', NULL);
      UPDATE public.recurring_requests SET last_occurrence = occ WHERE id = r.id;
      created := created + 1;
    END LOOP;
  END LOOP;
  RETURN created;
END;
$$;
REVOKE ALL ON FUNCTION public.generate_recurring_requests(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_recurring_requests(date) TO service_role;

-- Chaque jour à 6 h (UTC), soit 7 h ou 8 h à Paris.
SELECT cron.schedule('art-de-vie-demandes-recurrentes', '0 6 * * *', $$SELECT public.generate_recurring_requests()$$);
