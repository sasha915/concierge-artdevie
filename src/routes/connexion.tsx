import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, Logo } from "@/components/art-de-vie/app-shell";

let greetingInitialized = false;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/connexion")({
  ssr: false,
  head: () => ({ meta: [{ title: "Connexion — Art de Vie" }, { name: "description", content: "Accédez à votre espace membre Art de Vie." }, { property: "og:title", content: "Connexion — Art de Vie" }, { property: "og:description", content: "Accédez à votre espace membre Art de Vie." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("Bienvenue");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (greetingInitialized) return;
    greetingInitialized = true;
    const hasVisited = localStorage.getItem("adv-visited");
    if (hasVisited) {
      const variants = ["Bon retour", "Heureux de vous revoir", "Ravi de vous retrouver"];
      setGreeting(variants[Math.floor(Math.random() * variants.length)] ?? "Bon retour");
    } else {
      localStorage.setItem("adv-visited", "true");
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setError("Email ou mot de passe incorrect."); return; }
    navigate({ to: "/", replace: true });
  }

  async function reset() {
    if (!email) { setError("Indiquez votre email pour recevoir un lien."); return; }
    setError(null);
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setNotice("Un lien de réinitialisation vient de vous être envoyé.");
  }

  return <AppShell nav={false}><div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
    <div className="mb-14 flex justify-center"><Logo /></div>
    <h1 className="text-center font-display text-[38px] font-semibold leading-[1.1] text-primary">{greeting}</h1>
    <p className="mt-3 text-center text-sm text-muted-foreground">Connectez-vous pour accéder à votre espace membre.</p>
    <form className="mt-10 space-y-5" onSubmit={submit}>
      <div><Label htmlFor="email" className="eyebrow">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" className="mt-2" /></div>
      <div><Label htmlFor="password" className="eyebrow">Mot de passe</Label><Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-2" /></div>
      <div className="text-right"><button type="button" onClick={reset} className="text-xs font-medium text-primary">Mot de passe oublié ?</button></div>
      {error && <p className="rounded-2xl bg-primary/10 p-4 text-xs leading-5 text-primary">{error}</p>}
      {notice && <p className="rounded-2xl bg-card p-4 text-xs leading-5 text-primary">{notice}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Un instant…" : "Se connecter"}</Button>
    </form>
    <p className="mt-10 text-center text-sm text-muted-foreground">
      Pas encore membre ?<br />
      <span className="mt-2 inline-block font-medium text-primary">Demander une invitation : [ADRESSE À CONFIRMER]</span>
    </p>
  </div></AppShell>;
}
