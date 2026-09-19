import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listMembers, getMemberDetail } from "@/lib/admin.functions";
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
