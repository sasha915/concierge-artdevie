import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const schema = z.object({
  fullName: z.string().trim().min(2, "Nom trop court").max(80),
  email: z.string().trim().email("Adresse email invalide").max(160),
  message: z.string().trim().max(500).optional(),
});

export const sendReferralInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .maybeSingle();

    const email = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const origin = getRequest().headers.get("origin") ?? "";
    const redirectTo = origin ? `${origin}/reset-password` : undefined;

    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      ...(redirectTo ? { redirectTo } : {}),
      data: {
        full_name: data.fullName,
        invited_by: profile?.full_name ?? null,
      },
    });

    if (error) {
      const already = /already|exist|registered/i.test(error.message);
      return {
        ok: false as const,
        reason: already
          ? "Cette adresse correspond déjà à un membre Art de Vie."
          : "L’invitation n’a pas pu être envoyée. Vérifiez l’adresse et réessayez.",
      };
    }

    await supabaseAdmin.from("referrals").insert({
      inviter_id: userId,
      full_name: data.fullName,
      email,
      message: data.message ?? null,
    });

    return { ok: true as const };
  });
