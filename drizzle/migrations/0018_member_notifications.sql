-- Lot 4.3 : notifications au membre, dans l'application.
-- Créées par les fonctions serveur de l'équipe (changement de statut, réponse publiée),
-- seulement si le membre a laissé profiles.notify_requests activé.
CREATE TABLE IF NOT EXISTS public.member_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.requests(id) ON DELETE CASCADE,
  kind text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS member_notifications_unread_idx ON public.member_notifications (user_id) WHERE read_at IS NULL;

GRANT ALL ON public.member_notifications TO service_role;
REVOKE ALL ON public.member_notifications FROM anon, authenticated;
GRANT SELECT ON public.member_notifications TO authenticated;
ALTER TABLE public.member_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membres lisent leurs notifications" ON public.member_notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Le membre marque comme lues les notifications d'une de ses demandes ; il ne peut rien modifier d'autre.
CREATE OR REPLACE FUNCTION public.mark_request_notifications_read(_request_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.member_notifications
  SET read_at = now()
  WHERE user_id = auth.uid() AND request_id = _request_id AND read_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.mark_request_notifications_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_request_notifications_read(uuid) TO authenticated, service_role;
