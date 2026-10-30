import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

/** Le compte connecté a une fiche et n'est pas désactivé. */
async function ownProfile(context: Ctx): Promise<boolean> {
  const { data } = await context.supabase.from("profiles").select("id, disabled_at").eq("id", context.userId).maybeSingle();
  return !!data && !data.disabled_at;
}

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Photo du compte connecté (membre ou équipe). */
export const getMyAvatar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url: string | null }> => {
    const ctx = context as Ctx;
    if (!(await ownProfile(ctx))) return { url: null };
    const { avatarUrls } = await import("./avatar.server");
    const urls = await avatarUrls(await adminClient(), [ctx.userId]);
    return { url: urls[ctx.userId] ?? null };
  });

export const uploadMyAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: FormData) => {
    if (!(input instanceof FormData)) throw new Error("Format invalide.");
    const file = input.get("file");
    if (!(file instanceof File)) throw new Error("Aucun fichier.");
    return { file };
  })
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    if (!(await ownProfile(ctx))) return { ok: false as const, reason: "Ce compte ne peut pas recevoir de photo." };
    const { storeAvatar } = await import("./avatar.server");
    return storeAvatar(await adminClient(), ctx.userId, data.file);
  });

export const removeMyAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    if (!(await ownProfile(ctx))) return { ok: false as const, reason: "Ce compte ne peut pas recevoir de photo." };
    const { clearAvatar } = await import("./avatar.server");
    return clearAvatar(await adminClient(), ctx.userId);
  });
