import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { EN } from "./i18n-en";
import { setLang, t, tPair, translate } from "./i18n";
import { CHANGE_KINDS, REVIEW_RATINGS } from "./request-actions-rules";
import { DEFAULT_REVIEW_TITLE, REVIEW_TITLES, RHYTHMS, proposalBanner } from "./planning-rules";
import { WELCOME_STEPS } from "./member-rules";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [p] : [];
  });
}

const STR = String.raw`"((?:[^"\\]|\\.)*)"`;
const literalKeys = new Set<string>();
for (const file of files(join(process.cwd(), "src"))) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(new RegExp(String.raw`\b(?:t|tr)\(` + STR, "g"))) literalKeys.add(JSON.parse(`"${m[1]}"`));
  for (const m of src.matchAll(new RegExp(String.raw`\btranslate\([^,]+,\s*` + STR, "g"))) literalKeys.add(JSON.parse(`"${m[1]}"`));
  for (const m of src.matchAll(new RegExp(String.raw`\btPair\(` + STR + String.raw`,\s*` + STR, "g"))) literalKeys.add(`${JSON.parse(`"${m[1]}"`)}|${JSON.parse(`"${m[2]}"`)}`);
}

/** Valeurs traduites à l'affichage (statuts, catégories, libellés des règles…). */
const dynamicKeys = [
  "Nouvelle", "En cours", "Confirmée", "Terminée", "Annulée",
  "Tables", "Séjours", "Transferts", "Soins", "Sur mesure",
  "Restaurant", "Bien-être", "Culture", "Voyage",
  "Toutes", "Abonnement", "Prestations", "Payée", "En attente", "Échouée",
  "Invitation envoyée", "Contacté", "Membre",
  "Accueil", "Demandes", "Offres", "Membership", "Historique",
  "Bonjour", "Bonsoir", "Bienvenue", "Bon retour", "Heureux de vous revoir", "Ravi de vous retrouver",
  "Mes |demandes.", "Historique des |demandes.", "Les |offres.",
  "Suivez l’avancement de chaque demande en temps réel.", "Retrouvez les demandes que nous avons accompagnées.", "Privilèges négociés par votre conciergerie.",
  "Mes factures", "Votre conciergerie vous propose", "Mon relevé", "Mes demandes récurrentes", "Vos informations", "Modifier ma demande", "Mes préférences", "Parrainer un membre", "Langue de l’application",
  "PDF", "Image", "Fichier",
  ...RHYTHMS.map((r) => r.label),
  ...CHANGE_KINDS.map((k) => k.label),
  ...REVIEW_RATINGS,
  ...WELCOME_STEPS.flatMap((s) => [s.eyebrow, s.question, ...s.options]),
  ...[1, 2, 3, 4, 5, 6].map((n) => proposalBanner(n)),
  ...[...Object.values(REVIEW_TITLES), DEFAULT_REVIEW_TITLE].map(([a, b]) => `${a}|${b}`),
  "Chaque {day}",
];

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

describe("dictionnaire anglais", () => {
  test("chaque texte du code a sa traduction", () => {
    expect(literalKeys.size).toBeGreaterThan(250);
    const missing = [...literalKeys, ...dynamicKeys].filter((k) => EN[k] === undefined);
    expect(missing).toEqual([]);
  });
  test("mêmes variables en français et en anglais", () => {
    const wrong = Object.entries(EN).filter(([fr, en]) => placeholders(fr) !== placeholders(en));
    expect(wrong).toEqual([]);
  });
  test("titres en deux parties : une seule barre", () => {
    const wrong = Object.entries(EN).filter(([fr, en]) => fr.includes("|") && en.split("|").length !== 2);
    expect(wrong).toEqual([]);
  });
});

describe("traduction", () => {
  test("français par défaut, anglais sur demande, variables remplies", () => {
    setLang("fr");
    expect(t("Mes demandes")).toBe("Mes demandes");
    expect(translate("en", "Votre demande « {title} » est confirmée.", { title: "Dîner" })).toBe("Your request “Dîner” is confirmed.");
    setLang("en");
    expect(t("Confirmée")).toBe("Confirmed");
    expect(tPair("Mes ", "demandes.")).toEqual(["My ", "requests."]);
    expect(t("Texte saisi par le membre")).toBe("Texte saisi par le membre");
    setLang("fr");
  });
});
