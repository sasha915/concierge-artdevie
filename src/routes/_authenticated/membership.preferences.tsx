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

export const Route = createFileRoute("/_authenticated/membership/preferences")({
  head: () => ({
    meta: [
      { title: "Mes préférences — Art de Vie" },
      { name: "description", content: "Vos goûts à table, en voyage et en déplacement, et les dates qui comptent pour vous." },
      { property: "og:title", content: "Mes préférences — Art de Vie" },
      { property: "og:description", content: "Vos goûts à table, en voyage et en déplacement, et les dates qui comptent pour vous." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
        toast.error(res.reason);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["welcome"] });
      toast.success("Vos préférences sont enregistrées.");
    } catch {
      toast.error("Vos préférences n’ont pas pu être enregistrées.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell nav={false}>
      <div className="mx-auto max-w-3xl lg:max-w-none">
        <SubHeader title="Mes préférences" />
        {isLoading ? (
          <Skeleton className="h-64 rounded-card bg-primary/10 lg:mx-[clamp(20px,3.9vw,56px)]" />
        ) : (
          <form onSubmit={submit} className="grid gap-4 text-primary lg:mx-[clamp(20px,3.9vw,56px)] lg:grid-cols-2">
            {WELCOME_STEPS.map((s) => (
              <section key={s.key} className="rounded-card bg-primary/10 p-5 lg:p-6">
                <p className="eyebrow">( {s.eyebrow} )</p>
                <h2 className="v3-card-title mt-3 text-[22px] lg:text-[26px]">{s.question}</h2>
                <div className="mt-5">
                  <ChoiceGroup label={s.question} options={s.options} value={answers[s.key]} onChange={(next) => setAnswers((a) => ({ ...a, [s.key]: next }))} />
                </div>
              </section>
            ))}
            <section className="rounded-card bg-primary/10 p-5 lg:p-6">
              <p className="eyebrow">( Dates à retenir )</p>
              <label htmlFor="pref-dates" className="v3-card-title mt-3 block text-[22px] lg:text-[26px]">Quelles dates comptent pour vous ?</label>
              <Textarea id="pref-dates" rows={5} maxLength={2000} value={answers.dates_membre} onChange={(e) => setAnswers((a) => ({ ...a, dates_membre: e.target.value }))} className="mt-5" />
            </section>
            <div className="lg:col-span-2">
              <PillAction type="submit" disabled={busy}>Enregistrer</PillAction>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
