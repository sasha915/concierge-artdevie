import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/art-de-vie/cards";
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
import { dayOf } from "@/lib/timezone";
import { PillAction } from "@/components/art-de-vie/v3";
import { t } from "@/lib/i18n";
import { LabeledField } from "@/components/art-de-vie/field";

export const Route = createFileRoute("/_authenticated/membership/parrainer")({ head: () => ({ meta: [{ title: t("Parrainer un membre — Art de Vie") }, { name: "description", content: t("Recommandez une personne de votre entourage à la conciergerie Art de Vie.") }, ] }), component: Page });

function Page() {
  const queryClient = useQueryClient();
  const invite = useServerFn(sendReferralInvite);
  const { data: referrals = [], isLoading, isError, refetch } = useQuery(referralsQuery);
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
      if (!result.ok) { setError(t(result.reason)); return; }
      setSent(fullName.split(/\s+/)[0] ?? fullName);
      setFullName(""); setEmail(""); setMessage("");
      await queryClient.invalidateQueries({ queryKey: ["referrals"] });
    } catch {
      setError(t("Votre recommandation n’a pas pu être transmise. Réessayez dans un instant."));
    } finally {
      setBusy(false);
    }
  }

  return <AppShell nav={false}><div className="mx-auto max-w-3xl lg:max-w-none"><SubHeader title="Parrainer un membre" close backTo="/membership"/>
    <p className="mb-6 max-w-[560px] lg:ml-4 lg:max-w-[760px] lg:text-[18px] lg:leading-7 text-[14px] leading-6 text-muted-foreground">{t("Vous nous recommandez une personne de votre entourage. Notre équipe prend contact avec elle, avec discrétion ; vous suivez ici la suite donnée.")}</p>

    <form className="rounded-[28px] bg-card p-5 sm:p-8 lg:mx-4 lg:p-10" onSubmit={submit}><div className="grid gap-5">
      <Field label={t("Nom de la personne")}><Input value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={80}/></Field>
      <Field label={t("Adresse email")}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={160}/></Field>
      <Field label={t("Mot personnel (facultatif)")}><Textarea rows={4} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("Quelques mots à l’intention de notre équipe…")}/></Field>
      {error && <p role="alert" className="rounded-2xl bg-panel p-4 text-xs leading-5 text-primary">{error}</p>}
      {sent && <p role="status" className="rounded-2xl bg-panel p-4 text-xs leading-5 text-primary">{t("Votre recommandation de {name} nous est transmise.", { name: sent })}</p>}
      <PillAction type="submit" className="w-full sm:max-w-sm" disabled={busy}>{busy ? t("Envoi en cours") : t("Transmettre la recommandation")}</PillAction>
    </div></form>

    <section className="mt-5 lg:mx-4 lg:mt-16">
      <h2 className="eyebrow text-muted-foreground">{t("Vos recommandations")}</h2>
      {isLoading ? (
        <Skeleton className="mt-3 h-24 rounded-card bg-panel" />
      ) : isError ? (
        <div className="mt-3"><ErrorState onRetry={() => void refetch()} /></div>
      ) : referrals.length === 0 ? (
        <p className="mt-3 rounded-card bg-panel p-5 text-[13px] text-muted-foreground">{t("Vous n’avez pas encore recommandé de personne.")}</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-card bg-panel px-5">
          {referrals.map((r) => (
            <div key={r.id} className="flex items-center gap-4 border-b border-primary/25 py-5 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="v3-card-title truncate text-[19px] text-primary">{r.full_name}</p>
                <p className="mt-1 truncate text-[12px] text-muted-foreground">{r.email} · {formatShortDate(dayOf(r.created_at))}</p>
              </div>
              <span className="shrink-0 rounded-full bg-panel px-[13px] py-[5px] text-[12px] font-medium text-primary">{r.status === "Converti" ? t("Devenu membre") : r.status === "Contacté" ? t("Contacté par notre équipe") : t("Transmise")}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  </div></AppShell>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <LabeledField label={label}>{children}</LabeledField>;
}
