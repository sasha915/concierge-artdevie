import restaurant from "@/assets/offers/restaurant.jpg";
import spa from "@/assets/offers/spa.jpg";
import hotel from "@/assets/offers/hotel.jpg";

export type RequestStatus = "Nouvelle" | "En cours" | "Confirmée" | "Terminée" | "Annulée";
export type RequestItem = { id: string; category: string; status: RequestStatus; title: string; description: string; date: string; time: string; concierge: string; image: string };
export type Offer = { id: string; category: string; promo: string; title: string; partner: string; place: string; validity: string; image: string };

export const requests: RequestItem[] = [
  { id: "girafe", category: "Tables", status: "Confirmée", title: "Dîner à Girafe", description: "Une table avec vue pour célébrer votre anniversaire, dans un espace calme et privilégié.", date: "Samedi 26 septembre", time: "20h30", concierge: "Clara M.", image: restaurant },
  { id: "provence", category: "Séjours", status: "En cours", title: "Escapade en Provence", description: "Une maison confidentielle entre vignes, avec chef privé et transfert depuis Paris.", date: "Du 9 au 12 octobre", time: "Départ à 9h00", concierge: "Antoine L.", image: hotel },
  { id: "massage", category: "Soins", status: "Nouvelle", title: "Rituel bien-être à domicile", description: "Un soin relaxant de 90 minutes et une sélection d’huiles sur mesure.", date: "Vendredi 2 octobre", time: "18h00", concierge: "À attribuer", image: spa },
  { id: "opera", category: "Culture", status: "Terminée", title: "Soirée à l’Opéra Garnier", description: "Deux places en loge et dîner après la représentation.", date: "Jeudi 10 septembre", time: "19h30", concierge: "Clara M.", image: restaurant },
  { id: "riviera", category: "Transferts", status: "Annulée", title: "Transfert vers la Riviera", description: "Transfert privé depuis l’aéroport de Nice jusqu’à Saint-Jean-Cap-Ferrat.", date: "Lundi 31 août", time: "14h15", concierge: "Antoine L.", image: hotel },
];

export const offers: Offer[] = [
  { id: "terrasse", category: "Restaurant", promo: "Table signature", title: "Un dîner au-dessus de Paris", partner: "Maison Bellefeuille", place: "Paris, 16e", validity: "Valable jusqu’au 30 novembre", image: restaurant },
  { id: "rituel", category: "Bien-être", promo: "-25%", title: "Le rituel minéral", partner: "Atelier Serein", place: "Paris, 8e", validity: "Valable jusqu’au 15 décembre", image: spa },
  { id: "rivage", category: "Voyage", promo: "Upgrade offert", title: "Une parenthèse sur la Riviera", partner: "Casa del Mare", place: "Cap d’Antibes", validity: "Valable jusqu’au 31 octobre", image: hotel },
  { id: "collection", category: "Culture", promo: "Visite privée", title: "Les collections après la fermeture", partner: "Cercle des Arts", place: "Paris, 1er", validity: "Sur réservation", image: restaurant },
];

export const invoices = [
  { number: "ADV-2026-0912", type: "Abonnement", date: "12 septembre 2026", amount: "1 490 €", status: "Payée" },
  { number: "ADV-2026-0831", type: "Prestations", date: "31 août 2026", amount: "680 €", status: "Payée" },
  { number: "ADV-2026-0812", type: "Abonnement", date: "12 août 2026", amount: "1 490 €", status: "Payée" },
];
