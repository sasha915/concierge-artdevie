import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Logo } from "@/components/art-de-vie/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({ meta: [{ title: t("Votre mot de passe — Art de Vie") }, { name: "description", content: t("Choisissez le mot de passe de votre espace membre.") }, ] }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError(t("Les deux mots de passe ne correspondent pas.")); return; }
    setBusy(true); setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setError(t("Le lien a peut-être expiré. Demandez-en un nouveau depuis l’écran de connexion.")); return; }
    navigate({ to: "/", replace: true });
  }

  return <AppShell nav={false}><div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
    <div className="mb-14 text-center"><Logo inverse /></div>
    <h1 className="text-center font-display text-[38px] font-semibold text-primary">{t("Votre mot de passe")}</h1>
    <p className="mt-3 text-center text-[14px] leading-6 text-muted-foreground">{t("Choisissez le mot de passe de votre espace Art de Vie : au moins huit caractères.")}</p>
    <form className="mt-10 space-y-5" onSubmit={submit}>
      <div><Label htmlFor="password" className="eyebrow">{t("Mot de passe")}</Label><Input id="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2" /></div>
      <div><Label htmlFor="password-confirm" className="eyebrow">{t("Confirmation")}</Label><Input id="password-confirm" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-2" /></div>
      {error && <p role="alert" className="rounded-2xl bg-panel p-4 text-xs leading-5 text-primary">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? t("Un instant…") : t("Enregistrer")}</Button>
    </form>
    <Link to="/connexion" className="mt-6 self-center text-[14px] text-muted-foreground underline underline-offset-4">{t("Retour à la connexion")}</Link>
  </div></AppShell>;
}
