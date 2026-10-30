import { describe, expect, test } from "bun:test";
import { avatarPath, avatarProblem, isJpeg, squareCrop, AVATAR_MAX_BYTES } from "./avatar-rules";

describe("photo de profil", () => {
  test("reconnaît un JPEG à ses premiers octets", () => {
    expect(isJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe(true);
    expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0]))).toBe(false);
  });
  test("refuse un fichier vide, trop lourd ou qui n'est pas une photo", () => {
    expect(avatarProblem(new Uint8Array())).toBe("Aucune photo reçue.");
    const big = new Uint8Array(AVATAR_MAX_BYTES + 1); big.set([0xff, 0xd8, 0xff]);
    expect(avatarProblem(big)).toBe("La photo dépasse 2 Mo.");
    expect(avatarProblem(new Uint8Array([1, 2, 3, 4]))).toBe("Ce fichier n’est pas une photo lisible.");
    expect(avatarProblem(new Uint8Array([0xff, 0xd8, 0xff, 0xdb]))).toBeNull();
  });
  test("emplacement conforme à la contrainte de la base", () => {
    const p = avatarPath("3f2a6c1e-1b2c-4d5e-8f90-a1b2c3d4e5f6", 1793325600000);
    expect(p).toMatch(/^[0-9a-f-]{36}\/[0-9]+\.jpg$/);
  });
  test("recadrage carré au centre", () => {
    expect(squareCrop(1200, 800)).toEqual({ sx: 200, sy: 0, side: 800 });
    expect(squareCrop(600, 900)).toEqual({ sx: 0, sy: 150, side: 600 });
  });
});
