import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAvatarUrls } from "@/lib/admin.functions";

/** Photos des comptes affichés dans l'espace équipe, par identifiant (liens signés d'une heure). */
export function useAvatarUrls(ids: ReadonlyArray<string | null | undefined>): Record<string, string> {
  const fetchUrls = useServerFn(getAvatarUrls);
  const list = [...new Set(ids.filter((x): x is string => !!x))].sort();
  const { data } = useQuery({
    queryKey: ["avatar", "team", list],
    queryFn: () => fetchUrls({ data: { ids: list } }),
    enabled: list.length > 0,
    staleTime: 30 * 60 * 1000,
  });
  return data ?? {};
}
