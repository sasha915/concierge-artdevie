import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { initials } from "@/data/art-de-vie";
import { getMyAvatar, removeMyAvatar, uploadMyAvatar } from "@/lib/avatar.functions";
import { toAvatarJpeg } from "@/lib/image-resize";
import { t } from "@/lib/i18n";

const STALE = 30 * 60 * 1000; // les liens signés valent une heure

/** Photo du compte connecté (membre ou équipe). */
export function useMyAvatar(enabled = true): string | null {
  const fetchMine = useServerFn(getMyAvatar);
  const { data } = useQuery({ queryKey: ["avatar", "me"], queryFn: () => fetchMine(), staleTime: STALE, enabled });
  return data?.url ?? null;
}

/**
 * Pastille ronde : la photo si elle existe, sinon les initiales.
 * La taille, la bordure et les couleurs viennent de className ; l'image remplit le cercle.
 */
export function Avatar({ url, name, className = "" }: { url: string | null | undefined; name: string; className?: string }) {
  const [broken, setBroken] = useState<string | null>(null);
  const showImage = !!url && broken !== url;
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`}>
      {showImage ? <img src={url!} alt="" className="absolute inset-0 size-full object-cover" onError={() => setBroken(url!)} /> : initials(name)}
    </span>
  );
}

/** Choix, remplacement et retrait d'une photo. `upload` reçoit le JPEG déjà recadré et réduit. */
export function AvatarEditor({ url, name, upload, remove, labels }: {
  url: string | null;
  name: string;
  upload: (file: File) => Promise<{ ok: boolean; reason?: string }>;
  remove: () => Promise<{ ok: boolean; reason?: string }>;
  labels?: { add: string; change: string; remove: string; hint: string; saved: string; removed: string; failed: string };
}) {
  const l = labels ?? {
    add: t("Ajouter une photo"),
    change: t("Changer la photo"),
    remove: t("Retirer"),
    hint: t("La photo est recadrée au carré."),
    saved: t("Votre photo est enregistrée."),
    removed: t("Votre photo est retirée."),
    failed: t("Cette image n’a pas pu être lue. Essayez une autre photo."),
  };
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      let blob: Blob;
      try { blob = await toAvatarJpeg(file); } catch { toast.error(l.failed); return; }
      const res = await upload(new File([blob], "photo.jpg", { type: "image/jpeg" }));
      if (res.ok) toast.success(l.saved); else toast.error(t(res.reason ?? "L’envoi de la photo a échoué."));
    } catch {
      toast.error(t("L’envoi de la photo a échoué."));
    } finally {
      setBusy(false);
    }
  }

  async function drop() {
    setBusy(true);
    try {
      const res = await remove();
      if (res.ok) toast.success(l.removed); else toast.error(t(res.reason ?? "La photo n’a pas pu être retirée."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar url={url} name={name} className="size-20 border border-primary/20 bg-primary/10 font-display text-xl text-primary" />
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="inline-flex h-10 items-center rounded-full border border-primary/30 px-4 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50">
            {busy ? t("Envoi…") : url ? l.change : l.add}
          </button>
          {url && <button type="button" disabled={busy} onClick={() => void drop()} className="inline-flex h-10 items-center rounded-full px-4 text-sm text-muted-foreground hover:bg-primary/10 disabled:opacity-50">{l.remove}</button>}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{l.hint}</p>
      </div>
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void pick(e)} />
    </div>
  );
}

/** Éditeur de la photo du compte connecté. */
export function MyAvatarEditor({ name }: { name: string }) {
  const queryClient = useQueryClient();
  const url = useMyAvatar();
  const send = useServerFn(uploadMyAvatar);
  const drop = useServerFn(removeMyAvatar);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["avatar"] });
  return (
    <AvatarEditor
      url={url}
      name={name}
      upload={async (file) => { const fd = new FormData(); fd.append("file", file); const r = await send({ data: fd }); await refresh(); return r; }}
      remove={async () => { const r = await drop(); await refresh(); return r; }}
    />
  );
}
