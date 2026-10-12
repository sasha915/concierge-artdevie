# Lot 1.1 — Données et sécurité des demandes (aucun écran)

## Constat vérifié
- Côté membre, la seule écriture sur `requests` est la création (`demandes.nouvelle.tsx`, insert). Aucune modification ni suppression dans le code membre ou les requêtes partagées. Les deux politiques peuvent être supprimées sans effet visible.
- Les fonctions admin existantes lisent `requests` via la clé de service uniquement.

## Migration `0008_requests_team_reply_and_lockdown` (drizzle/migrations)
1. `ALTER TABLE public.requests ADD COLUMN team_reply text, ADD COLUMN team_reply_at timestamptz;` (nullables, non bloquant).
2. `DROP POLICY "Membres modifient leurs demandes"` et `DROP POLICY "Membres suppriment leurs demandes"`. Suppression de politique uniquement, aucune donnée touchée.
3. Révocation cohérente : `REVOKE UPDATE, DELETE ON public.requests FROM authenticated` (la clé de service garde tous les droits).
4. Mécanisme de valeurs imposées à la création : déclencheur `BEFORE INSERT` `public.enforce_member_request_defaults()` (SECURITY INVOKER) :
   - s'applique seulement si le rôle courant est `authenticated` ou `anon` (`current_setting('request.jwt.claim.role', true)` / `current_user`) ;
   - force `status = 'Nouvelle'`, `concierge = 'À attribuer'`, `team_reply = NULL`, `team_reply_at = NULL` ;
   - les écritures `service_role` (fonctions équipe, webhooks) passent sans contrainte.
   - Le déclencheur existant `notify_concierge_on_request` (AFTER INSERT) reçoit donc les valeurs corrigées.
- Politique d'insertion existante (`auth.uid() = user_id`) et lecture membre inchangées. Les nouvelles colonnes restent lisibles par le membre sur ses propres demandes (nécessaire au lot 1.3).
- Types Supabase régénérés automatiquement ; `drizzle/schema.ts` non modifié.

## Fonctions serveur (src/lib/admin.functions.ts)
Toutes : `requireSupabaseAuth` + `assertAdmin` (rôle + déverrouillage) + `supabaseAdmin` + zod.
- `listAllRequests()` : toutes les demandes, jointes au profil (nom, e-mail, formule), tri par date de création décroissante.
- `getRequestDetail({ id })` : la demande (y compris team_reply, team_reply_at) et le profil du membre ; `null` si absente.
- `updateRequestStatus({ id, status })` : status validé contre l'enum existant.
- `setRequestConcierge({ id, concierge })` : texte 1–60 caractères, « À attribuer » admis.
- `setRequestReply({ id, reply })` : texte ≤ 4000 ; vide → team_reply et team_reply_at à NULL, sinon team_reply_at = now().
- `listTeamNames()` : `full_name` des profils ayant le rôle admin, non vides, triés.
- `getDashboard()` : demandes ouvertes (Nouvelle/En cours/Confirmée), à attribuer, membres actifs (`disabled_at` nul, hors comptes admin — point à trancher ci-dessous), dernière demande (titre, created_at), liste « À traiter » (Nouvelle, plus ancienne d'abord), cinq prochaines prestations (En cours/Confirmée, date ≥ aujourd'hui, tri croissant).
- Aucune notification au membre.

## Vérification
- Test SQL en lecture : politiques et déclencheur présents.
- Avec le profil de test (Camille Duras) : création d'une demande en envoyant status « Confirmée » et concierge « X » → la ligne revient « Nouvelle » / « À attribuer » ; tentative de modification ou suppression via l'API → refusée.
- Appel des nouvelles fonctions en tant qu'admin déverrouillé ; refus pour un membre non admin.
- Petit test unitaire pour la règle « réponse vide efface team_reply et team_reply_at ».
- Build et typage.

## Points à trancher
1. « Membres actifs » : compter tous les profils non désactivés, ou exclure les comptes ayant le rôle admin ? Proposition : exclure les admins.
2. Demande de test créée pendant la vérification : la supprimer ensuite (proposé) ou la conserver.

## Hors périmètre
Aucun écran, aucune route, aucun changement côté membre, Mollie, WhatsApp, parrainage, accès /admin.
