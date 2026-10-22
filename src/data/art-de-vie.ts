import restaurant from "@/assets/offers/restaurant.jpg";
import spa from "@/assets/offers/spa.jpg";
import hotel from "@/assets/offers/hotel.jpg";
import bassin from "@/assets/v3/bassin.jpg.asset.json";
import entreeDeNuit from "@/assets/v3/entree-de-nuit.jpg.asset.json";
import placeVendome from "@/assets/v3/place-vendome.jpg.asset.json";
import villageCotier from "@/assets/v3/village-cotier.jpg.asset.json";
import { getLang, locale, t } from "@/lib/i18n";

export type RequestStatus = "Nouvelle" | "En cours" | "Confirmée" | "Terminée" | "Annulée";

export type RequestItem = {
  id: string;
  category: string;
  status: RequestStatus;
  title: string;
  description: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  guests: number | null;
  concierge: string;
  concierge_id?: string | null;
  image_key: string;
  team_reply?: string | null;
  team_reply_at?: string | null;
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
  image_url?: string | null;
};

export type Invoice = {
  id: string;
  number: string;
  kind: string;
  issued_on: string;
  amount_cents: number;
  status: string;
  request_id?: string | null;
  service_cents?: number | null;
  commission_cents?: number | null;
  commission_rate?: number | null;
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
  language?: "fr" | "en";
};

const images: Record<string, string> = {
  restaurant,
  spa,
  hotel,
  "place-vendome": placeVendome.url,
  "village-cotier": villageCotier.url,
  "entree-de-nuit": entreeDeNuit.url,
  bassin: bassin.url,
};

export function imageFor(key: string | null | undefined): string | undefined {
  return key ? images[key] : undefined;
}

/** Photo d'une offre : photo envoyée par l'équipe, sinon photo par code. */
export function offerImage(offer: Pick<Offer, "image_key" | "image_url">): string | undefined {
  return offer.image_url || imageFor(offer.image_key);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return t("Date à définir");
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });
}

/** « 20:30:00 » → « 20 h 30 » en français, « 20:30 » en anglais. */
export function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  const hhmm = time.slice(0, 5);
  return getLang() === "en" ? hhmm : hhmm.replace(":", " h ");
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric" });
}

export function formatMonth(iso: string | null | undefined): string {
  if (!iso) return "—";
  const label = new Date(`${iso}T12:00:00`).toLocaleDateString(locale(), { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatAmount(cents: number): string {
  if (getLang() === "en") {
    return (cents / 100).toLocaleString("en-GB", { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 });
  }
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })} €`;
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
