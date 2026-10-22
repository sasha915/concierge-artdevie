import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, Plus, Save, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/art-de-vie/admin-shell";
import { Title } from "@/components/art-de-vie/v3";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { replyTemplatesQuery } from "@/lib/admin-queries";
import { createReplyTemplate, updateReplyTemplate, deleteReplyTemplate, reorderReplyTemplates } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/reponses-types")({
  beforeLoad: ({ context }) => { if (context.teamRole !== "admin") throw redirect({ to: "/admin" }); },
  head: () => ({ meta: [
    { title: "Réponses types — Équipe Art de Vie" },
    { name: "description", content: "Rédaction et classement des réponses types de l’équipe Art de Vie." },
    { property: "og:title", content: "Réponses types — Équipe Art de Vie" },
    { property: "og:description", content: "Rédaction et classement des réponses types de l’équipe Art de Vie." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Page,
});

type Template = { id: string; label: string; body: string; sort_order: number };
type Result = { ok: boolean; reason?: string };

function Page() {
  const { data: templates = [], isLoading, isError } = useQuery(replyTemplatesQuery);
  const qc = useQueryClient();
  const create = useServerFn(createReplyTemplate);
  const update = useServerFn(updateReplyTemplate);
  const remove = useServerFn(deleteReplyTemplate);
  const reorder = useServerFn(reorderReplyTemplates);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newBody, setNewBody] = useState("");

  async function run(action: () => Promise<Result>, success: string) {
    setBusy(true); setNotice("");
    try {
      const result = await action();
      setNotice(result.ok ? success : result.reason || "L’opération a échoué.");
      if (result.ok) await qc.invalidateQueries({ queryKey: ["admin", "reply-templates"] });
      return result.ok;
    } catch { setNotice("L’opération a échoué."); return false; }
    finally { setBusy(false); }
  }

  function move(index: number, direction: number) {
    const ids = templates.map((t) => t.id);
    const current = ids[index]; const other = ids[index + direction];
    if (!current || !other) return;
    ids[index] = other; ids[index + direction] = current;
    void run(() => reorder({ data: { ids } }), "Ordre enregistré.");
  }

  return <AdminShell>
    <Button asChild variant="outline"><Link to="/admin/equipe"><ChevronLeft />Équipe</Link></Button>
    <p className="eyebrow team-mention mt-6">( Réponses types )</p>
    <Title italic="types." className="mt-3 text-primary lg:text-[72px]">Réponses </Title>
    <p role="status" aria-live="polite" className="mt-4 text-[14px]">{notice}</p>
    {isLoading ? <Skeleton className="mt-6 h-60 bg-primary/10" /> : isError ? <p role="alert" className="mt-6">Les réponses types n’ont pas pu être chargées.</p> : <ol className="mt-6 grid min-w-0 gap-4 lg:grid-cols-2">
      {templates.map((t, index) => <TemplateEditor key={`${t.id}:${t.label}:${t.body}`} template={t} busy={busy} first={index === 0} last={index === templates.length - 1} move={(direction) => move(index, direction)}
        save={(label, body) => run(() => update({ data: { id: t.id, label, body, sortOrder: t.sort_order } }), "Réponse type enregistrée.")}
        remove={() => { if (window.confirm(`Supprimer la réponse type « ${t.label} » ?`)) void run(() => remove({ data: { id: t.id } }), "Réponse type supprimée."); }} />)}
    </ol>}
    <form className="mt-8 border-t border-border pt-6" onSubmit={async (e) => {
      e.preventDefault();
      const ok = await run(() => create({ data: { label: newLabel, body: newBody, sortOrder: Math.max(0, ...templates.map((t) => t.sort_order)) + 1 } }), "Réponse type ajoutée.");
      if (ok) { setNewLabel(""); setNewBody(""); }
    }}>
      <h2 className="eyebrow team-mention">( Nouvelle réponse type )</h2>
      <div className="mt-4 grid gap-4 lg:max-w-2xl">
        <div><Label htmlFor="new-template-label">Libellé</Label><Input id="new-template-label" required maxLength={100} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="mt-2" /></div>
        <div><Label htmlFor="new-template-body">Corps</Label><Textarea id="new-template-body" maxLength={4000} rows={5} value={newBody} onChange={(e) => setNewBody(e.target.value)} className="mt-2" /></div>
        <Button type="submit" disabled={busy || isLoading || isError || !newLabel.trim()} className="justify-self-start"><Plus />Ajouter</Button>
      </div>
    </form>
  </AdminShell>;
}

function TemplateEditor({ template, busy, first, last, move, save, remove }: { template: Template; busy: boolean; first: boolean; last: boolean; move: (direction: number) => void; save: (label: string, body: string) => Promise<boolean>; remove: () => void }) {
  const [label, setLabel] = useState(template.label);
  const [body, setBody] = useState(template.body);
  return <li className="team-panel min-w-0 rounded-[24px] p-5">
    <form onSubmit={(e) => { e.preventDefault(); void save(label, body); }}>
      <Label htmlFor={`label-${template.id}`}>Libellé</Label><Input id={`label-${template.id}`} value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={100} className="mt-2" />
      <Label htmlFor={`body-${template.id}`} className="mt-4 block">Corps</Label><Textarea id={`body-${template.id}`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={6} className="mt-2" />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={busy || !label.trim()}><Save />Enregistrer</Button>
        <Button type="button" variant="outline" size="icon" title={`Monter ${template.label}`} aria-label={`Monter ${template.label}`} disabled={busy || first} onClick={() => move(-1)}><ArrowUp /></Button>
        <Button type="button" variant="outline" size="icon" title={`Descendre ${template.label}`} aria-label={`Descendre ${template.label}`} disabled={busy || last} onClick={() => move(1)}><ArrowDown /></Button>
        <Button type="button" variant="outline" size="icon" title={`Supprimer ${template.label}`} aria-label={`Supprimer ${template.label}`} disabled={busy} onClick={remove}><Trash2 /></Button>
      </div>
    </form>
  </li>;
}