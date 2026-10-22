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

export const Route = createFileRoute('/api/public/notify-concierge')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Appelé par le trigger Postgres avec NOTIFY_CONCIERGE_WEBHOOK_SECRET,
        // ou manuellement avec le secret cron de la plateforme.
        const webhookSecret = process.env['NOTIFY_CONCIERGE_WEBHOOK_SECRET'];
        const bearer = /^Bearer ([^\s,]+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
        if (!webhookSecret || bearer !== webhookSecret) {
          const unauthorized = await authenticateCronRequest(request);
          if (unauthorized) return unauthorized;
        }

        const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          console.error('[notify-concierge] payload invalide', parsed.error.issues);
          return ok({ skipped: 'invalid_payload' });
        }
        const req = parsed.data.record;
        const { notifyConcierge } = await import('@/lib/notify-concierge.server');
        const result = await notifyConcierge(req);
        if (!('sent' in result)) return ok(result);
        return ok({ sent: true, request_id: req.id });
      },
    },
  },
});
