import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/art-de-vie/app-shell";
import { SubHeader } from "@/components/art-de-vie/page-header";
import { PillAction } from "@/components/art-de-vie/v3";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatShortDate } from "@/data/art-de-vie";
import { dayOf } from "@/lib/timezone";
import { myDelegatesQuery } from "@/lib/adv-queries";
import { canInviteDelegate, delegateStatusLabel, MAX_DELEGATES, openDelegates } from "@/lib/delegate-rules";
import { inviteDelegate, revokeMyDelegate } from "@/lib/delegates.functions";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/membership/proches")({
  head: () => ({
    meta: [
      { title: t("Proches autorisés — Art de Vie") },
      { name: "description", content: t("Permettez à un proche de nous confier des demandes en votre nom.") },
      { property: "og:title", content: t("Proches autorisés — Art de Vie") },
      { property: "og:description", content: t("Permettez à un proche de nous confier des demandes en votre nom.") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

const CAN = [
  "Confier une demande en votre nom",
  "Suivre les demandes qu’il a faites et échanger avec nous à leur sujet",
];
const CANNOT = [
  "Voir vos autres demandes, vos factures, votre relevé ou votre formule",
  "Répondre à une proposition ou régler une prestation",
  "Modifier votre compte ou vos préférences",
];

function Page() {
  const queryClient = useQueryClient();
  const invite = useServerFn(inviteDelegate);
  const revoke = useServerFn(revokeMyDelegate);
  const { data: delegates = [], isLoading } = useQuery(myDelegatesQuery);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [relation, setRelation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const open = openDelegates(delegates);
  const canInvite = canInviteDelegate(delegates);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await invite({ data: { fullName, email, relation } });
      if (!res.ok) { setError(t(res.reason)); return; }
      toast.success(t("Invitation enregistrée. Notre équipe confirme l’identité de votre proche avant d’ouvrir son accès."));
      setFullName(""); setEmail(""); setRelation("");
      await queryClient.invalidateQueries({ queryKey: ["delegates"] });
    } catch {
      setError(t("L’invitation n’a pas pu être enregistrée."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      const res = await revoke({ data: { id } });
      if (!res.ok) { toast.error(t(res.reason)); return; }
      toast.success(t("L’accès est retiré."));
      setConfirming(null);
      await queryClient.invalidateQueries({ queryKey: ["delegates"] });
    } catch {
      toast.error(t("L’accès n’a pas pu être retiré."));
    }
  }

  return (
    <AppShell nav={false}>
      <div className="mx-auto max-w-3xl lg:max-w-none">
        <SubHeader title="Proches autorisés" close backTo="/membership" />
        <p className="mb-6 max-w-[560px] text-[14px] leading-6 text-muted-foreground lg:ml-4 lg:max-w-[760px] lg:text-[18px] lg:leading-7">
          {t("Un proche, votre agent ou votre assistant peut nous confier des demandes en votre nom, avec son propre accès. Vous êtes prévenu de chacune, et vous pouvez retirer cet accès à tout moment.")}
        </p>

        <section className="grid gap-3 lg:mx-4 lg:grid-cols-2 lg:gap-4">
          <div className="rounded-[24px] bg-panel p-5 text-foreground lg:rounded-[28px] lg:p-7">
            <h2 className="eyebrow text-muted-foreground">{t("Votre proche peut")}</h2>
            <ul className="mt-3 grid gap-2 text-[14px] leading-6 lg:text-[16px]">{CAN.map((c) => <li key={c}>{t(c)}</li>)}</ul>
          </div>
          <div className="rounded-[24px] border border-foreground/16 bg-glass p-5 text-foreground lg:rounded-[28px] lg:p-7">
            <h2 className="eyebrow text-muted-foreground">{t("Il ne peut pas")}</h2>
            <ul className="mt-3 grid gap-2 text-[14px] leading-6 lg:text-[16px]">{CANNOT.map((c) => <li key={c}>{t(c)}</li>)}</ul>
          </div>
        </section>

        <section className="mt-8 lg:mx-4 lg:mt-12">
          <h2 className="eyebrow text-muted-foreground">{t("Vos proches")} · {open.length}/{MAX_DELEGATES}</h2>
          {isLoading ? null : delegates.length === 0 ? (
            <p className="mt-3 rounded-card bg-panel p-5 text-[13px] text-muted-foreground">{t("Aucun proche n’a encore d’accès.")}</p>
          ) : (
            <ul className="mt-3 overflow-hidden rounded-card bg-panel px-5">
              {delegates.map((d) => {
                const active = d.status === "en_attente" || d.status === "actif";
                return (
                  <li key={d.id} className="border-b border-primary/25 py-5 last:border-0">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="min-w-0 flex-1 basis-[200px]">
                        <p className="v3-card-title truncate text-[19px] text-primary">{d.full_name}</p>
                        <p className="mt-1 truncate text-[12px] text-muted-foreground">{[d.relation, d.email, formatShortDate(dayOf(d.invited_at))].filter(Boolean).join(" · ")}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-[13px] py-[5px] text-[12px] font-medium ${d.status === "actif" ? "bg-primary text-primary-foreground" : "bg-foreground/10 text-primary"}`}>{t(delegateStatusLabel(d.status))}</span>
                    </div>
                    {active && (confirming === d.id ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <p className="text-[13px] text-muted-foreground">{t("Retirer l’accès de {name} ?", { name: d.full_name })}</p>
                        <Button type="button" size="sm" onClick={() => void remove(d.id)}>{t("Confirmer")}</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(null)}>{t("Annuler")}</Button>
                      </div>
                    ) : (
                      <Button type="button" variant="link" className="mt-2 h-auto px-0 text-[13px]" onClick={() => setConfirming(d.id)}>
                        {d.status === "en_attente" ? t("Annuler l’invitation") : t("Retirer l’accès")}
                      </Button>
                    ))}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {canInvite ? (
          <form className="mt-8 rounded-[28px] bg-card p-5 sm:p-8 lg:mx-4 lg:mt-12 lg:p-10" onSubmit={submit}>
            <h2 className="eyebrow text-primary">{t("Inviter un proche")}</h2>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <Field id="delegate-name" label={t("Nom et prénom")}><Input id="delegate-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} maxLength={80} autoComplete="off" /></Field>
              <Field id="delegate-email" label={t("Adresse email")}><Input id="delegate-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={160} autoComplete="off" /></Field>
              <Field id="delegate-relation" label={t("Lien avec vous (facultatif)")}><Input id="delegate-relation" value={relation} onChange={(e) => setRelation(e.target.value)} maxLength={60} placeholder={t("Agent, conjoint, assistant…")} /></Field>
            </div>
            <p className="mt-5 text-[13px] leading-5 text-muted-foreground">{t("Notre équipe confirme l’identité de votre proche avant d’ouvrir son accès ; il reçoit alors un email pour choisir son mot de passe.")}</p>
            {error && <p role="alert" className="mt-4 rounded-2xl bg-panel p-4 text-xs leading-5 text-primary">{error}</p>}
            <PillAction type="submit" className="mt-6 w-full sm:max-w-sm" disabled={busy}>{busy ? t("Envoi en cours") : t("Inviter ce proche")}</PillAction>
          </form>
        ) : (
          <p className="mt-8 rounded-card bg-panel p-5 text-[13px] text-muted-foreground lg:mx-4">{t("Vous avez déjà trois proches autorisés. Retirez un accès pour en inviter un autre.")}</p>
        )}
      </div>
    </AppShell>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div><Label htmlFor={id} className="eyebrow">{label}</Label><div className="mt-2">{children}</div></div>;
}
