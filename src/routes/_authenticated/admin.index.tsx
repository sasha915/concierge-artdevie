import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ChevronRight, Lock, Mail, Plus, Search, UserMinus, UserPlus } from "lucide-react";
import { AdminShell } from "@/components/art-de-vie/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/art-de-vie/cards";
import { membersQuery, type AdminMember } from "@/lib/admin-queries";
import { createMember, sendMemberInvite, setMemberDisabled } from "@/lib/admin.functions";
import { lockAdmin } from "@/lib/admin-gate.functions";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/")({ head: () => ({ meta: [{ title: "Administration des membres — Art de Vie" }, { name: "description", content: "Gérez les membres invités de la conciergerie Art de Vie." }, { property: "og:title", content: "Administration des membres — Art de Vie" }, { property: "og:description", content: "Gérez les membres invités de la conciergerie Art de Vie." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

function Page() {
  const queryClient = useQueryClient();
  const { data: members = [], isLoading } = useQuery(membersQuery);
  const create = useServerFn(createMember);
  const invite = useServerFn(sendMemberInvite);
  const toggle = useServerFn(setMemberDisabled);
  const lock = useServerFn(lockAdmin);
  const navigate = useNavigate();


  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
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
    setError(null); setNotice(null);
    const r = await toggle({ data: { id: m.id, disabled: !m.disabled_at } });
    if (!r.ok) { setError(r.reason); return; }
    setNotice(m.disabled_at ? `${m.full_name} a été réactivé.` : `${m.full_name} a été désactivé.`);
    await queryClient.invalidateQueries({ queryKey: ["admin", "members"] });
  }

  async function lockSession() {
    await lock({});
    queryClient.removeQueries({ queryKey: ["admin"] });
    await navigate({ to: "/admin-connexion", replace: true });
  }



  return <AdminShell>
    <header className="mb-[22px] flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-[32px] font-semibold leading-tight text-primary">Administration</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">Gérez les membres invités, leurs demandes et leurs factures.</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={lockSession}><Lock />Verrouiller</Button>
        <Button variant="primary" onClick={() => setOpen((v) => !v)}><Plus />Nouveau membre</Button>
      </div>
    </header>

    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un membre…" className="h-12 rounded-full border-0 bg-card pl-11" />
    </div>

    {notice && <p className="mt-4 rounded-2xl bg-primary/10 p-4 text-xs leading-5 text-primary">{notice}</p>}
    {error && <p className="mt-4 rounded-2xl border border-primary/25 p-4 text-xs leading-5 text-primary">{error}</p>}

    {open && <form className="mt-[22px] rounded-card bg-card p-5 sm:p-7" onSubmit={submitCreate}>
      <h2 className="font-display text-[22px] font-medium text-primary">Créer un membre</h2>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Field label="Nom complet"><Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} required maxLength={80} placeholder="Ex. Élise Marchand" /></Field>
        <Field label="Adresse email"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required maxLength={160} placeholder="elise@exemple.com" /></Field>
        <Field label="Téléphone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={40} placeholder="+33 6 12 34 56 78" /></Field>
        <Field label="Formule"><PlanSelect value={form.plan} onChange={(v) => set("plan", v)} /></Field>
        <Field label="Concierge référent"><Input value={form.conciergeReferent} onChange={(e) => set("conciergeReferent", e.target.value)} maxLength={60} placeholder="Clara M." /></Field>
        <Field label="WhatsApp du concierge"><Input value={form.conciergeWhatsapp} onChange={(e) => set("conciergeWhatsapp", e.target.value)} maxLength={30} placeholder="+33612345678" /></Field>
      </div>
      <Button type="submit" variant="primary" size="lg" className="mt-5 w-full lg:w-auto" disabled={busy}>{busy ? "Création…" : "Créer le membre"}</Button>
    </form>}

    <section className="mt-[22px]">
      {isLoading ? <EmptyState>Chargement des membres…</EmptyState>
        : filtered.length === 0 ? <EmptyState>Aucun membre ne correspond à cette recherche.</EmptyState>
        : <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {filtered.map((m) => <article key={m.id} className="rounded-card bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-[21px] font-medium text-primary">{m.full_name || "Sans nom"}</p>
                  <p className="mt-1 truncate text-[12px] text-muted-foreground">{m.email}</p>
                </div>
                <span className={m.disabled_at ? "shrink-0 rounded-full border border-primary/25 px-3 py-1 text-[10px] font-semibold text-muted-foreground" : "shrink-0 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary"}>{m.disabled_at ? "Désactivé" : "Actif"}</span>
              </div>
              <p className="mt-3 text-[12px] text-muted-foreground">{m.plan} · {m.member_number}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">{m.requests_count} demande(s) · {m.invoices_count} facture(s)</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-primary/10 pt-4">
                <Button variant="soft" size="sm" onClick={() => sendInvite(m)}><Mail />Invitation</Button>
                <Button variant="outline" size="sm" onClick={() => toggleDisabled(m)}>{m.disabled_at ? <UserPlus /> : <UserMinus />}{m.disabled_at ? "Réactiver" : "Désactiver"}</Button>
                <Button asChild variant="soft" size="sm" className="ml-auto"><Link to="/admin/$memberId" params={{ memberId: m.id }}>Fiche<ChevronRight /></Link></Button>
              </div>
            </article>)}
          </div>}
    </section>
  </AdminShell>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="eyebrow">{label}</Label><div className="mt-2">{children}</div></div>;
}

export function PlanSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <div className="flex gap-2">
    <Button type="button" variant={value === "Essentiel" ? "primary" : "outline"} onClick={() => onChange("Essentiel")}>Essentiel</Button>
    <Button type="button" variant={value === "Signature" ? "primary" : "outline"} onClick={() => onChange("Signature")}>Signature</Button>
  </div>;
}
