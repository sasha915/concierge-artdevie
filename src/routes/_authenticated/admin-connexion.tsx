import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { AppShell, Logo } from "@/components/art-de-vie/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { unlockAdmin } from "@/lib/admin-gate.functions";

export const Route = createFileRoute("/_authenticated/admin-connexion")({
  head: () => ({
    meta: [
      { title: "Accès équipe — Art de Vie" },
      { name: "description", content: "Espace réservé à l’équipe Art de Vie." },
      { property: "og:title", content: "Accès équipe — Art de Vie" },
      { property: "og:description", content: "Espace réservé à l’équipe Art de Vie." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const unlock = useServerFn(unlockAdmin);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await unlock({ data: { password } });
      if (!r.ok) {
        setError(r.reason === "not_configured" ? "L’accès équipe n’est pas encore configuré." : "Mot de passe de l’équipe incorrect.");
        return;
      }
      await navigate({ to: "/admin", replace: true });
    } catch {
      setError("La vérification a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return <AppShell nav={false}><div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-12">
    <div className="mb-12 flex justify-center"><Logo /></div>
    <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><ShieldCheck className="size-5" /></div>
    <h1 className="mt-6 text-center font-display text-[32px] font-semibold leading-tight text-primary">Accès équipe</h1>
    <p className="mt-2 text-center text-[13px] text-muted-foreground">Cet espace est réservé à l’équipe Art de Vie. Saisissez le mot de passe de l’équipe.</p>
    <form className="mt-8 space-y-5" onSubmit={submit}>
      <div>
        <Label htmlFor="admin-password" className="eyebrow">Mot de passe de l’équipe</Label>
        <Input id="admin-password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-2" />
      </div>
      {error && <p className="rounded-2xl bg-primary/10 p-4 text-xs leading-5 text-primary">{error}</p>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>{busy ? "Vérification…" : "Accéder à l’espace équipe"}</Button>
    </form>
    <p className="mt-8 text-center text-[12px] text-muted-foreground">La session équipe se referme automatiquement après deux heures.</p>
  </div></AppShell>;
}
