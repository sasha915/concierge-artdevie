import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { AppShell, Logo } from "@/components/art-de-vie/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { unlockAdmin } from "@/lib/admin-gate.functions";
import { lovable } from "@/integrations/lovable";
import { TEAM_EMAIL_DOMAIN } from "@/lib/team-auth-rules";

export const Route = createFileRoute("/_authenticated/admin-connexion")({
  head: () => ({
    meta: [
      { title: "Accès équipe — Art de Vie" },
      { name: "description", content: "Espace réservé à l’équipe Art de Vie." },
      { property: "og:title", content: "Accès équipe — Art de Vie" },
      { property: "og:description", content: "Espace réservé à l’équipe Art de Vie." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

const MESSAGES: Record<string, string> = {
  connexion_google_requise: "L’espace équipe s’ouvre avec votre compte Google professionnel.",
  connexion_ancienne: "Votre session équipe s’est refermée. Reconnectez-vous avec Google.",
  adresse_non_professionnelle: "Utilisez votre adresse @artdevie.co : les autres comptes Google n’ouvrent pas l’espace équipe.",
  hors_equipe: "Ce compte ne fait pas partie de l’équipe Art de Vie.",
  locked: "Trop d’essais. Réessayez dans un quart d’heure.",
};

function Page() {
  const navigate = useNavigate();
  const unlock = useServerFn(unlockAdmin);
  const [busy, setBusy] = useState(true);
  const [reason, setReason] = useState<string | null>(null);

  // Au retour de Google (ou si la connexion Google est récente), l'espace équipe s'ouvre sans autre saisie.
  useEffect(() => {
    let cancelled = false;
    let locked = false;
    try { locked = sessionStorage.getItem("adv-team-locked") === "1"; } catch { /* stockage indisponible */ }
    if (locked) { setReason("connexion_ancienne"); setBusy(false); return; }
    void unlock()
      .then(async (r) => {
        if (cancelled) return;
        if (r.ok) { await navigate({ to: "/admin", replace: true }); return; }
        setReason(r.reason);
      })
      .catch(() => { if (!cancelled) setReason("erreur"); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [unlock, navigate]);

  async function google() {
    setBusy(true);
    try { sessionStorage.removeItem("adv-team-locked"); } catch { /* stockage indisponible */ }
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/admin-connexion`,
      extraParams: { hd: TEAM_EMAIL_DOMAIN, prompt: "select_account" },
    });
    if (r.error) { setReason("erreur"); setBusy(false); }
  }

  async function signOut() {
    await supabase.auth.signOut();
    await navigate({ to: "/connexion", replace: true });
  }

  const message = reason ? MESSAGES[reason] ?? "La connexion n’a pas abouti. Réessayez." : null;
  return <AppShell nav={false}><div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-12">
    <div className="mb-12 flex justify-center"><Logo /></div>
    <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><ShieldCheck className="size-5" /></div>
    <h1 className="mt-6 text-center font-display text-[32px] font-semibold leading-tight text-primary">Accès équipe</h1>
    <p className="mt-2 text-center text-[13px] text-muted-foreground">Cet espace est réservé à l’équipe Art de Vie. Connexion uniquement avec votre compte Google professionnel @{TEAM_EMAIL_DOMAIN}.</p>
    {message && <p role="status" className="mt-8 rounded-2xl bg-primary/10 p-4 text-xs leading-5 text-primary">{message}</p>}
    <div className="mt-8 grid gap-3">
      {reason !== "hors_equipe" && <Button type="button" variant="primary" size="lg" className="w-full" disabled={busy} onClick={() => void google()}>{busy ? "Vérification…" : "Se connecter avec Google"}</Button>}
      <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => void signOut()}>Changer de compte</Button>
    </div>
    <p className="mt-8 text-center text-[12px] text-muted-foreground">La session équipe se referme automatiquement après deux heures.</p>
  </div></AppShell>;
}
