import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, Logo } from "@/components/art-de-vie/app-shell";
import { ChoiceGroup, WELCOME_LATER_KEY } from "@/components/art-de-vie/welcome";
import { PillAction, Title } from "@/components/art-de-vie/v3";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { welcomeQuery } from "@/lib/adv-queries";
import { saveMyWelcome } from "@/lib/messages.functions";
import { EMPTY_ANSWERS, WELCOME_STEPS, type WelcomeAnswers } from "@/lib/member-rules";
import { t, tPair } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/bienvenue")({
  head: () => ({
    meta: [
      { title: t("Faisons connaissance — Art de Vie") },
      { name: "description", content: t("Quelques questions pour que notre maison réponde à vos goûts dès la première demande.") },
      { property: "og:title", content: t("Faisons connaissance — Art de Vie") },
      { property: "og:description", content: t("Quelques questions pour que notre maison réponde à vos goûts dès la première demande.") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

const TOTAL = WELCOME_STEPS.length + 1;

function Page() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const save = useServerFn(saveMyWelcome);
  const { data } = useQuery(welcomeQuery);
  const [answers, setAnswers] = useState<WelcomeAnswers>(EMPTY_ANSWERS);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setAnswers(data.answers);
  }, [data]);

  function later() {
    try { sessionStorage.setItem(WELCOME_LATER_KEY, "1"); } catch { /* stockage indisponible */ }
    void navigate({ to: "/", replace: true });
  }

  async function finish() {
    setBusy(true);
    try {
      const res = await save({ data: { ...answers, complete: true } });
      if (!res.ok) {
        toast.error(t(res.reason));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["welcome"] });
      toast.success(t("Merci. Vos réponses sont transmises à votre conciergerie."));
      await navigate({ to: "/", replace: true });
    } catch {
      toast.error(t("Vos réponses n’ont pas pu être enregistrées."));
    } finally {
      setBusy(false);
    }
  }

  const current = WELCOME_STEPS[step];

  return (
    <AppShell nav={false}>
      <div className="mx-auto max-w-[720px] text-primary lg:pt-8">
        <div className="flex items-center justify-between">
          <Logo className="h-[19px] w-auto" />
          <Button type="button" variant="link" onClick={later} className="px-0">{t("Plus tard")}</Button>
        </div>

        <p className="eyebrow mt-10">{t("( Étape {n} sur {total} )", { n: step + 1, total: TOTAL })}</p>
        <Title italic={tPair("Faisons", "connaissance.")[1]} className="mt-4 text-[44px] lg:text-[72px]">{tPair("Faisons", "connaissance.")[0]} </Title>
        <p className="mt-5 max-w-[560px] text-[14px] leading-6 text-muted-foreground lg:text-[18px] lg:leading-7">
          {t("Quelques réponses suffisent pour que nos propositions vous ressemblent dès la première demande. Vous pourrez les modifier à tout moment depuis votre Membership.")}
        </p>

        <section aria-labelledby="welcome-step" className="mt-10 rounded-card bg-primary/10 p-5 sm:p-8">
          {current ? (
            <>
              <p className="eyebrow">( {t(current.eyebrow)} )</p>
              <h2 id="welcome-step" className="v3-card-title mt-3 text-[26px] lg:text-[32px]">{t(current.question)}</h2>
              <p className="mt-2 text-[13px] text-muted-foreground">{t("Plusieurs choix possibles.")}</p>
              <div className="mt-6">
                <ChoiceGroup
                  label={t(current.question)}
                  options={current.options}
                  value={answers[current.key]}
                  onChange={(next) => setAnswers((a) => ({ ...a, [current.key]: next }))}
                />
              </div>
            </>
          ) : (
            <>
              <p className="eyebrow">{t("( Dates à retenir )")}</p>
              <h2 id="welcome-step" className="v3-card-title mt-3 text-[26px] lg:text-[32px]">{t("Quelles dates comptent pour vous ?")}</h2>
              <label htmlFor="welcome-dates" className="mt-2 block text-[13px] text-muted-foreground">{t("Anniversaires, fêtes, rendez-vous de chaque année.")}</label>
              <Textarea
                id="welcome-dates"
                rows={5}
                maxLength={2000}
                value={answers.dates_membre}
                onChange={(e) => setAnswers((a) => ({ ...a, dates_membre: e.target.value }))}
                className="mt-6"
              />
            </>
          )}
        </section>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          {step > 0 ? (
            <Button type="button" variant="outline" size="lg" onClick={() => setStep((s) => s - 1)}>{t("Retour")}</Button>
          ) : <span />}
          {current ? (
            <PillAction type="button" onClick={() => setStep((s) => s + 1)}>{t("Continuer")}</PillAction>
          ) : (
            <PillAction type="button" disabled={busy} onClick={() => void finish()}>{t("Terminer")}</PillAction>
          )}
        </div>
      </div>
    </AppShell>
  );
}
