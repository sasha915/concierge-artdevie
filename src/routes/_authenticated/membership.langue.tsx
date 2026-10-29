import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/art-de-vie/app-shell";
import { SubHeader } from "@/components/art-de-vie/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/adv-queries";
import { getLang, setLang, t, type Lang } from "@/lib/i18n";
import { DEFAULT_TIMEZONE, TIMEZONES, setTimeZone } from "@/lib/timezone";

export const Route = createFileRoute("/_authenticated/membership/langue")({
  head: () => ({
    meta: [
      { title: t("Langue de l’application — Art de Vie") },
      { name: "description", content: t("Choisissez la langue de votre espace membre.") },
    ],
  }),
  component: Page,
});

/** Chaque langue est présentée dans sa propre langue. */
const LANGUAGES: Array<{ value: Lang; label: string }> = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
];

function Page() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery(profileQuery);
  const [busy, setBusy] = useState(false);
  const current = profile?.language ?? "fr";
  const currentTz = profile?.timezone ?? DEFAULT_TIMEZONE;

  async function chooseTimezone(tz: string) {
    if (!profile || tz === currentTz) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ timezone: tz } as never).eq("id", profile.id);
      if (error) throw error;
      setTimeZone(tz);
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(t("Le fuseau horaire a été enregistré."));
    } catch {
      toast.error(t("Le changement n’a pas pu être enregistré."));
    } finally {
      setBusy(false);
    }
  }

  async function choose(lang: Lang) {
    if (!profile || lang === current) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ language: lang }).eq("id", profile.id);
      if (error) throw error;
      setLang(lang);
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(t("La langue a été enregistrée."));
    } catch {
      toast.error(t("Le changement n’a pas pu être enregistré."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell nav={false}>
      <div className="mx-auto max-w-3xl lg:max-w-none">
        <SubHeader title="Langue de l’application" />
        <p className="mb-6 max-w-[560px] text-[14px] leading-6 text-muted-foreground lg:ml-4 lg:max-w-[760px] lg:text-[18px] lg:leading-7">
          {t("Vos messages et notifications vous parviennent dans cette langue.")}
        </p>
        {isLoading ? (
          <Skeleton className="h-40 rounded-card bg-panel lg:mx-4" />
        ) : (
          <div role="radiogroup" aria-label={t("Langue de l’application")} className="grid gap-3 text-primary sm:grid-cols-2 lg:mx-4">
            {LANGUAGES.map((l) => {
              const active = current === l.value;
              return (
                <button
                  key={l.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  lang={l.value}
                  disabled={busy}
                  onClick={() => void choose(l.value)}
                  className={`flex min-h-[88px] items-center justify-between gap-4 rounded-card p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:p-6 ${active ? "bg-primary text-background" : "bg-panel hover:bg-primary/15"}`}
                >
                  <span className="v3-card-title text-[24px] lg:text-[30px]">{l.label}</span>
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${active ? "border-background" : "border-primary/40"}`}>{active && <Check className="size-4" />}</span>
                </button>
              );
            })}
          </div>
        )}
        {!isLoading && (
          <section aria-labelledby="timezone-title" className="mt-10 text-primary lg:mx-4 lg:mt-14">
            <h2 id="timezone-title" className="eyebrow">{t("Fuseau horaire")}</h2>
            <p className="mt-3 max-w-[560px] text-[14px] leading-6 text-muted-foreground lg:max-w-[760px] lg:text-[18px] lg:leading-7">
              {t("Les heures de vos échanges s’affichent à l’heure de votre ville. L’heure d’une prestation reste celle du lieu.")}
            </p>
            <label htmlFor="member-timezone" className="sr-only">{t("Fuseau horaire")}</label>
            <select
              id="member-timezone"
              value={currentTz}
              disabled={busy}
              onChange={(e) => void chooseTimezone(e.target.value)}
              className="mt-4 h-[52px] w-full max-w-[420px] rounded-full border border-foreground/24 bg-panel px-5 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {!TIMEZONES.some((z) => z.id === currentTz) && <option value={currentTz}>{currentTz}</option>}
              {TIMEZONES.map((z) => <option key={z.id} value={z.id}>{getLang() === "en" ? z.en : z.fr}</option>)}
            </select>
          </section>
        )}
      </div>
    </AppShell>
  );
}
