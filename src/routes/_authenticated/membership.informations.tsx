import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/art-de-vie/app-shell";
import { SubHeader } from "@/components/art-de-vie/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/adv-queries";
import { PillAction } from "@/components/art-de-vie/v3";

export const Route = createFileRoute("/_authenticated/membership/informations")({ head: () => ({ meta: [{ title: "Vos informations — Art de Vie" }, { name: "description", content: "Gérez vos coordonnées et préférences." }, { property: "og:title", content: "Vos informations — Art de Vie" }, { property: "og:description", content: "Gérez vos coordonnées et préférences." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

function Page() {
  const queryClient = useQueryClient();
  const { data: profile = null } = useQuery(profileQuery);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => { setFullName(profile?.full_name ?? ""); setPhone(profile?.phone ?? ""); }, [profile]);

  async function update(values: { full_name?: string; phone?: string | null; notify_requests?: boolean; notify_offers?: boolean; notify_messages?: boolean }) {
    if (!profile) return;
    await supabase.from("profiles").update(values).eq("id", profile.id);
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await update({ full_name: fullName, phone: phone || null });
    setEditing(false);
  }

  return <AppShell nav={false}><div className="mx-auto max-w-3xl"><SubHeader title="Vos informations"/>
    <section className="rounded-[28px] bg-card p-5 sm:p-8">
      {editing ? <form className="grid gap-5" onSubmit={save}>
        <div><Label htmlFor="fullName" className="eyebrow">Nom</Label><Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-2"/></div>
        <div><Label htmlFor="phone" className="eyebrow">Téléphone</Label><Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-2"/></div>
        <div className="flex flex-col gap-3 sm:flex-row"><PillAction type="submit" className="flex-1">Enregistrer</PillAction><Button type="button" variant="outline" size="lg" onClick={() => setEditing(false)}>Annuler</Button></div>
      </form> : <>
        <div className="divide-y divide-primary/10">
          <div className="py-4 first:pt-0"><span className="eyebrow">Nom</span><p className="mt-1 text-sm font-medium">{profile?.full_name || "—"}</p></div>
          <div className="py-4"><span className="eyebrow">Email</span><p className="mt-1 text-sm font-medium">{profile?.email || "—"}</p></div>
          <div className="py-4"><span className="eyebrow">Téléphone</span><p className="mt-1 text-sm font-medium">{profile?.phone || "—"}</p></div>
          <div className="py-4 last:pb-0"><span className="eyebrow">Rôle</span><p className="mt-1 text-sm font-medium">{profile?.role_label ?? "Membre"}</p></div>
          {profile?.plan === "Signature" && profile.concierge_referent && <div className="py-4 last:pb-0"><span className="eyebrow">Concierge référent</span><p className="mt-1 text-sm font-medium">{profile.concierge_referent}</p></div>}
        </div>
        <PillAction className="mt-7 w-full" onClick={() => setEditing(true)}>Modifier mes informations</PillAction>
      </>}
    </section>
    <section className="mt-[22px] rounded-[28px] bg-primary/10 p-5 sm:p-8"><h2 className="v3-card-title text-[28px] text-primary">Notifications</h2>
      <div className="flex items-center gap-5 border-b border-primary/25 py-5"><div className="flex-1"><p className="text-sm font-medium">Suivi de mes demandes</p><p className="mt-1 text-xs text-muted-foreground">Recevoir chaque évolution importante</p></div><Switch checked={profile?.notify_requests ?? true} onCheckedChange={(v) => update({ notify_requests: v })}/></div>
      <div className="flex items-center gap-5 border-b border-primary/25 py-5"><div className="flex-1"><p className="text-sm font-medium">Nouvelles offres</p><p className="mt-1 text-xs text-muted-foreground">Découvrir nos privilèges partenaires</p></div><Switch checked={profile?.notify_offers ?? false} onCheckedChange={(v) => update({ notify_offers: v })}/></div>
      <div className="flex items-center gap-5 py-5 pb-0"><div className="flex-1"><p className="text-sm font-medium">Messages du concierge</p><p className="mt-1 text-xs text-muted-foreground">Être averti des nouveaux messages</p></div><Switch checked={profile?.notify_messages ?? true} onCheckedChange={(v) => update({ notify_messages: v })}/></div>
    </section>
  </div></AppShell>;
}
