import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/art-de-vie/app-shell";
import { SubHeader } from "@/components/art-de-vie/page-header";
import { OfferCard } from "@/components/art-de-vie/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { offersQuery } from "@/lib/adv-queries";

const cats = ["Tables", "Séjours", "Transferts", "Soins"];
const imageByCat: Record<string, string> = { Tables: "restaurant", Séjours: "hotel", Transferts: "hotel", Soins: "spa" };

export const Route = createFileRoute("/_authenticated/demandes/nouvelle")({ head: () => ({ meta: [{ title: "Nouvelle demande — Art de Vie" }, { name: "description", content: "Confiez une nouvelle demande à votre concierge." }, { property: "og:title", content: "Nouvelle demande — Art de Vie" }, { property: "og:description", content: "Confiez une nouvelle demande à votre concierge." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

function Page() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: offers = [] } = useQuery(offersQuery);
  const [category, setCategory] = useState("Tables");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [guests, setGuests] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setBusy(false); setError("Votre session a expiré. Reconnectez-vous."); return; }
    const { data, error } = await supabase.from("requests").insert({
      user_id: auth.user.id,
      category,
      title: title || `Demande ${category.toLowerCase()}`,
      description,
      scheduled_date: date || null,
      scheduled_time: time || null,
      guests: guests ? Number(guests) : null,
      image_key: imageByCat[category] ?? "restaurant",
    }).select("id").single();
    setBusy(false);
    if (error || !data) { setError("L’envoi a échoué. Réessayez dans un instant."); return; }
    await queryClient.invalidateQueries({ queryKey: ["requests"] });
    navigate({ to: "/demandes/$requestId", params: { requestId: data.id } });
  }

  return <AppShell nav={false}><SubHeader title="Nouvelle demande" close backTo="/demandes"/>
    <div className="no-scrollbar flex gap-2 overflow-x-auto">{cats.map((x) => <Button key={x} variant={category === x ? "primary" : "outline"} onClick={() => setCategory(x)} type="button">{x}</Button>)}</div>
    <form className="mt-7 rounded-card bg-card p-5 sm:p-7" onSubmit={submit}><div className="grid gap-5">
      <Field label="Prestation souhaitée"><Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ex. Une table avec vue"/></Field>
      <Field label="Date souhaitée"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)}/></Field>
      <div className="grid grid-cols-2 gap-4"><Field label="Heure"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)}/></Field><Field label="Couverts"><Input type="number" min="1" value={guests} onChange={(e) => setGuests(e.target.value)} placeholder="2"/></Field></div>
      <Field label="Précisions pour votre concierge"><Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Vos envies, contraintes ou attentions particulières…"/></Field>
      {error && <p className="rounded-2xl bg-primary/10 p-4 text-xs leading-5 text-primary">{error}</p>}
      <Button type="submit" size="lg" className="mt-2" disabled={busy}>{busy ? "Envoi…" : "Envoyer la demande"}</Button>
    </div></form>
    <section className="mt-10"><h2 className="font-display text-2xl text-primary">Idées du mois</h2><div className="no-scrollbar -mx-5 mt-4 flex gap-4 overflow-x-auto px-5">{offers.slice(0, 3).map((o) => <OfferCard key={o.id} offer={o} compact/>)}</div></section>
  </AppShell>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="eyebrow">{label}</Label><div className="mt-2 [&_input]:h-12 [&_input]:rounded-2xl [&_input]:border-0 [&_input]:bg-background [&_textarea]:rounded-2xl [&_textarea]:border-0 [&_textarea]:bg-background">{children}</div></div>;
}
