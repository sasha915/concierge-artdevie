import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { createHash, timingSafeEqual } from 'node:crypto';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

// Le trigger n'envoie que l'identifiant de la demande : son contenu est toujours relu en base.
const payloadSchema = z.object({ record: z.object({ id: z.string().uuid() }) });

function ok(body: Record<string, unknown>) {
  // Always 200: a failed notification must never block request creation.
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function sameSecret(a: string, b: string): boolean {
  const x = createHash('sha256').update(a, 'utf8').digest();
  const y = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(x, y);
}

export const Route = createFileRoute('/api/public/notify-concierge')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Appelé par le trigger Postgres avec le secret du coffre Supabase,
        // ou manuellement avec le secret cron de la plateforme.
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const bearer = /^Bearer ([^\s,]+)$/.exec(request.headers.get('authorization') ?? '')?.[1] ?? '';
        const { data: secret } = await supabaseAdmin.rpc('notify_webhook_secret');
        if (!secret || !bearer || !sameSecret(bearer, secret as string)) {
          const unauthorized = await authenticateCronRequest(request);
          if (unauthorized) return unauthorized;
        }

        const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return ok({ skipped: 'invalid_payload' });

        const { data: req } = await supabaseAdmin
          .from('requests')
          .select('id, user_id, title, category, description, scheduled_date, scheduled_time, guests')
          .eq('id', parsed.data.record.id)
          .maybeSingle();
        if (!req) return ok({ skipped: 'request_not_found' });

        const { notifyConcierge } = await import('@/lib/notify-concierge.server');
        const result = await notifyConcierge(req);
        if (!('sent' in result)) return ok(result);
        return ok({ sent: true, request_id: req.id });
      },
    },
  },
});
