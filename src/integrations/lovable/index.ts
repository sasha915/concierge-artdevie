// Connexion Google gérée par Lovable Cloud (broker /~oauth/initiate), puis session Supabase.
import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { supabase } from "../supabase/client";

const lovableAuth = createLovableAuth();

type SignInOptions = { redirect_uri?: string; extraParams?: Record<string, string> };

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google", opts?: SignInOptions) => {
      const result = await lovableAuth.signInWithOAuth(provider, {
        ...(opts?.redirect_uri ? { redirect_uri: opts.redirect_uri } : {}),
        extraParams: { ...opts?.extraParams },
      });
      if (result.redirected || result.error) return result;
      try {
        await supabase.auth.setSession(result.tokens);
      } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
      return result;
    },
  },
};
