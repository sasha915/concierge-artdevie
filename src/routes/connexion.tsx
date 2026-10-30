import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/art-de-vie/app-shell";
import { Photo } from "@/components/art-de-vie/cards";
import { PillAction, Title } from "@/components/art-de-vie/v3";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { imageFor } from "@/data/art-de-vie";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/i18n";
import { LegalLinks } from "@/components/art-de-vie/legal-links";
import { lovable } from "@/integrations/lovable";
import { TEAM_EMAIL_DOMAIN } from "@/lib/team-auth-rules";

let greetingInitialized = false;

export const Route = createFileRoute("/connexion")({
  ssr: false,
  head: () => ({
    meta: [
      { title: t("Connexion — Art de Vie") },
      { name: "description", content: t("Accédez à votre espace membre Art de Vie.") },
    ],
  }),
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
      const variants = ["Bon retour", "Bon retour parmi nous", "Quel plaisir de vous retrouver"];
      setGreeting(variants[Math.floor(Math.random() * variants.length)] ?? "Bon retour");
    } else localStorage.setItem("adv-visited", "true");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const { data: signedIn, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !signedIn.user) {
      setBusy(false);
      setError(t("Email ou mot de passe incorrect."));
      return;
    }
    // L'équipe se connecte uniquement avec son compte Google Workspace @artdevie.co.
    const { data: team } = await supabase.rpc("is_team", { _user_id: signedIn.user.id });
    if (team === true) {
      await supabase.auth.signOut();
      setBusy(false);
      setError(t("Les comptes de l’équipe se connectent avec Google, avec leur adresse @artdevie.co."));
      return;
    }
    setBusy(false);
    navigate({ to: "/", replace: true });
  }

  /** Équipe : compte Google Workspace @artdevie.co uniquement ; l'espace équipe s'ouvre au retour. */
  async function signInTeam() {
    setError(null);
    setNotice(null);
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/admin-connexion`,
      extraParams: { hd: TEAM_EMAIL_DOMAIN, prompt: "select_account" },
    });
    if (r.error) setError(t("La connexion avec Google n’a pas abouti. Réessayez."));
  }

  const [sending, setSending] = useState(false);
  async function reset() {
    if (!email) {
      setError(t("Indiquez votre email pour recevoir un lien."));
      return;
    }
    setError(null);
    setNotice(null);
    setSending(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setSending(false);
    if (resetError) {
      setError(t("Le lien n’a pas pu être envoyé. Réessayez dans quelques minutes."));
      return;
    }
    // Message identique que l'adresse soit connue ou non : rien n'est révélé sur les comptes existants.
    setNotice(t("Si cette adresse correspond à un compte, un lien de réinitialisation vient de lui être envoyé."));
  }

  const parts = t(greeting).split(" ");
  const italic = `${parts.at(-1) ?? greeting}.`;
  const start = parts.slice(0, -1).join(" ");
  return (
    <main className="min-h-[100svh] bg-background p-3 text-foreground lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-4 lg:p-4">
      <section className="relative isolate flex h-[396px] flex-col justify-between overflow-hidden rounded-[28px] bg-panel px-5 pb-[26px] pt-[22px] md:h-[600px] md:px-8 md:pb-10 md:pt-8 lg:h-auto lg:min-h-[calc(100svh-32px)] lg:px-10 lg:pb-10 lg:pt-8">
        <Photo src={imageFor("entree-de-nuit")} alt={t("Entrée Art de Vie de nuit")} hero eager className="absolute inset-0 -z-10 h-full w-full" />
        <Logo inverse className="h-[30px] w-auto self-start" />
        <div>
          <p className="eyebrow mb-3.5 text-muted-foreground">{t("Espace membre")}</p>
          <Title italic={italic} className="text-[64px] leading-[0.94] md:text-[112px] lg:text-[clamp(72px,8vw,136px)] lg:[&_em]:whitespace-nowrap">
            {start}
            {start ? " " : ""}
          </Title>
          <p className="mt-5 hidden max-w-sm text-[18px] leading-7 text-foreground/90 md:block">
            {t("Connectez-vous pour accéder à votre espace membre.")}
          </p>
        </div>
      </section>
      <div className="lg:flex lg:flex-col lg:justify-center lg:rounded-[28px] lg:bg-panel lg:px-11">
        <form className="mt-3 flex flex-col gap-4 rounded-[28px] bg-panel px-5 py-[22px] md:mt-4 md:p-8 lg:mt-0 lg:py-[22px] lg:bg-transparent lg:px-0" onSubmit={submit}>
          <p className="eyebrow hidden text-muted-foreground md:block">{t("Connexion")}</p>
          {/* Tablette : email et mot de passe sur une ligne. */}
          <div className="flex flex-col gap-4 md:grid md:grid-cols-2 lg:flex">
          <div>
            <Label htmlFor="email" className="eyebrow text-muted-foreground">
              {t("Email")}
            </Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("vous@exemple.fr")} className="mt-2.5" />
          </div>
          <div>
            <Label htmlFor="password" className="eyebrow text-muted-foreground">
              {t("Mot de passe")}
            </Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-2.5" />
          </div>
          </div>
          <button type="button" onClick={() => void reset()} disabled={sending} className="-my-1.5 inline-flex min-h-11 items-center self-start text-[15px] font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {sending ? t("Envoi en cours") : t("Mot de passe oublié ?")}
          </button>
          {error ? <p role="alert" className="rounded-[16px] bg-foreground/10 p-4 text-xs leading-5">{error}</p> : null}
          {notice ? <p role="status" className="rounded-[16px] bg-foreground/10 p-4 text-xs leading-5">{notice}</p> : null}
          <PillAction type="submit" light className="w-full" disabled={busy}>
            {busy ? t("Connexion en cours") : t("Se connecter")}
          </PillAction>
        </form>
        <p className="mx-2 mt-5 text-[14px] leading-[21px] text-muted-foreground md:mx-8 lg:mx-0 lg:mt-2 lg:border-t lg:border-foreground/16 lg:pt-6">
          {t("Pas encore membre ?")}
          <br />
          <span className="text-foreground">{t("Demander une invitation : 58 avenue de Wagram, 75017 Paris")}</span>
        </p>
        <p className="mx-2 mt-4 text-[13px] leading-5 text-muted-foreground md:mx-8 lg:mx-0">
          {t("Équipe Art de Vie :")}{" "}
          <button type="button" onClick={() => void signInTeam()} disabled={busy} className="text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {t("se connecter avec Google")}
          </button>
        </p>
        <LegalLinks className="mx-2 mt-6 md:mx-8 lg:mx-0" />
      </div>
    </main>
  );
}
