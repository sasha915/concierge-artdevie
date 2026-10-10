import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/art-de-vie/app-shell";
import { Photo } from "@/components/art-de-vie/cards";
import { PillAction, Title } from "@/components/art-de-vie/v3";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { imageFor } from "@/data/art-de-vie";
import { supabase } from "@/integrations/supabase/client";

let greetingInitialized = false;

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
    } else localStorage.setItem("adv-visited", "true");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) { setError("Email ou mot de passe incorrect."); return; }
    navigate({ to: "/", replace: true });
  }

  async function reset() {
    if (!email) { setError("Indiquez votre email pour recevoir un lien."); return; }
    setError(null);
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setNotice("Un lien de réinitialisation vient de vous être envoyé.");
  }

  const parts = greeting.split(" ");
  const italic = `${parts.at(-1) ?? greeting}.`;
  const start = parts.slice(0, -1).join(" ");
  return <main className="relative min-h-[100svh] overflow-hidden bg-primary-deep text-primary-foreground">
    <Photo src={imageFor("entree-de-nuit")} alt="Entrée Art de Vie de nuit" hero eager className="absolute inset-0 h-full w-full" />
    <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-[1180px] flex-col px-5 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))] sm:px-8 lg:px-12">
      <Logo inverse className="h-[24px] w-auto self-center lg:self-start" />
      <div className="my-auto grid items-end gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-12">
        <div className="lg:min-w-0"><p className="eyebrow text-primary-foreground/80">Espace membre</p><Title italic={italic} className="mt-5 text-[58px] lg:text-[clamp(64px,9.2vw,132px)] lg:leading-[0.96]">{start}{start ? " " : ""}</Title><p className="mt-5 max-w-sm text-[14px] leading-5 lg:text-[18px] lg:leading-7">Connectez-vous pour accéder à votre espace membre.</p></div>
        <form className="dark-glass rounded-card p-5 sm:p-7" onSubmit={submit}>
          <div><Label htmlFor="email" className="eyebrow text-primary-foreground/80">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" className="mt-2" /></div>
          <div className="mt-5"><Label htmlFor="password" className="eyebrow text-primary-foreground/80">Mot de passe</Label><Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-2" /></div>
          <div className="mt-3 text-right"><Button type="button" variant="ghost" size="sm" onClick={reset} className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">Mot de passe oublié ?</Button></div>
          {error ? <p className="mt-3 rounded-[16px] bg-primary-foreground/10 p-4 text-xs leading-5">{error}</p> : null}
          {notice ? <p className="mt-3 rounded-[16px] bg-primary-foreground/10 p-4 text-xs leading-5">{notice}</p> : null}
          <PillAction type="submit" light className="mt-5 w-full" disabled={busy}>{busy ? "Connexion en cours" : "Se connecter"}</PillAction>
        </form>
      </div>
      <p className="text-center text-[13px] leading-5 text-primary-foreground/80 lg:text-left">Pas encore membre ? <span className="font-medium text-primary-foreground">Demander une invitation : [ADRESSE À CONFIRMER]</span></p>
    </div>
  </main>;
}