import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { delegationQuery, profileQuery } from "@/lib/adv-queries";
import type { DelegationInfo } from "@/lib/delegates.functions";

/**
 * Lot 5.4 : délégation du compte connecté. Un compte de proche n'a pas de profil membre ;
 * la délégation n'est donc cherchée que lorsque le profil est absent.
 */
export function useDelegation(): { delegation: DelegationInfo | null; pending: boolean } {
  const { data: profile, isSuccess } = useQuery(profileQuery);
  const candidate = isSuccess && profile === null;
  const { data, isPending } = useQuery({ ...delegationQuery, enabled: candidate });
  return { delegation: candidate ? data ?? null : null, pending: !isSuccess || (candidate && isPending) };
}


export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/connexion", replace: true });
  };
}

