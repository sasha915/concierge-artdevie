import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listMembers, getMemberDetail, getMemberParrain, listMemberPayments, listAllRequests, getRequestDetail, listTeamNames, listReferrals, listTeam, listOffersAdmin, listRequestEvents, listReplyTemplates, getRequestBilling, getMemberPreferences, listRequestMessages, listRequestFiles, listRequestChanges, getRequestReview, listMemberReviews, type TeamRole } from "@/lib/admin.functions";
import type { Invoice, RequestItem } from "@/data/art-de-vie";

export type AdminMember = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  plan: string;
  role_label: string;
  member_number: string;
  member_since: string;
  valid_until: string;
  disabled_at: string | null;
  concierge_referent: string | null;
  concierge_whatsapp: string | null;
  requests_count: number;
  invoices_count: number;
};

export const isAdminQuery = queryOptions({
  queryKey: ["is-admin"],
  queryFn: async (): Promise<boolean> => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return false;
    const { data, error } = await supabase.rpc("is_team", { _user_id: auth.user.id });
    if (error) return false;
    return data === true;
  },
});

export const membersQuery = queryOptions({
  queryKey: ["admin", "members"],
  queryFn: async (): Promise<AdminMember[]> => (await listMembers()) as AdminMember[],
});

export const memberDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["admin", "member", id],
    queryFn: async (): Promise<{ profile: AdminMember | null; requests: RequestItem[]; invoices: Invoice[] }> =>
      (await getMemberDetail({ data: { id } })) as { profile: AdminMember | null; requests: RequestItem[]; invoices: Invoice[] },
  });

export const memberPaymentsQuery = (id: string) =>
  queryOptions({
    queryKey: ["admin", "member", id, "payments"],
    queryFn: () => listMemberPayments({ data: { id } }),
  });

export type AdminRequest = RequestItem & {
  user_id: string;
  created_at: string;
  team_reply: string | null;
  team_reply_at: string | null;
  member_name: string;
  member_email?: string | null;
  member_plan?: string | null;
  pending_change?: boolean;
};

export const allRequestsQuery = queryOptions({
  queryKey: ["admin", "requests"],
  queryFn: async (): Promise<AdminRequest[]> => (await listAllRequests()) as unknown as AdminRequest[],
});

export const requestDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["admin", "request", id],
    queryFn: async () =>
      (await getRequestDetail({ data: { id } })) as { request: Omit<AdminRequest, "member_name"> | null; member: (Omit<AdminMember, "requests_count" | "invoices_count" | "concierge_whatsapp">) | null },
  });

export type TeamMemberOption = { id: string; name: string; role: TeamRole };
export const teamNamesQuery = queryOptions({
  queryKey: ["admin", "team-names"],
  queryFn: async (): Promise<TeamMemberOption[]> => await listTeamNames(),
});

/** Rôle d'équipe du compte connecté (admin, concierge ou null). Lit uniquement ses propres rôles. */
export const teamRoleQuery = queryOptions({
  queryKey: ["team-role"],
  queryFn: async (): Promise<TeamRole | null> => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id);
    if (error) return null;
    const roles = (data ?? []).map((r) => r.role as string);
    return roles.includes("admin") ? "admin" : roles.includes("concierge") ? "concierge" : null;
  },
});

export const teamQuery = queryOptions({
  queryKey: ["admin", "team"],
  queryFn: () => listTeam(),
});

export type AdminReferral = {
  id: string;
  inviter_id: string;
  inviter_name: string;
  full_name: string;
  email: string;
  message: string | null;
  status: string;
  converted_member_id: string | null;
  created_at: string;
};

export const adminReferralsQuery = queryOptions({
  queryKey: ["admin", "referrals"],
  queryFn: async (): Promise<AdminReferral[]> => (await listReferrals()) as AdminReferral[],
});

export const memberParrainQuery = (id: string) =>
  queryOptions({
    queryKey: ["admin", "member", id, "parrain"],
    queryFn: async (): Promise<{ id: string; full_name: string } | null> => (await getMemberParrain({ data: { id } })) as { id: string; full_name: string } | null,
  });

export const adminOffersQuery = queryOptions({
  queryKey: ["admin", "offers"],
  queryFn: () => listOffersAdmin(),
});

export const requestEventsQuery = (requestId: string) => queryOptions({
  queryKey: ["admin", "request", requestId, "events"],
  queryFn: () => listRequestEvents({ data: { requestId } }),
});

export const replyTemplatesQuery = queryOptions({
  queryKey: ["admin", "reply-templates"],
  queryFn: () => listReplyTemplates(),
});

export const teamSelfQuery = queryOptions({
  queryKey: ["admin", "self"],
  queryFn: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("Le compte connecté n’a pas pu être chargé.");
    return data.user.id;
  },
});

export const requestBillingQuery = (id: string) => queryOptions({
  queryKey: ["admin", "request", id, "billing"],
  queryFn: () => getRequestBilling({ data: { id } }),
});

export const memberPreferencesQuery = (id: string) => queryOptions({
  queryKey: ["admin", "member", id, "preferences"],
  queryFn: () => getMemberPreferences({ data: { id } }),
});

export const requestMessagesAdminQuery = (requestId: string) => queryOptions({
  queryKey: ["admin", "request", requestId, "messages"],
  queryFn: () => listRequestMessages({ data: { requestId } }),
  refetchInterval: 30_000,
});

export const requestFilesQuery = (requestId: string) => queryOptions({
  queryKey: ["admin", "request", requestId, "files"],
  queryFn: () => listRequestFiles({ data: { requestId } }),
});

export const requestChangesQuery = (requestId: string) => queryOptions({
  queryKey: ["admin", "request", requestId, "changes"],
  queryFn: () => listRequestChanges({ data: { requestId } }),
});

export const requestReviewQuery = (requestId: string) => queryOptions({
  queryKey: ["admin", "request", requestId, "review"],
  queryFn: () => getRequestReview({ data: { requestId } }),
});

export const memberReviewsQuery = (memberId: string) => queryOptions({
  queryKey: ["admin", "member", memberId, "reviews"],
  queryFn: () => listMemberReviews({ data: { memberId } }),
});
