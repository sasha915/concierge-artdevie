// Envoi WhatsApp à la conciergerie (API WhatsApp Cloud). À n'importer que côté serveur.
// Une notification en échec ne bloque jamais l'action qui l'a déclenchée : on renvoie un état, jamais d'exception.

export type ConciergeRequest = {
  id: string;
  user_id: string;
  title: string;
  category: string;
  description?: string | null | undefined;
  scheduled_date?: string | null | undefined;
  scheduled_time?: string | null | undefined;
  guests?: number | null | undefined;
};

export type NotifyResult = { sent: true } | { skipped: string; status?: number };

function formatDate(value: string | null | undefined): string {
  if (!value) return "date à définir";
  return new Date(`${value}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Prévient le concierge d'une demande : nouvelle demande (par défaut) ou nouveau message du membre (`message`).
 * Destinataire : le concierge référent (formule Signature) ou le numéro commun Essentiel.
 */
export async function notifyConcierge(req: ConciergeRequest, message?: string): Promise<NotifyResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("full_name, plan, concierge_referent, concierge_whatsapp")
    .eq("id", req.user_id)
    .maybeSingle();
  if (error || !profile) {
    console.error("[notify-concierge] profil introuvable pour", req.user_id, error?.message);
    return { skipped: "profile_not_found" };
  }

  const essentielNumber = process.env["ESSENTIEL_CONCIERGE_WHATSAPP"];
  const token = process.env["WHATSAPP_API_TOKEN"];
  const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  const isSignature = profile.plan === "Signature";
  const recipientRaw = isSignature ? profile.concierge_whatsapp : essentielNumber;

  if (!recipientRaw) {
    console.warn(`notification WhatsApp non envoyée : ${isSignature ? "profiles.concierge_whatsapp" : "secret ESSENTIEL_CONCIERGE_WHATSAPP"} manquant`);
    return { skipped: "missing_recipient" };
  }
  if (!token) {
    console.warn("notification WhatsApp non envoyée : secret WHATSAPP_API_TOKEN manquant");
    return { skipped: "missing_WHATSAPP_API_TOKEN" };
  }
  if (!phoneNumberId) {
    console.warn("notification WhatsApp non envoyée : secret WHATSAPP_PHONE_NUMBER_ID manquant");
    return { skipped: "missing_WHATSAPP_PHONE_NUMBER_ID" };
  }

  const recipient = recipientRaw.replace(/[^0-9]/g, "");
  const firstName = (profile.full_name || "Un membre").trim().split(/\s+/)[0];
  const lines = message
    ? [`Nouveau message de ${firstName} — Art de Vie`, `Demande : ${req.title}`, `Message : ${message.trim()}`]
    : [
        `Nouvelle demande Art de Vie — ${firstName}`,
        `Prestation : ${req.title}`,
        `Catégorie : ${req.category}`,
        `Date souhaitée : ${formatDate(req.scheduled_date)}${req.scheduled_time ? ` à ${req.scheduled_time}` : ""}`,
        ...(req.guests ? [`Couverts : ${req.guests}`] : []),
        ...(req.description?.trim() ? [`Précisions : ${req.description.trim()}`] : []),
      ];

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: recipient, type: "text", text: { preview_url: false, body: lines.join("\n") } }),
    });
    if (!res.ok) {
      console.error("[notify-concierge] echec API WhatsApp", res.status, await res.text().catch(() => ""));
      return { skipped: "whatsapp_api_error", status: res.status };
    }
  } catch (err) {
    console.error("[notify-concierge] appel WhatsApp impossible", err);
    return { skipped: "whatsapp_fetch_failed" };
  }
  return { sent: true };
}
