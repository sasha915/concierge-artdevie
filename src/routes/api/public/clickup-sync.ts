import { createFileRoute } from '@tanstack/react-router';
import { createHash, timingSafeEqual } from 'node:crypto';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

function json(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

function sameSecret(a: string, b: string): boolean {
  const x = createHash('sha256').update(a, 'utf8').digest();
  const y = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(x, y);
}

/**
 * Liaison ClickUp (30 octobre) : appelée chaque minute par la tâche planifiée art-de-vie-clickup
 * (même secret du coffre que les alertes WhatsApp) quand des changements attendent ; écrit dans ClickUp.
 */
export const Route = createFileRoute('/api/public/clickup-sync')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const bearer = /^Bearer ([^\s,]+)$/.exec(request.headers.get('authorization') ?? '')?.[1] ?? '';
        const { data: secret } = await supabaseAdmin.rpc('notify_webhook_secret');
        if (!secret || !bearer || !sameSecret(bearer, secret as string)) {
          const unauthorized = await authenticateCronRequest(request);
          if (unauthorized) return unauthorized;
        }
        const { processClickupOutbox } = await import('@/lib/clickup.server');
        return json(await processClickupOutbox(supabaseAdmin, 45000));
      },
    },
  },
});
