import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AdminShell } from "@/components/art-de-vie/admin-shell";
import { Title } from "@/components/art-de-vie/v3";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { imageFor } from "@/data/art-de-vie";
import { adminOffersQuery } from "@/lib/admin-queries";
import { createOffer, updateOffer, setOfferPublished, uploadOfferImage, OFFER_CATEGORIES, type AdminOffer, type OfferInput } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/offres")({
  beforeLoad: ({ context }) => { if (context.teamRole !== "admin") throw redirect({ to: "/admin" }); },
  head: () => ({ meta: [
    { title: "Offres — Équipe Art de Vie" },
    { name: "description", content: "Créer, modifier, retirer et republier les offres réservées aux membres." },
    { property: "og:title", content: "Offres — Équipe Art de Vie" },
    { property: "og:description", content: "Créer, modifier, retirer et republier les offres réservées aux membres." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Page,
});

const empty: OfferInput = { title: "", partner: "", category: "Restaurant", place: "", promo: "", validity: "", image_url: null };

function Page() {
  const qc = useQueryClient();
  const { data: offers = [], isLoading } = useQuery(adminOffersQuery);
  const publish = useServerFn(setOfferPublished);
  const [editing, setEditing] = useState<AdminOffer | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function toggle(o: AdminOffer) {
    if (o.published && !window.confirm(`Retirer l’offre « ${o.title} » ? Elle ne sera plus visible des membres.`)) return;
    setBusy(o.id); setNotice(null);
    try {
      const r = await publish({ data: { id: o.id, published: !o.published } });
      setNotice(r.ok ? { ok: true, text: o.published ? "Offre retirée." : "Offre republiée." } : { ok: false, text: r.reason });
      await qc.invalidateQueries({ queryKey: ["admin", "offers"] });
      await qc.invalidateQueries({ queryKey: ["offers"] });
    } catch { setNotice({ ok: false, text: "L’opération a échoué." }); }
    finally { setBusy(null); }
  }

  return <AdminShell>
    <header className="mb-[22px] flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow team-mention">Offres</p>
        <Title italic="offres." className="mt-3 text-primary lg:text-[clamp(52px,6vw,88px)]">Les </Title>
        <p className="mt-2 text-[13px] text-muted-foreground">Privilèges proposés aux membres, publiés ou retirés.</p>
      </div>
    </header>

    {notice && <p role="status" className={`mb-5 rounded-2xl p-4 text-xs leading-5 text-primary ${notice.ok ? "bg-primary/10" : "border border-primary/25"}`}>{notice.text}</p>}

    {/* Maquette V4 : liste à gauche, formulaire permanent en colonne beige à droite. */}
    <div className="grid min-w-0 gap-6 lg:grid-cols-12">
    <div className="min-w-0 lg:col-span-8">
    {isLoading ? <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-72 rounded-[24px] bg-primary/10" /><Skeleton className="h-72 rounded-[28px] bg-primary/10" /></div>
      : offers.length === 0 ? <p className="team-panel rounded-[28px] p-6 text-[14px] text-muted-foreground">Aucune offre pour le moment.</p>
      : <ul className="grid min-w-0 gap-4 sm:grid-cols-2">
        {offers.map((o) => {
          const src = o.preview_url ?? imageFor(o.image_key);
          return <li key={o.id} className={`team-panel flex min-w-0 flex-col overflow-hidden rounded-[24px] ${o.published ? "" : "opacity-70"}`}>
            <div className="relative h-44 bg-primary-deep">{src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center font-display text-2xl italic text-primary-foreground">{o.category}</span>}
              <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-medium ${o.published ? "bg-primary text-primary-foreground" : "border border-dashed border-foreground/40 bg-background/80 text-foreground"}`}>{o.published ? "Publiée" : "Retirée"}</span></div>
            <div className="flex flex-1 flex-col p-5">
              <p className="eyebrow team-mention">{o.promo}</p>
              <h2 className="mt-2 text-[20px] text-primary">{o.title}</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">{o.partner} · {o.place}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{o.category} · {o.validity}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Button type="button" variant="outline" size="sm" onClick={() => { setEditing(o); setNotice(null); document.getElementById("offre-form")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Modifier</Button>
                <Button type="button" variant="outline" size="sm" disabled={busy === o.id} onClick={() => toggle(o)}>{o.published ? "Retirer" : "Republier"}</Button>
              </div>
            </div>
          </li>;
        })}
      </ul>}
    </div>
    <div className="min-w-0 lg:col-span-4">
      <OfferForm key={editing === null || editing === "new" ? "new" : editing.id} offer={editing === null || editing === "new" ? null : editing}
        onDone={async (text) => { setEditing(null); setNotice({ ok: true, text }); await qc.invalidateQueries({ queryKey: ["admin", "offers"] }); await qc.invalidateQueries({ queryKey: ["offers"] }); }}
        onCancel={() => setEditing(null)} />
    </div>
    </div>
  </AdminShell>;
}

function OfferForm({ offer, onDone, onCancel }: { offer: AdminOffer | null; onDone: (text: string) => void; onCancel: () => void }) {
  const create = useServerFn(createOffer);
  const update = useServerFn(updateOffer);
  const upload = useServerFn(uploadOfferImage);
  const [form, setForm] = useState<OfferInput>(offer ? { title: offer.title, partner: offer.partner, category: offer.category, place: offer.place, promo: offer.promo, validity: offer.validity, image_url: offer.image_url } : empty);
  const [preview, setPreview] = useState<string | undefined>(offer ? offer.preview_url ?? imageFor(offer.image_key) : undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof OfferInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Formats acceptés : JPEG, PNG ou WebP."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("La photo dépasse 5 Mo."); return; }
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await upload({ data: fd });
      if (!r.ok) { setError(r.reason); return; }
      setForm((f) => ({ ...f, image_url: r.path }));
      setPreview(r.previewUrl ?? URL.createObjectURL(file));
    } catch { setError("L’envoi de la photo a échoué."); }
    finally { setBusy(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = offer ? await update({ data: { ...form, id: offer.id } }) : await create({ data: form });
      if (!r.ok) { setError(r.reason); return; }
      onDone(offer ? "Offre modifiée." : "Offre créée et publiée.");
    } catch { setError("Vérifiez les champs de l’offre."); }
    finally { setBusy(false); }
  }

  const field = (id: keyof OfferInput, label: string, max = 120) => <div><Label htmlFor={`of-${id}`} className="eyebrow text-muted-foreground">{label}</Label><Input id={`of-${id}`} className="mt-2" required maxLength={max} value={(form[id] as string) ?? ""} onChange={set(id)} /></div>;

  return <form id="offre-form" onSubmit={submit} className="team-beige grid min-w-0 gap-4 rounded-[28px] p-6 lg:sticky lg:top-6">
    <p className="eyebrow">{offer ? "Modifier l’offre" : "Nouvelle offre"}</p>
    <Title as="h2" italic="offre." className="text-[40px] leading-none">{offer ? "Modifier l’" : "Créer une "}</Title>
    {field("title", "Titre")}
    {field("partner", "Partenaire")}
    <div role="group" aria-labelledby="of-category-label"><p id="of-category-label" className="eyebrow text-muted-foreground">Catégorie</p>
      <div className="mt-2 flex flex-wrap gap-2">{OFFER_CATEGORIES.map((c) => <button key={c} type="button" aria-pressed={form.category === c} onClick={() => setForm((f) => ({ ...f, category: c }))} className={`h-10 rounded-full px-4 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${form.category === c ? "bg-primary text-primary-foreground" : "border border-border hover:bg-primary/10"}`}>{c}</button>)}</div></div>
    {field("place", "Lieu")}
    {field("promo", "Avantage", 80)}
    {field("validity", "Validité", 80)}
    <div className="min-w-0">
      <p className="eyebrow text-muted-foreground">Photo</p>
      {preview && <div className="mt-2 h-40 overflow-hidden rounded-[18px]"><img src={preview} alt="Aperçu de la photo" className="h-full w-full object-cover" /></div>}
      <label htmlFor="of-photo" className="mt-2 flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-dashed border-border px-4 text-[14px] font-medium hover:bg-primary/10 focus-within:ring-2 focus-within:ring-ring">{preview ? "Changer la photo" : "Ajouter une photo"}<input id="of-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} disabled={busy} className="sr-only" /></label>
      <p className="mt-1.5 text-[12px] text-muted-foreground">JPEG, PNG ou WebP, 5 Mo au plus.</p>
    </div>
    {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
    <div className="grid gap-2">
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>{offer ? "Enregistrer" : "Publier l’offre"}</Button>
      {offer && <Button type="button" variant="outline" size="lg" className="w-full" onClick={onCancel}>Annuler</Button>}
    </div>
  </form>;
}
