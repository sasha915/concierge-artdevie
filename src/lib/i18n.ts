/**
 * Lot 6.5 : langue de l'espace membre.
 * Le texte français sert de clé ; le dictionnaire anglais (i18n-en.ts) lui associe sa traduction.
 * L'interface équipe (/admin) reste toujours en français.
 */
import { useSyncExternalStore } from "react";
import { EN } from "./i18n-en";

export type Lang = "fr" | "en";
export const LANG_STORAGE_KEY = "adv-lang";

let current: Lang = "fr";
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch { /* stockage indisponible */ }
  if (typeof document !== "undefined") document.documentElement.lang = lang;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Langue courante ; le composant se met à jour quand elle change. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, () => "fr");
}

/** Langue avant connexion : dernier choix connu, sinon celle du navigateur. */
export function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch { /* stockage indisponible */ }
  if (typeof navigator !== "undefined" && /^en\b/i.test(navigator.language)) return "en";
  return "fr";
}

type Vars = Record<string, string | number>;

function fill(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/**
 * Typographie française : espace fine insécable avant ; : ! ? et à l'intérieur des guillemets.
 * Appliquée au texte du dictionnaire avant insertion des valeurs (le contenu saisi n'est pas retouché).
 */
export function frenchTypography(text: string): string {
  return text
    .replace(/ ([;:!?»])/g, "\u202F$1")
    .replace(/« /g, "«\u202F");
}

/** Traduction dans une langue donnée (relevé de l'équipe, notifications). */
export function translate(lang: Lang, fr: string, vars?: Vars): string {
  if (lang === "fr") return fill(frenchTypography(fr), vars);
  const en = EN[fr];
  if (en === undefined && import.meta.env?.DEV) console.warn(`[i18n] traduction manquante : ${fr}`);
  return fill(en ?? fr, vars);
}

/** Traduction dans la langue courante. */
export function t(fr: string, vars?: Vars): string {
  return translate(current, fr, vars);
}

export function localeOf(lang: Lang): string {
  return lang === "en" ? "en-GB" : "fr-FR";
}

export function locale(): string {
  return localeOf(current);
}

/**
 * Titre en deux parties (romain + italique) : l'ordre des mots change d'une langue à l'autre,
 * la paire est donc traduite d'un bloc. Clé « début|fin ».
 */
export function tPair(head: string, tail: string): [string, string] {
  if (current === "fr") return [frenchTypography(head), frenchTypography(tail)];
  const en = EN[`${head}|${tail}`];
  if (en === undefined) {
    if (import.meta.env?.DEV) console.warn(`[i18n] traduction manquante : ${head}|${tail}`);
    return [head, tail];
  }
  const [a = "", b = ""] = en.split("|");
  return [a, b];
}
