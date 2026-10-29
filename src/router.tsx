import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    // Session équipe refermée (2 h, ou « Verrouiller » ailleurs) : retour à l'accès équipe au lieu d'un échec muet.
    queryCache: new QueryCache({
      onError: (error) => {
        if (typeof window !== "undefined" && /AdminLocked/.test(String((error as Error)?.message ?? error)) && !window.location.pathname.startsWith("/admin-connexion")) {
          window.location.assign("/admin-connexion");
        }
      },
    }),
    // Données réutilisées 20 s d'une page à l'autre : moins de rechargements (barre de l'équipe, listes).
    defaultOptions: { queries: { staleTime: 20_000 } },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
