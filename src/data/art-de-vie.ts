import restaurant from "@/assets/offers/restaurant.jpg";
import spa from "@/assets/offers/spa.jpg";
import hotel from "@/assets/offers/hotel.jpg";

export type RequestStatus = "Nouvelle" | "En cours" | "Confirmée" | "Terminée" | "Annulée";

export type RequestItem = {
  id: string;
  category: string;
  status: RequestStatus;
  title: string;
  description: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  concierge: string;
  image_key: string;
};

export type Offer = {
  id: string;
  category: string;
  promo: string;
  title: string;
  partner: string;
  place: string;
  validity: string;
  image_key: string;
};

export type Invoice = {
  id: string;
  number: string;
  kind: string;
  issued_on: string;
  amount_cents: number;
  status: string;
};

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  plan: string;
  role_label: string;
  concierge_referent: string | null;
  concierge_whatsapp: string | null;
  member_number: string;
  member_since: string;
  valid_until: string;
  notify_requests: boolean;
  notify_offers: boolean;
  notify_messages: boolean;
};

const images: Record<string, string> = { restaurant, spa, hotel };

export function imageFor(key: string | null | undefined): string {
  return (key && images[key]) || restaurant;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Date à définir";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function formatMonth(iso: string | null | undefined): string {
  if (!iso) return "—";
  const label = new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatAmount(cents: number): string {
  return `${(cents / 100).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AV";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export type Referral = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
};
