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
import { setLang, t, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/membership/langue")({
  head: () => ({
    meta: [
      { title: t("Langue de l’application — Art de Vie") },
      { name: "description", content: t("Choisissez la langue de votre espace membre.") },
      { property: "og:title", content: t("Langue de l’application — Art de Vie") },
      { property: "og:description", content: t("Choisissez la langue de votre espace membre.") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
        <p className="mb-6 max-w-[560px] text-[14px] leading-6 text-muted-foreground lg:ml-[clamp(20px,3.9vw,56px)] lg:max-w-[760px] lg:text-[18px] lg:leading-7">
          {t("Vos messages et notifications vous parviennent dans cette langue.")}
        </p>
        {isLoading ? (
          <Skeleton className="h-40 rounded-card bg-primary/10 lg:mx-[clamp(20px,3.9vw,56px)]" />
        ) : (
          <div role="radiogroup" aria-label={t("Langue de l’application")} className="grid gap-3 text-primary sm:grid-cols-2 lg:mx-[clamp(20px,3.9vw,56px)]">
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
                  className={`flex min-h-[88px] items-center justify-between gap-4 rounded-card p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:p-6 ${active ? "bg-primary text-background" : "bg-primary/10 hover:bg-primary/15"}`}
                >
                  <span className="v3-card-title text-[24px] lg:text-[30px]">{l.label}</span>
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${active ? "border-background" : "border-primary/40"}`}>{active && <Check className="size-4" />}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
