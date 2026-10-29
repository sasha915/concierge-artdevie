import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/art-de-vie/app-shell";
import { SubHeader } from "@/components/art-de-vie/page-header";
import { ChoiceGroup } from "@/components/art-de-vie/welcome";
import { PillAction } from "@/components/art-de-vie/v3";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { welcomeQuery } from "@/lib/adv-queries";
import { saveMyWelcome } from "@/lib/messages.functions";
import { EMPTY_ANSWERS, WELCOME_STEPS, type WelcomeAnswers } from "@/lib/member-rules";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/membership/preferences")({
  head: () => ({
    meta: [
      { title: t("Mes préférences — Art de Vie") },
      { name: "description", content: t("Vos goûts à table, en voyage et en déplacement, et les dates qui comptent pour vous.") },
    ],
  }),
  component: Page,
});

function Page() {
  const queryClient = useQueryClient();
  const save = useServerFn(saveMyWelcome);
  const { data, isLoading } = useQuery(welcomeQuery);
  const [answers, setAnswers] = useState<WelcomeAnswers>(EMPTY_ANSWERS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setAnswers(data.answers);
  }, [data]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await save({ data: { ...answers, complete: true } });
      if (!res.ok) {
        toast.error(t(res.reason));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["welcome"] });
      toast.success(t("Vos préférences sont enregistrées."));
    } catch {
      toast.error(t("Vos préférences n’ont pas pu être enregistrées."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell nav={false}>
      <div className="mx-auto max-w-3xl lg:max-w-none">
        <SubHeader title="Mes préférences" />
        {isLoading ? (
          <Skeleton className="h-64 rounded-card bg-panel lg:mx-4" />
        ) : (
          <form onSubmit={submit} className="grid gap-4 text-primary lg:mx-4 lg:grid-cols-2">
            {WELCOME_STEPS.map((s) => (
              <section key={s.key} className="rounded-card bg-panel p-5 lg:p-6">
                <p className="eyebrow">{t(s.eyebrow)}</p>
                <h2 className="v3-card-title mt-3 text-[22px] lg:text-[26px]">{t(s.question)}</h2>
                <div className="mt-5">
                  <ChoiceGroup label={t(s.question)} options={s.options} value={answers[s.key]} onChange={(next) => setAnswers((a) => ({ ...a, [s.key]: next }))} />
                </div>
              </section>
            ))}
            <section className="rounded-card bg-panel p-5 lg:p-6">
              <p className="eyebrow">{t("Dates à retenir")}</p>
              <label htmlFor="pref-dates" className="v3-card-title mt-3 block text-[22px] lg:text-[26px]">{t("Quelles dates comptent pour vous ?")}</label>
              <Textarea id="pref-dates" rows={5} maxLength={2000} value={answers.dates_membre} onChange={(e) => setAnswers((a) => ({ ...a, dates_membre: e.target.value }))} className="mt-5" />
            </section>
            <div className="lg:col-span-2">
              <PillAction type="submit" disabled={busy}>{t("Enregistrer")}</PillAction>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
