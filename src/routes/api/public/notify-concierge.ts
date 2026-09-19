import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

const payloadSchema = z.object({
  record: z.object({
    id: z.string(),
    user_id: z.string(),
    title: z.string().default(''),
    category: z.string().default(''),
    description: z.string().nullable().optional(),
    scheduled_date: z.string().nullable().optional(),
    scheduled_time: z.string().nullable().optional(),
    guests: z.number().nullable().optional(),
  }),
});

function ok(body: Record<string, unknown>) {
  // Always 200: a failed notification must never block request creation.
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'date à définir';
  return new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export const Route = createFileRoute('/api/public/notify-concierge')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await authenticateCronRequest(request);
        if (unauthorized) return unauthorized;

        const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          console.error('[notify-concierge] payload invalide', parsed.error.issues);
          return ok({ skipped: 'invalid_payload' });
        }
        const req = parsed.data.record;

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { data: profile, error } = await supabaseAdmin
          .from('profiles')
          .select('full_name, plan, concierge_referent, concierge_whatsapp')
          .eq('id', req.user_id)
          .maybeSingle();

        if (error || !profile) {
          console.error('[notify-concierge] profil introuvable pour', req.user_id, error?.message);
          return ok({ skipped: 'profile_not_found' });
        }

        const essentielNumber = process.env['ESSENTIEL_CONCIERGE_WHATSAPP'];
        const token = process.env['WHATSAPP_API_TOKEN'];
        const phoneNumberId = process.env['WHATSAPP_PHONE_NUMBER_ID'];

        const isSignature = profile.plan === 'Signature';
        const recipientRaw = isSignature ? profile.concierge_whatsapp : essentielNumber;

        if (!recipientRaw) {
          console.warn(
            `notification WhatsApp non envoyée : secret ${
              isSignature ? 'profiles.concierge_whatsapp' : 'ESSENTIEL_CONCIERGE_WHATSAPP'
            } manquant`,
          );
          return ok({ skipped: 'missing_recipient' });
        }
        if (!token) {
          console.warn('notification WhatsApp non envoyée : secret WHATSAPP_API_TOKEN manquant');
          return ok({ skipped: 'missing_WHATSAPP_API_TOKEN' });
        }
        if (!phoneNumberId) {
          console.warn(
            'notification WhatsApp non envoyée : secret WHATSAPP_PHONE_NUMBER_ID manquant',
          );
          return ok({ skipped: 'missing_WHATSAPP_PHONE_NUMBER_ID' });
        }

        const recipient = recipientRaw.replace(/[^0-9]/g, '');
        const firstName = (profile.full_name || 'Un membre').trim().split(/\s+/)[0];
        const lines = [
          `Nouvelle demande Art de Vie — ${firstName}`,
          `Prestation : ${req.title}`,
          `Catégorie : ${req.category}`,
          `Date souhaitée : ${formatDate(req.scheduled_date)}${req.scheduled_time ? ` à ${req.scheduled_time}` : ''}`,
          ...(req.guests ? [`Couverts : ${req.guests}`] : []),
          ...(req.description?.trim() ? [`Précisions : ${req.description.trim()}`] : []),
        ];

        try {
          const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: recipient,
              type: 'text',
              text: { preview_url: false, body: lines.join('\n') },
            }),
          });
          if (!res.ok) {
            console.error(
              '[notify-concierge] echec API WhatsApp',
              res.status,
              await res.text().catch(() => ''),
            );
            return ok({ skipped: 'whatsapp_api_error', status: res.status });
          }
        } catch (err) {
          console.error('[notify-concierge] appel WhatsApp impossible', err);
          return ok({ skipped: 'whatsapp_fetch_failed' });
        }

        return ok({ sent: true, request_id: req.id });
      },
    },
  },
});
