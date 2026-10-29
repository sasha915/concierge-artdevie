import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Hotline WhatsApp de la conciergerie (décision de Sasha, 29 octobre) : pour les membres hors Signature,
 * le numéro commun qui reçoit déjà leurs demandes (ESSENTIEL_CONCIERGE_WHATSAPP).
 */
export const getHotline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ digits: string | null }> => {
    const raw = process.env["ESSENTIEL_CONCIERGE_WHATSAPP"] || "";
    const digits = raw.replace(/[^0-9]/g, "");
    return { digits: digits.length >= 8 ? digits : null };
  });
