import { toast } from "sonner";
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
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/membership/informations")({ head: () => ({ meta: [{ title: t("Vos informations — Art de Vie") }, { name: "description", content: t("Gérez vos coordonnées et préférences.") }, { property: "og:title", content: t("Vos informations — Art de Vie") }, { property: "og:description", content: t("Gérez vos coordonnées et préférences.") }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

function Page() {
  const queryClient = useQueryClient();
  const { data: profile = null } = useQuery(profileQuery);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => { setFullName(profile?.full_name ?? ""); setPhone(profile?.phone ?? ""); }, [profile]);

  async function update(values: { full_name?: string; phone?: string | null; notify_requests?: boolean; notify_messages?: boolean }): Promise<boolean> {
    if (!profile) return false;
    const { error } = await supabase.from("profiles").update(values).eq("id", profile.id);
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
    if (error) {
      toast.error(t("La modification n’a pas pu être enregistrée."));
      return false;
    }
    return true;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (fullName.trim().length < 2) { toast.error(t("Indiquez votre nom.")); return; }
    const saved = await update({ full_name: fullName.trim(), phone: phone.trim() || null });
    if (!saved) return;
    toast.success(t("Vos informations sont enregistrées."));
    setEditing(false);
  }

  return <AppShell nav={false}><div className="mx-auto max-w-3xl lg:max-w-none"><SubHeader title="Vos informations"/>
    <section className="rounded-[28px] bg-card p-5 sm:p-8 lg:mx-4 lg:p-10">
      {editing ? <form className="grid gap-5" onSubmit={save}>
        <div><Label htmlFor="fullName" className="eyebrow">{t("Nom")}</Label><Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} maxLength={80} autoComplete="name" className="mt-2"/></div>
        <div><Label htmlFor="phone" className="eyebrow">{t("Téléphone")}</Label><Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} autoComplete="tel" className="mt-2"/></div>
        <div className="flex flex-col gap-3 sm:flex-row"><PillAction type="submit" className="flex-1">{t("Enregistrer")}</PillAction><Button type="button" variant="outline" size="lg" onClick={() => setEditing(false)}>{t("Annuler")}</Button></div>
      </form> : <>
        <div className="divide-y divide-primary/10">
          <div className="py-4 first:pt-0"><span className="eyebrow">{t("Nom")}</span><p className="mt-1 text-sm font-medium lg:text-[24px]">{profile?.full_name || "—"}</p></div>
          <div className="py-4"><span className="eyebrow">{t("Email")}</span><p className="mt-1 text-sm font-medium lg:text-[24px]">{profile?.email || "—"}</p></div>
          <div className="py-4"><span className="eyebrow">{t("Téléphone")}</span><p className="mt-1 text-sm font-medium lg:text-[24px]">{profile?.phone || "—"}</p></div>
          <div className="py-4 last:pb-0"><span className="eyebrow">{t("Rôle")}</span><p className="mt-1 text-sm font-medium lg:text-[24px]">{t(profile?.role_label ?? "Membre")}</p></div>
          {profile?.plan === "Signature" && profile.concierge_referent && <div className="py-4 last:pb-0"><span className="eyebrow">{t("Concierge référent")}</span><p className="mt-1 text-sm font-medium lg:text-[24px]">{profile.concierge_referent}</p></div>}
        </div>
        <PillAction className="mt-7 w-full" onClick={() => setEditing(true)}>{t("Modifier mes informations")}</PillAction>
      </>}
    </section>
    <section className="mt-[22px] lg:mt-16 rounded-[28px] bg-panel p-5 sm:p-8 lg:mx-4 lg:p-10"><h2 className="v3-card-title text-[28px] text-primary lg:text-[clamp(38px,4.44vw,64px)]">{t("Notifications")}</h2>
      <div className="flex items-center gap-5 border-b border-primary/25 py-5"><div className="flex-1"><p id="notify-requests" className="text-sm font-medium">{t("Suivi de mes demandes")}</p><p className="mt-1 text-xs text-muted-foreground">{t("Recevoir chaque évolution importante")}</p></div><Switch aria-labelledby="notify-requests" checked={profile?.notify_requests ?? true} onCheckedChange={(v) => void update({ notify_requests: v })}/></div>
      <div className="flex items-center gap-5 py-5 pb-0"><div className="flex-1"><p id="notify-messages" className="text-sm font-medium">{t("Messages de notre conciergerie")}</p><p className="mt-1 text-xs text-muted-foreground">{t("Être averti des nouveaux messages")}</p></div><Switch aria-labelledby="notify-messages" checked={profile?.notify_messages ?? true} onCheckedChange={(v) => void update({ notify_messages: v })}/></div>
    </section>
  </div></AppShell>;
}
