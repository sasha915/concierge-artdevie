import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Invoice, Offer, Profile, Referral, RequestItem } from "@/data/art-de-vie";

export const requestsQuery = queryOptions({
  queryKey: ["requests"],
  queryFn: async (): Promise<RequestItem[]> => {
    const { data, error } = await supabase
      .from("requests")
      .select("id, category, status, title, description, scheduled_date, scheduled_time, guests, concierge, image_key, team_reply, team_reply_at")
      .order("scheduled_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as RequestItem[];
  },
});

export const offersQuery = queryOptions({
  queryKey: ["offers"],
  queryFn: async (): Promise<Offer[]> => {
    const { data, error } = await supabase
      .from("offers")
      .select("id, category, promo, title, partner, place, validity, image_key, image_url")
      .eq("published", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    const rows = data ?? [];
    const paths = rows.map((o) => o.image_url).filter((p): p is string => !!p);
    const signed: Record<string, string> = {};
    if (paths.length) {
      const { data: s } = await supabase.storage.from("offer-images").createSignedUrls(paths, 3600);
      for (const x of s ?? []) if (x.path && x.signedUrl) signed[x.path] = x.signedUrl;
    }
    return rows.map((o) => ({ ...o, image_url: o.image_url ? signed[o.image_url] ?? null : null })) as Offer[];
  },
});

export const invoicesQuery = queryOptions({
  queryKey: ["invoices"],
  queryFn: async (): Promise<Invoice[]> => {
    const { data, error } = await supabase
      .from("invoices")
      .select("id, number, kind, issued_on, amount_cents, status, request_id, service_cents, commission_cents, commission_rate")
      .order("issued_on", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Invoice[];
  },
});

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async (): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, phone, plan, role_label, concierge_referent, concierge_whatsapp, member_number, member_since, valid_until, notify_requests, notify_offers, notify_messages",
      )
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as Profile | null;
  },
});

export const referralsQuery = queryOptions({
  queryKey: ["referrals"],
  queryFn: async (): Promise<Referral[]> => {
    const { data, error } = await supabase
      .from("referrals")
      .select("id, full_name, email, status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Referral[];
  },
});

/** Demandes ayant au moins une notification non lue (changement de statut, réponse publiée). */
export const unreadRequestNotificationsQuery = queryOptions({
  queryKey: ["notifications", "unread"],
  queryFn: async (): Promise<string[]> => {
    const { data, error } = await supabase.from("member_notifications").select("request_id").is("read_at", null);
    if (error) return [];
    return [...new Set((data ?? []).flatMap((n) => (n.request_id ? [n.request_id] : [])))];
  },
  staleTime: 30_000,
});

export type MemberMessage = { id: string; author_role: "membre" | "équipe"; body: string; created_at: string };

/** Échanges d'une demande du membre (RLS : ses seules demandes). */
export const requestMessagesQuery = (requestId: string) => queryOptions({
  queryKey: ["requests", requestId, "messages"],
  queryFn: async (): Promise<MemberMessage[]> => {
    const { data, error } = await supabase
      .from("request_messages")
      .select("id, author_role, body, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as MemberMessage[];
  },
  refetchInterval: 30_000,
});

export type MemberFile = { id: string; name: string; mime: string; size: number; created_at: string };
export const requestFilesMemberQuery = (requestId: string) => queryOptions({
  queryKey: ["requests", requestId, "files"],
  queryFn: async (): Promise<MemberFile[]> => {
    const { data, error } = await supabase.from("request_files").select("id, name, mime, size, created_at").eq("request_id", requestId).order("created_at");
    if (error) throw error;
    return (data ?? []) as MemberFile[];
  },
});

export type MemberChange = { id: string; kind: string; body: string; status: string; created_at: string; decided_at: string | null };
export const requestChangesMemberQuery = (requestId: string) => queryOptions({
  queryKey: ["requests", requestId, "changes"],
  queryFn: async (): Promise<MemberChange[]> => {
    const { data, error } = await supabase.from("request_changes").select("id, kind, body, status, created_at, decided_at").eq("request_id", requestId).order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as MemberChange[];
  },
});

export type MemberReview = { rating: string; comment: string; created_at: string };
export const requestReviewMemberQuery = (requestId: string) => queryOptions({
  queryKey: ["requests", requestId, "review"],
  queryFn: async (): Promise<MemberReview | null> => {
    const { data, error } = await supabase.from("request_reviews").select("rating, comment, created_at").eq("request_id", requestId).maybeSingle();
    if (error) throw error;
    return (data ?? null) as MemberReview | null;
  },
});

export type MemberProposal = { id: string; status: string; created_at: string; options: Array<{ id: string; label: string; detail: string; estimate_cents: number | null; chosen: boolean; sort_order: number }> };
/** Dernière proposition de la demande, avec ses options (RLS : ses seules demandes). */
export const requestProposalMemberQuery = (requestId: string) => queryOptions({
  queryKey: ["requests", requestId, "proposal"],
  queryFn: async (): Promise<MemberProposal | null> => {
    const { data, error } = await supabase
      .from("request_proposals")
      .select("id, status, created_at, options:request_proposal_options(id, label, detail, estimate_cents, chosen, sort_order)")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const p = data as unknown as MemberProposal;
    return { ...p, options: [...(p.options ?? [])].sort((a, b) => a.sort_order - b.sort_order) };
  },
});

export type MemberRecurring = { id: string; category: string; title: string; rhythm: string; start_date: string | null; dates: string[]; end_date: string | null; paused: boolean; last_occurrence: string | null; scheduled_time: string | null };
export const recurringRequestsQuery = queryOptions({
  queryKey: ["recurring"],
  queryFn: async (): Promise<MemberRecurring[]> => {
    const { data, error } = await supabase
      .from("recurring_requests")
      .select("id, category, title, rhythm, start_date, dates, end_date, paused, last_occurrence, scheduled_time")
      .order("created_at");
    if (error) throw error;
    return (data ?? []) as MemberRecurring[];
  },
});

// ---- Lot 6.4 ----
export const welcomeQuery = queryOptions({
  queryKey: ["welcome"],
  queryFn: () => import("./messages.functions").then(({ getMyWelcome }) => getMyWelcome()),
  staleTime: 5 * 60_000,
});

/** Demandes du membre retenues pour le relevé : Confirmées ou Terminées, dotées d'un montant. */
export const statementSourceQuery = queryOptions({
  queryKey: ["statement-source"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("requests")
      .select("id, title, status, amount_cents, scheduled_date, created_at")
      .in("status", ["Confirmée", "Terminée"])
      .not("amount_cents", "is", null);
    if (error) throw error;
    return (data ?? []) as Array<{ id: string; title: string; status: string; amount_cents: number | null; scheduled_date: string | null; created_at: string }>;
  },
});
