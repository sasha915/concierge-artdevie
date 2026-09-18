import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, Logo } from "@/components/art-de-vie/app-shell";
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
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("Bienvenue");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const hasVisited = localStorage.getItem("adv-visited");
    if (hasVisited) {
      const variants = ["Bon retour", "Heureux de vous revoir", "Ravi de vous retrouver"];
      setGreeting(variants[Math.floor(Math.random() * variants.length)]);
    } else {
      localStorage.setItem("adv-visited", "true");
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { setError("Email ou mot de passe incorrect."); return; }
      navigate({ to: "/", replace: true });
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: fullName, phone } },
    });
    setBusy(false);
    if (error) {
      const code = (error as { code?: string }).code ?? "";
      if (code === "user_already_exists" || error.message.includes("already registered")) setError("Un compte existe déjà avec cet email.");
      else if (code === "weak_password") setError("Ce mot de passe est trop courant. Choisissez-en un plus personnel et plus long.");
      else if (code === "email_address_invalid") setError("Cette adresse email n’est pas acceptée. Utilisez votre adresse habituelle.");
      else setError("La création du compte a échoué. Réessayez.");
      return;
    }
    if (data.session) { navigate({ to: "/", replace: true }); return; }
    setNotice("Votre compte est créé. Confirmez votre email en cliquant sur le lien que nous venons de vous envoyer.");
  }

  async function reset() {
    if (!email) { setError("Indiquez votre email pour recevoir un lien."); return; }
    setError(null);
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setNotice("Un lien de réinitialisation vient de vous être envoyé.");
  }

  return <AppShell nav={false}><div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
    <div className="mb-14 flex justify-center"><Logo /></div>
    <h1 className="text-center font-display text-[38px] font-semibold text-primary">{mode === "login" ? greeting : "Rejoignez-nous"}</h1>
    <p className="mt-3 text-center text-sm text-muted-foreground">{mode === "login" ? "Votre concierge vous attend." : "Créez votre compte membre en quelques instants."}</p>
    <form className="mt-10 space-y-5" onSubmit={submit}>
      {mode === "signup" && <>
        <div><Label htmlFor="name" className="eyebrow">Nom complet</Label><Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Sasha Allio" className="mt-2 h-14 rounded-2xl border-0 bg-card px-4" /></div>
        <div><Label htmlFor="phone" className="eyebrow">Téléphone</Label><Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+33 6 12 34 56 78" className="mt-2 h-14 rounded-2xl border-0 bg-card px-4" /></div>
      </>}
      <div><Label htmlFor="email" className="eyebrow">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" className="mt-2 h-14 rounded-2xl border-0 bg-card px-4" /></div>
      <div><Label htmlFor="password" className="eyebrow">Mot de passe</Label><Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-2 h-14 rounded-2xl border-0 bg-card px-4" /></div>
      {mode === "login" && <div className="text-right"><button type="button" onClick={reset} className="text-xs font-medium text-primary">Mot de passe oublié ?</button></div>}
      {error && <p className="rounded-2xl bg-primary/10 p-4 text-xs leading-5 text-primary">{error}</p>}
      {notice && <p className="rounded-2xl bg-card p-4 text-xs leading-5 text-primary">{notice}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Un instant…" : mode === "login" ? "Se connecter" : "Créer mon compte"}</Button>
    </form>
    <p className="mt-10 text-center text-sm text-muted-foreground">
      {mode === "login" ? "Pas encore membre ?" : "Vous avez déjà un compte ?"}<br />
      <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setNotice(null); }} className="mt-2 inline-block font-semibold text-primary">
        {mode === "login" ? "Créer mon compte" : "Se connecter"}
      </button>
    </p>
  </div></AppShell>;
}
