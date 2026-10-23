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

/** Paramètre de modèle WhatsApp : ni retour à la ligne, ni tabulation, ni plus de quatre espaces, 1 000 caractères au plus. */
export function templateParam(value: string | null | undefined): string {
  const flat = (value ?? "").replace(/[\r\n\t]+/g, " · ").replace(/ {4,}/g, "   ").trim();
  return (flat || "—").slice(0, 1000);
}

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

  // WhatsApp n'accepte un message libre envoyé par l'entreprise que dans les 24 h suivant un message du destinataire.
  // Hors de cette fenêtre, il faut un modèle validé par Meta : WHATSAPP_TEMPLATE_REQUEST (membre, prestation,
  // catégorie, date) et WHATSAPP_TEMPLATE_MESSAGE (membre, demande, message), langue WHATSAPP_TEMPLATE_LANG (fr par défaut).
  const templateName = message ? process.env["WHATSAPP_TEMPLATE_MESSAGE"] : process.env["WHATSAPP_TEMPLATE_REQUEST"];
  const params = message
    ? [firstName, req.title, message]
    : [firstName, req.title, req.category, `${formatDate(req.scheduled_date)}${req.scheduled_time ? ` à ${req.scheduled_time}` : ""}`];
  const payload = templateName
    ? {
        messaging_product: "whatsapp",
        to: recipient,
        type: "template",
        template: {
          name: templateName,
          language: { code: process.env["WHATSAPP_TEMPLATE_LANG"] || "fr" },
          components: [{ type: "body", parameters: params.map((p) => ({ type: "text", text: templateParam(p) })) }],
        },
      }
    : { messaging_product: "whatsapp", to: recipient, type: "text", text: { preview_url: false, body: lines.join("\n") } };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
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
