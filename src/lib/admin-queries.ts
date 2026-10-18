import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listMembers, getMemberDetail, getMemberParrain, listMemberPayments, listAllRequests, getRequestDetail, listTeamNames, listReferrals } from "@/lib/admin.functions";
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
    const { data, error } = await supabase.rpc("has_role", { _user_id: auth.user.id, _role: "admin" });
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
};

export const allRequestsQuery = queryOptions({
  queryKey: ["admin", "requests"],
  queryFn: async (): Promise<AdminRequest[]> => (await listAllRequests()) as AdminRequest[],
});

export const requestDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["admin", "request", id],
    queryFn: async () =>
      (await getRequestDetail({ data: { id } })) as { request: Omit<AdminRequest, "member_name"> | null; member: (Omit<AdminMember, "requests_count" | "invoices_count" | "concierge_whatsapp">) | null },
  });

export const teamNamesQuery = queryOptions({
  queryKey: ["admin", "team-names"],
  queryFn: async (): Promise<string[]> => (await listTeamNames()) as string[],
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
