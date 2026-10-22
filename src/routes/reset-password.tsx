import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Logo } from "@/components/art-de-vie/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({ meta: [{ title: t("Nouveau mot de passe — Art de Vie") }, { name: "description", content: t("Choisissez un nouveau mot de passe pour votre espace membre.") }, { property: "og:title", content: t("Nouveau mot de passe — Art de Vie") }, { property: "og:description", content: t("Choisissez un nouveau mot de passe pour votre espace membre.") }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setError(t("Le lien a peut-être expiré. Demandez-en un nouveau depuis l’écran de connexion.")); return; }
    navigate({ to: "/", replace: true });
  }

  return <AppShell nav={false}><div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
    <div className="mb-14 text-center"><Logo inverse /></div>
    <h1 className="text-center font-display text-[38px] font-semibold text-primary">{t("Nouveau mot de passe")}</h1>
    <form className="mt-10 space-y-5" onSubmit={submit}>
      <div><Label htmlFor="password" className="eyebrow">{t("Mot de passe")}</Label><Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-2" /></div>
      {error && <p className="rounded-2xl bg-panel p-4 text-xs leading-5 text-primary">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? t("Un instant…") : t("Enregistrer")}</Button>
    </form>
  </div></AppShell>;
}
