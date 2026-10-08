import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/art-de-vie/app-shell";
import { SubHeader } from "@/components/art-de-vie/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { referralsQuery } from "@/lib/adv-queries";
import { sendReferralInvite } from "@/lib/referrals.functions";
import { formatShortDate } from "@/data/art-de-vie";
import { PillAction } from "@/components/art-de-vie/v3";

export const Route = createFileRoute("/_authenticated/membership/parrainer")({ head: () => ({ meta: [{ title: "Parrainer un membre — Art de Vie" }, { name: "description", content: "Invitez un proche à rejoindre la conciergerie Art de Vie." }, { property: "og:title", content: "Parrainer un membre — Art de Vie" }, { property: "og:description", content: "Invitez un proche à rejoindre la conciergerie Art de Vie." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

function Page() {
  const queryClient = useQueryClient();
  const invite = useServerFn(sendReferralInvite);
  const { data: referrals = [] } = useQuery(referralsQuery);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setSent(null);
    try {
      const result = await invite({ data: { fullName, email, message: message || undefined } });
      if (!result.ok) { setError(result.reason); return; }
      setSent(fullName.split(/\s+/)[0] ?? fullName);
      setFullName(""); setEmail(""); setMessage("");
      await queryClient.invalidateQueries({ queryKey: ["referrals"] });
    } catch {
      setError("L’invitation n’a pas pu être envoyée. Réessayez dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  return <AppShell nav={false}><div className="mx-auto max-w-3xl"><SubHeader title="Parrainer un membre" close backTo="/membership"/>
    <p className="mb-6 max-w-[560px] text-[14px] leading-6 text-muted-foreground">Votre invité reçoit un email personnel contenant un lien privé. Ce lien crée automatiquement son compte membre — il n’a plus qu’à choisir son mot de passe.</p>

    <form className="rounded-[28px] bg-card p-5 sm:p-8" onSubmit={submit}><div className="grid gap-5">
      <Field label="Nom de votre invité"><Input value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={80} placeholder="Ex. Élise Marchand"/></Field>
      <Field label="Adresse email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={160} placeholder="elise@exemple.com"/></Field>
      <Field label="Mot personnel (facultatif)"><Textarea rows={4} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Quelques mots que votre concierge transmettra…"/></Field>
      {error && <p className="rounded-2xl bg-primary/10 p-4 text-xs leading-5 text-primary">{error}</p>}
      {sent && <p className="rounded-2xl bg-primary/10 p-4 text-xs leading-5 text-primary">L’invitation a bien été envoyée à {sent}.</p>}
      <PillAction type="submit" className="w-full sm:max-w-sm" disabled={busy}>{busy ? "Envoi en cours" : "Envoyer l’invitation"}</PillAction>
    </div></form>

    <section className="mt-5">
      <h2 className="eyebrow text-primary-light">Vos invitations</h2>
      {referrals.length === 0 ? (
        <p className="mt-3 rounded-card bg-primary/10 p-5 text-[13px] text-muted-foreground">Vous n’avez pas encore parrainé de membre.</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-card bg-primary/10 px-5">
          {referrals.map((r) => (
            <div key={r.id} className="flex items-center gap-4 border-b border-primary/25 py-5 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="v3-card-title truncate text-[19px] text-primary">{r.full_name}</p>
                <p className="mt-1 truncate text-[12px] text-muted-foreground">{r.email} · {formatShortDate(r.created_at.slice(0, 10))}</p>
              </div>
              <span className="shrink-0 rounded-full bg-primary/10 px-[13px] py-[5px] text-[12px] font-medium text-primary">{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  </div></AppShell>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="eyebrow">{label}</Label><div className="mt-2">{children}</div></div>;
}
