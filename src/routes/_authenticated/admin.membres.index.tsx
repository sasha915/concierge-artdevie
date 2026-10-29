import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Mail, Search, UserMinus, UserPlus } from "lucide-react";
import { AdminShell } from "@/components/art-de-vie/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/art-de-vie/cards";
import { Title } from "@/components/art-de-vie/v3";
import { membersQuery, type AdminMember } from "@/lib/admin-queries";
import { convertReferral, createMember, sendMemberInvite, setMemberDisabled } from "@/lib/admin.functions";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/membres/")({ validateSearch: (search: Record<string, unknown>): { nom?: string | undefined; email?: string | undefined; parrainage?: string | undefined } => ({ nom: typeof search["nom"] === "string" ? search["nom"] : undefined, email: typeof search["email"] === "string" ? search["email"] : undefined, parrainage: typeof search["parrainage"] === "string" ? search["parrainage"] : undefined }), head: () => ({ meta: [{ title: "Membres — Équipe Art de Vie" }, { name: "description", content: "Gérez les membres invités de la conciergerie Art de Vie." }, { property: "og:title", content: "Membres — Équipe Art de Vie" }, { property: "og:description", content: "Gérez les membres invités de la conciergerie Art de Vie." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

function Page() {
  const queryClient = useQueryClient();
  const { data: members = [], isLoading } = useQuery(membersQuery);
  const create = useServerFn(createMember);
  const invite = useServerFn(sendMemberInvite);
  const toggle = useServerFn(setMemberDisabled);
  const navigate = useNavigate();
  const convert = useServerFn(convertReferral);
  const prefill = Route.useSearch();
  const { teamRole } = Route.useRouteContext();
  const isAdmin = teamRole === "admin";

  useEffect(() => {
    if (!prefill.nom && !prefill.email) return;
    setForm((f) => ({ ...f, fullName: prefill.nom ?? f.fullName, email: prefill.email ?? f.email }));
    setOpen(true);
  }, [prefill.nom, prefill.email]);



  const [search, setSearch] = useState("");
  const [, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", plan: "Signature", conciergeReferent: "", conciergeWhatsapp: "" });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => `${m.full_name} ${m.email ?? ""}`.toLowerCase().includes(q));
  }, [members, search]);

  function set(key: keyof typeof form, value: string) { setForm((f) => ({ ...f, [key]: value })); }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    try {
      const r = await create({ data: { ...form, plan: form.plan as "Essentiel" | "Signature" } });
      if (!r.ok) { setError(r.reason); return; }
      if (prefill.parrainage) {
        await convert({ data: { referralId: prefill.parrainage, memberId: r.id } });
        await queryClient.invalidateQueries({ queryKey: ["admin", "referrals"] });
        await navigate({ to: "/admin/membres"});
      }
      setNotice(`${form.fullName} a été ajouté. Envoyez-lui son email d’invitation.`);
      setForm({ fullName: "", email: "", phone: "", plan: "Signature", conciergeReferent: "", conciergeWhatsapp: "" });
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin", "members"] });
    } catch { setError("La création a échoué. Réessayez."); } finally { setBusy(false); }
  }

  async function sendInvite(m: AdminMember) {
    if (!m.email) return;
    setError(null); setNotice(null);
    const r = await invite({ data: { email: m.email } });
    if (r.ok) setNotice(`Email d’invitation envoyé à ${m.email}.`);
    else setError(r.reason);
  }

  async function toggleDisabled(m: AdminMember) {
    if (!m.disabled_at && !window.confirm(`Désactiver ${m.full_name || "ce membre"} ? Son prélèvement automatique sera arrêté et il ne pourra plus se connecter.`)) return;
    setError(null); setNotice(null);
    const r = await toggle({ data: { id: m.id, disabled: !m.disabled_at } });
    if (!r.ok) { setError(r.reason); return; }
    setNotice(m.disabled_at ? `${m.full_name} a été réactivé.` : `${m.full_name} a été désactivé.`);
    await queryClient.invalidateQueries({ queryKey: ["admin", "members"] });
  }




  return <AdminShell>
    <header className="mb-[22px] flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow team-mention">Membres</p>
        <Title italic="membres." className="mt-3 text-primary lg:text-[clamp(52px,6vw,88px)]">Les </Title>
        <p className="mt-2 text-[13px] text-muted-foreground">Gérez les membres invités, leurs demandes et leurs factures.</p>
      </div>
    </header>

    <div className={`grid min-w-0 gap-6 ${isAdmin ? "lg:grid-cols-12" : ""}`}>
    <div className={`min-w-0 ${isAdmin ? "lg:col-span-8" : ""}`}>
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un membre…" className="h-12 rounded-full border-0 bg-card pl-11" />
    </div>

    {notice && <p className="mt-4 rounded-2xl bg-primary/10 p-4 text-xs leading-5 text-primary">{notice}</p>}
    {error && <p className="mt-4 rounded-2xl border border-primary/25 p-4 text-xs leading-5 text-primary">{error}</p>}


    <section className="mt-[22px]">
      {isLoading ? <div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-44 rounded-card bg-primary/10"/><Skeleton className="h-44 rounded-card bg-primary/10"/><Skeleton className="h-44 rounded-card bg-primary/10"/></div>
        : filtered.length === 0 ? <EmptyState>Aucun membre ne correspond à cette recherche.</EmptyState>
        : <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((m) => <article key={m.id} className={`rounded-card p-5 ${m.disabled_at ? "border border-dashed border-border" : "team-panel"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[24px] text-primary">{m.full_name || "Sans nom"}</p>
                  <p className="mt-1 truncate text-[12px] text-muted-foreground">{m.email}</p>
                </div>
                <span className={m.disabled_at ? "shrink-0 rounded-full border border-primary/25 px-3 py-1 text-[10px] font-semibold text-muted-foreground" : "shrink-0 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary"}>{m.disabled_at ? "Désactivé" : "Actif"}</span>
              </div>
              <p className="mt-3 text-[12px] text-muted-foreground">{m.plan} · {m.member_number}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">{m.requests_count} demande{m.requests_count > 1 ? "s" : ""}{isAdmin ? ` · ${m.invoices_count} facture${m.invoices_count > 1 ? "s" : ""}` : ""}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-primary/10 pt-4">
                {isAdmin && <><Button variant="soft" size="sm" onClick={() => sendInvite(m)}><Mail />Invitation</Button>
                <Button variant="outline" size="sm" onClick={() => toggleDisabled(m)}>{m.disabled_at ? <UserPlus /> : <UserMinus />}{m.disabled_at ? "Réactiver" : "Désactiver"}</Button></>}
                <Button asChild variant="soft" size="sm" className="ml-auto"><Link to="/admin/membres/$memberId" params={{ memberId: m.id }}>Fiche<ChevronRight /></Link></Button>
              </div>
            </article>)}
          </div>}
    </section>
    </div>
    {isAdmin && <div className="min-w-0 lg:col-span-4">
<form id="nouveau-membre" className="team-beige rounded-[28px] p-6 lg:sticky lg:top-6" onSubmit={submitCreate}>
      <p className="eyebrow">Nouveau membre</p>
      <Title as="h2" italic="membre." className="mt-3 text-[40px] leading-none">Créer un </Title>
      <div className="mt-6 grid gap-5">
        <Field label="Nom complet"><Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} required maxLength={80} /></Field>
        <Field label="Adresse email"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required maxLength={160} /></Field>
        <Field label="Téléphone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={40} /></Field>
        <Field label="Formule"><PlanSelect value={form.plan} onChange={(v) => set("plan", v)} /></Field>
        {form.plan === "Signature" ? <>
          <Field label="Concierge attribué"><Input value={form.conciergeReferent} onChange={(e) => set("conciergeReferent", e.target.value)} required maxLength={60} /></Field>
          <Field label="WhatsApp du concierge attribué"><Input type="tel" value={form.conciergeWhatsapp} onChange={(e) => set("conciergeWhatsapp", e.target.value)} required pattern="[+0-9 ().-]{8,30}" maxLength={30} /></Field>
        </> : <p className="text-[12px] leading-5 text-muted-foreground">Hors Signature, le concierge est choisi à chaque demande.</p>}
      </div>
      <Button type="submit" variant="primary" size="lg" className="mt-6 w-full" disabled={busy}>{busy ? "Création…" : "Créer le membre"}</Button>
    </form>
    </div>}
    </div>
  </AdminShell>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><Label className="eyebrow text-muted-foreground">{label}</Label><div className="mt-2 min-w-0">{children}</div></div>;
}

export function PlanSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <div className="flex gap-2">
    <Button type="button" variant={value === "Essentiel" ? "primary" : "outline"} onClick={() => onChange("Essentiel")}>Essentiel</Button>
    <Button type="button" variant={value === "Signature" ? "primary" : "outline"} onClick={() => onChange("Signature")}>Signature</Button>
  </div>;
}
