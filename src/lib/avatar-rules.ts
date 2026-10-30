/** Photo de profil (30 octobre) : un JPEG carré, recadré et réduit dans le navigateur avant l'envoi. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_SIZE = 512;

/** Les premiers octets d'un JPEG (FF D8 FF) : le type annoncé par le navigateur ne suffit pas. */
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** Refus éventuel d'une photo reçue, ou null si elle est acceptable. */
export function avatarProblem(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return "Aucune photo reçue.";
  if (bytes.length > AVATAR_MAX_BYTES) return "La photo dépasse 2 Mo.";
  if (!isJpeg(bytes)) return "Ce fichier n’est pas une photo lisible.";
  return null;
}

/** Emplacement d'une photo : un dossier par compte, un nom horodaté (le lien change à chaque envoi). */
export function avatarPath(userId: string, now: number = Date.now()): string {
  return `${userId}/${now}.jpg`;
}

/** Carré central d'une image de largeur w et de hauteur h. */
export function squareCrop(w: number, h: number): { sx: number; sy: number; side: number } {
  const side = Math.min(w, h);
  return { sx: Math.round((w - side) / 2), sy: Math.round((h - side) / 2), side };
}
