import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Invoice, Offer, Profile, RequestItem } from "@/data/art-de-vie";

export const requestsQuery = queryOptions({
  queryKey: ["requests"],
  queryFn: async (): Promise<RequestItem[]> => {
    const { data, error } = await supabase
      .from("requests")
      .select("id, category, status, title, description, scheduled_date, scheduled_time, concierge, image_key")
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
      .select("id, category, promo, title, partner, place, validity, image_key")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Offer[];
  },
});

export const invoicesQuery = queryOptions({
  queryKey: ["invoices"],
  queryFn: async (): Promise<Invoice[]> => {
    const { data, error } = await supabase
      .from("invoices")
      .select("id, number, kind, issued_on, amount_cents, status")
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
        "id, full_name, email, phone, plan, role_label, member_number, member_since, valid_until, notify_requests, notify_offers, notify_messages",
      )
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as Profile | null;
  },
});
