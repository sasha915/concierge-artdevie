// Création d'une série récurrente à partir de sa première demande (lot 6.2). À n'importer que côté serveur.
import { z } from "zod";

export const recurrenceInput = z.object({
  rhythm: z.enum(["hebdomadaire", "mensuelle", "dates"]),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60).default([]),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});
export type RecurrenceInput = z.infer<typeof recurrenceInput>;

type FirstRequest = { id: string; user_id: string; category: string; title: string; description: string; guests: number | null; scheduled_date: string | null; scheduled_time: string | null; image_key: string };

/**
 * La première demande est celle que l'on vient de créer : la série commence à sa date
 * et les échéances suivantes seront créées sept jours avant leur date par la tâche quotidienne.
 */
export async function createRecurringRule(admin: any, first: FirstRequest, rec: RecurrenceInput, createdBy: string) {
  if (!first.scheduled_date) return { ok: false as const, reason: "Indiquez la date de la première échéance pour une demande récurrente." };
  const extra = [...new Set(rec.dates)].filter((d) => d > first.scheduled_date!).sort();
  if (rec.rhythm === "dates" && extra.length === 0) return { ok: false as const, reason: "Ajoutez au moins une date après la première." };
  if (rec.endDate && rec.endDate < first.scheduled_date) return { ok: false as const, reason: "La date de fin précède la première échéance." };
  const { data: rule, error } = await admin.from("recurring_requests").insert({
    user_id: first.user_id,
    category: first.category,
    title: first.title,
    description: first.description,
    guests: first.guests,
    scheduled_time: first.scheduled_time,
    rhythm: rec.rhythm,
    start_date: rec.rhythm === "dates" ? null : first.scheduled_date,
    dates: rec.rhythm === "dates" ? [first.scheduled_date, ...extra] : [],
    end_date: rec.endDate ?? null,
    last_occurrence: first.scheduled_date,
    image_key: first.image_key,
    created_by: createdBy,
  }).select("id").single();
  if (error || !rule) return { ok: false as const, reason: "La récurrence n’a pas pu être enregistrée." };
  const { error: linkError } = await admin.from("requests").update({ recurring_id: rule.id }).eq("id", first.id);
  if (linkError) {
    await admin.from("recurring_requests").delete().eq("id", rule.id);
    return { ok: false as const, reason: "La récurrence n’a pas pu être enregistrée." };
  }
  return { ok: true as const, id: rule.id as string };
}
