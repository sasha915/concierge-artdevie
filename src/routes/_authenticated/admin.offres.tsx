import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus } from "lucide-react";
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
const select = "h-12 w-full rounded-2xl border border-border bg-card px-4 text-[15px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
      {editing === null && <Button type="button" variant="primary" size="lg" onClick={() => { setEditing("new"); setNotice(null); }}><Plus />Nouvelle offre</Button>}
    </header>

    {notice && <p role="status" className={`mb-5 rounded-2xl p-4 text-xs leading-5 text-primary ${notice.ok ? "bg-primary/10" : "border border-primary/25"}`}>{notice.text}</p>}

    {editing !== null && <OfferForm key={editing === "new" ? "new" : editing.id} offer={editing === "new" ? null : editing}
      onDone={async (text) => { setEditing(null); setNotice({ ok: true, text }); await qc.invalidateQueries({ queryKey: ["admin", "offers"] }); await qc.invalidateQueries({ queryKey: ["offers"] }); }}
      onCancel={() => setEditing(null)} />}

    {isLoading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-72 rounded-[28px] bg-primary/10" /><Skeleton className="h-72 rounded-[28px] bg-primary/10" /></div>
      : offers.length === 0 ? <p className="team-panel rounded-[28px] p-6 text-[14px] text-muted-foreground">Aucune offre pour le moment.</p>
      : <ul className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {offers.map((o) => {
          const src = o.preview_url ?? imageFor(o.image_key);
          return <li key={o.id} className={`team-panel flex min-w-0 flex-col overflow-hidden rounded-[28px] ${o.published ? "" : "opacity-70"}`}>
            <div className="relative h-44 bg-primary-deep">{src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center font-display text-2xl italic text-primary-foreground">{o.category}</span>}
              <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-medium ${o.published ? "bg-primary text-primary-foreground" : "border border-dashed border-border bg-card team-mention"}`}>{o.published ? "Publiée" : "Retirée"}</span></div>
            <div className="flex flex-1 flex-col p-5">
              <p className="eyebrow team-mention">{o.category}</p>
              <h2 className="mt-2 text-[20px] text-primary">{o.title}</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">{o.partner} · {o.place}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{o.promo} · {o.validity}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Button type="button" variant="outline" size="sm" onClick={() => { setEditing(o); setNotice(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Modifier</Button>
                <Button type="button" variant="outline" size="sm" disabled={busy === o.id} onClick={() => toggle(o)}>{o.published ? "Retirer" : "Republier"}</Button>
              </div>
            </div>
          </li>;
        })}
      </ul>}
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

  return <form onSubmit={submit} className="team-panel mb-6 grid min-w-0 gap-6 rounded-[28px] p-5 sm:p-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <h2 className="eyebrow team-mention sm:col-span-2">{offer ? "Modifier l’offre" : "Créer une offre"}</h2>
      {field("title", "Titre")}
      {field("partner", "Partenaire")}
      <div><Label htmlFor="of-category" className="eyebrow text-muted-foreground">Catégorie</Label>
        <select id="of-category" className={`${select} mt-2`} value={form.category} onChange={set("category")}>{OFFER_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
      {field("place", "Lieu")}
      {field("promo", "Avantage", 80)}
      {field("validity", "Validité", 80)}
      {error && <p role="alert" className="text-[13px] text-destructive sm:col-span-2">{error}</p>}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" variant="primary" size="lg" disabled={busy}>{offer ? "Enregistrer" : "Créer l’offre"}</Button>
        <Button type="button" variant="outline" size="lg" onClick={onCancel}>Annuler</Button>
      </div>
    </div>
    <div className="min-w-0">
      <Label htmlFor="of-photo" className="eyebrow text-muted-foreground">Photo (JPEG, PNG ou WebP, 5 Mo au plus)</Label>
      <div className="mt-2 h-56 overflow-hidden rounded-[20px] bg-primary-deep">{preview ? <img src={preview} alt="Aperçu de la photo" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center font-display text-2xl italic text-primary-foreground">{form.category}</span>}</div>
      <input id="of-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} disabled={busy} className="mt-3 block w-full text-[13px] file:mr-3 file:h-11 file:rounded-full file:border file:border-border file:bg-card file:px-4 file:text-primary" />
    </div>
  </form>;
}
