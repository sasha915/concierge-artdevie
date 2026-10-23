import { describe, expect, test } from "bun:test";
import { exactLike, canInviteDelegate, delegateStatusLabel, firstName, isDelegatePathAllowed, MAX_DELEGATES, openDelegates } from "./delegate-rules";

describe("proches autorisés", () => {
  test("trois places au plus, les accès retirés ou refusés libèrent la place", () => {
    const rows = [{ status: "actif" }, { status: "en_attente" }, { status: "retire" }, { status: "refuse" }];
    expect(openDelegates(rows)).toHaveLength(2);
    expect(canInviteDelegate(rows)).toBe(true);
    expect(canInviteDelegate([...rows, { status: "actif" }])).toBe(false);
    expect(MAX_DELEGATES).toBe(3);
  });

  test("un proche n'atteint que l'accueil et ses demandes", () => {
    for (const ok of ["/", "/demandes", "/demandes/", "/demandes/nouvelle", "/demandes/7fa25d8a-9148-4dec-891f-e95ef7a61564"]) {
      expect(isDelegatePathAllowed(ok)).toBe(true);
    }
    for (const ko of [
      "/membership",
      "/membership/factures",
      "/membership/proches",
      "/offres",
      "/bienvenue",
      "/admin",
      "/demandes/recurrentes",
      "/demandes/7fa25d8a-9148-4dec-891f-e95ef7a61564/proposition",
      "/demandes/7fa25d8a-9148-4dec-891f-e95ef7a61564/modifier",
    ]) {
      expect(isDelegatePathAllowed(ko)).toBe(false);
    }
  });

  test("libellés et prénom", () => {
    expect(delegateStatusLabel("en_attente")).toBe("En attente de confirmation");
    expect(delegateStatusLabel("inconnu")).toBe("inconnu");
    expect(firstName("  Léa Martin ")).toBe("Léa");
    expect(firstName(null)).toBe("");
  });

  test("comparaison d'adresses sans joker", () => {
    expect(exactLike("jean_dupont@exemple.com")).toBe("jean\\_dupont@exemple.com");
    expect(exactLike("a%b\\c")).toBe("a\\%b\\\\c");
  });
});

import { trustedOrigin, DEFAULT_APP_ORIGIN } from "./app-origin";
describe("adresse de l'application", () => {
  test("seuls nos domaines sont retenus", () => {
    expect(trustedOrigin("https://app.artdevie.co")).toBe("https://app.artdevie.co");
    expect(trustedOrigin("https://id-preview--x.lovable.app")).toBe("https://id-preview--x.lovable.app");
    expect(trustedOrigin("https://artdevie.co.evil.com")).toBe(DEFAULT_APP_ORIGIN);
    expect(trustedOrigin("https://evil.com")).toBe(DEFAULT_APP_ORIGIN);
    expect(trustedOrigin(null)).toBe(DEFAULT_APP_ORIGIN);
  });
});
