# Lot 3.1 — Rôles Administrateur et Concierge

## État actuel (vérifié en base)

- Rôle `admin` : **Sasha Allio** (sasha.allio.test@gmail.com) et **Camille Duras** (test.membre.adv+1@gmail.com). Les deux ont aussi un profil complet de membre (formule Signature, numéro de membre).
- **edson@artdevie.co** existe mais n'a **aucun rôle** : il ne peut pas ouvrir /admin aujourd'hui.
- `app_role` = `admin`, `member` (la valeur `member` n'est attribuée à personne).
- Concierges écrits dans les demandes : « À attribuer », « Antoine L. », « Clara M. ». Aucun compte ne porte ces noms : la reprise de `concierge_id` laissera ces demandes sans identifiant (le nom reste affiché).
- Tout compte créé déclenche `handle_new_member`, qui crée un profil de membre (formule, numéro, validité, concierge Clara M.).
- Les fonctions de l'équipe passent toutes par `assertAdmin` (rôle admin + déverrouillage /admin-connexion). Le contrôle de route /admin et le lien « Administration » de Membership interrogent `has_role(..., 'admin')`.

## 1. Migrations (deux, dans cet ordre)

Postgres n'autorise pas l'utilisation d'une valeur d'enum dans la transaction qui l'ajoute ; on sépare donc.

**A — `add_concierge_role`** : `ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'concierge';` seulement. Ajouter une valeur ne modifie ni `has_role`, ni `user_roles`, ni les politiques existantes (elles comparent toutes à `'admin'`) : comportement inchangé pour les comptes actuels.

**B — `team_roles_and_concierge_id`** :
- `public.is_team(_user_id uuid) returns boolean` (security definer, `search_path = public`) : vrai si rôle admin ou concierge.
- Politiques RLS : les politiques « Admins lisent… » restent intactes. On ajoute des politiques SELECT pour `is_team` uniquement sur `requests` et `profiles` (lecture côté navigateur limitée à ce que les deux rôles voient). Factures, parrainages, `user_roles` : rien de plus pour les concierges. `request_notes` reste fermée (accès serveur seulement).
- `requests.concierge_id uuid null` (pas de clé étrangère vers auth.users, conformément à la convention du projet), index.
- Reprise : `concierge_id` = l'id du compte d'équipe dont `profiles.full_name` correspond exactement (sans casse ni espaces) au nom `concierge`, seulement si la correspondance est unique. Aujourd'hui : aucune ligne concernée.
- Garde-fou en base sur `user_roles` (déclencheur `protect_last_admin`, BEFORE DELETE/UPDATE) : refuse toute opération qui laisserait zéro administrateur. Appliqué aussi aux écritures avec la clé de service.
- Aucune modification de `handle_new_member`, `notify_concierge_on_request`, `enforce_member_request_defaults` (voir point 3 pour le déclencheur de notification).

`drizzle/schema.ts` reste vide.

## 2. Contrôle serveur — `src/lib/admin.functions.ts`

Deux helpers remplacent `assertAdmin` (même chaîne : rôle vérifié avec la session de l'appelant, puis déverrouillage, puis client admin) :
- `assertTeam(ctx)` : admin **ou** concierge. Renvoie aussi le rôle.
- `assertAdmin(ctx)` : admin seul.

| Fonction | Rôle requis |
|---|---|
| listAllRequests, getRequestDetail, updateRequestStatus, setRequestConcierge, setRequestReply | Équipe |
| listRequestNotes, addRequestNote, createRequestForMember, listRequestableMembers | Équipe |
| listTeamNames (devient liste {id, nom, rôle} des deux rôles) | Équipe |
| getDashboard | Équipe |
| listMembers, getMemberDetail, getMemberParrain | Équipe (consultation) |
| createMember, updateMember, setMemberDisabled, sendMemberInvite | Admin |
| listMemberPayments (et toute fonction Mollie appelée depuis l'équipe) | Admin |
| listReferrals, setReferralStatus, convertReferral | Admin |
| Nouvelles : listTeam, setTeamRole, inviteColleague | Admin |

- `getMemberDetail` pour un concierge : factures retirées de la réponse (pas seulement masquées).
- `setRequestConcierge` reçoit un id (ou « À attribuer ») et écrit `concierge_id` + `concierge` (nom du profil, lu côté serveur).
- `createRequestForMember` écrit aussi `concierge_id`.
- Le tableau de bord pour un concierge : mêmes chiffres ; aucune donnée de facturation n'y figure aujourd'hui.

## 3. Route /admin et déverrouillage, fichier par fichier

- `src/routes/_authenticated/admin.tsx` : `has_role admin` → `is_team`. Déverrouillage inchangé (même mot de passe, même cookie de deux heures). Le rôle (admin / concierge) est placé dans le contexte de route.
- Nouvelles sous-routes réservées aux admins (`admin.parrainages.tsx`, `admin.equipe.tsx`) : `beforeLoad` qui redirige un concierge vers /admin. Le serveur refuse de toute façon.
- `src/lib/admin-gate.*` : inchangés.
- `src/routes/_authenticated/admin-connexion.tsx` : inchangé (libellés « administration » conservés ; à trancher, point 4).
- `src/lib/admin-queries.ts` : `isAdminQuery` → `teamRoleQuery` (renvoie `admin`, `concierge` ou rien).
- `membership.index.tsx` : le lien « Administration » s'affiche pour les deux rôles (seul changement côté membre, logique d'affichage seulement).
- `admin-shell.tsx` : « Parrainages » et « Équipe » masqués pour un concierge.
- Écrans : boutons créer/modifier/désactiver/inviter un membre, bloc factures/paiements de la fiche membre, cachés pour un concierge.

## 4. Distinguer l'équipe des membres

Un helper serveur `teamIds()` (rôles admin + concierge) remplace `adminIds()` partout :
- Liste des membres : comptes d'équipe exclus.
- Tableau de bord « membres actifs » : hors comptes d'équipe.
- Sélecteur de membre de Nouvelle demande : comptes d'équipe exclus.
- Parrainages / conversion : un compte d'équipe ne peut pas être choisi comme membre converti.

## 5. Garantie « au moins un administrateur »

- Serveur (`setTeamRole`) : refuse si la cible est l'appelant (« vous ne pouvez pas modifier votre propre rôle ») et si l'opération retire le dernier administrateur.
- Base : déclencheur `protect_last_admin` (point 1), filet de sécurité indépendant de l'interface.
- Interface : bascule désactivée sur sa propre ligne.

## 6. /admin/equipe (administrateurs)

- Entrée « Équipe » dans la barre, après Parrainages.
- Liste : nom, e-mail, rôle (bascule Administrateur / Concierge), date d'ajout.
- Tableau « Ce que chaque rôle peut faire » (statique, reprend le tableau du point 2).
- « Inviter un colleague » : nom, e-mail, rôle. `inviteColleague` crée le compte comme `createMember`, attribue le rôle, envoie le lien comme `sendMemberInvite`. Si l'e-mail existe déjà comme membre : refus avec message (pas de promotion silencieuse).
- Retirer un rôle : la bascule propose aussi « Retirer de l'équipe » (le compte redevient un compte membre ordinaire). À confirmer, point 4.

**Profil d'un collègue invité** : le déclencheur crée un profil (nécessaire pour le nom affiché et les notes). Il reçoit un numéro de membre et une formule par défaut, mais : exclu de toutes les listes de membres, et n'a pas accès à l'espace membre comme membre réel (voir point à trancher). `inviteColleague` met `role_label` = « Équipe Art de Vie » et vide le concierge référent.

## Points à trancher

1. **Comptes admin actuels** : Sasha Allio et Camille Duras restent-ils administrateurs ? Faut-il donner un rôle à **edson@artdevie.co** (admin ou concierge) ? Ce sera une attribution manuelle après validation, pas dans la migration.
2. **Sasha et Camille ont aussi un profil de membre** (carte, demandes). Avec ce lot, ils sortent de la liste des membres et des compteurs. Acceptable, ou faut-il permettre qu'un compte soit à la fois membre et équipe ?
3. **Espace membre pour un collègue** : l'invité qui se connecte arrive sur l'accueil membre (avec une carte générée). Proposition : à la connexion, un compte d'équipe sans demande est redirigé vers /admin-connexion et la carte n'est pas affichée. Cela touche l'espace membre ; à valider, sinon on se limite à l'exclusion des listes.
4. **Textes du déverrouillage** : garder « Accès administration / mot de passe administrateur » ou passer à « Accès équipe » ? Le mot de passe reste commun aux deux rôles.
5. **Notifications WhatsApp** : `notify_concierge_on_request` continue d'utiliser `concierge_whatsapp` du profil membre (inchangé). Pas de lien avec `concierge_id` dans ce lot.
6. **« Retirer de l'équipe »** : à inclure, ou seulement bascule entre les deux rôles ?
7. **Reprise des noms** : « Antoine L. » et « Clara M. » ne correspondent à aucun compte. Les laisser sans identifiant (proposé), ou les renommer quand les comptes existeront ?

## Vérifications prévues

Build et typage complets ; en transaction annulée : un concierge lit les demandes mais ni factures ni parrainages, le déclencheur bloque la suppression du dernier admin ; appel des fonctions admin seul avec un compte concierge → refus ; captures /admin/equipe à 1280 et 390 px si une session est disponible.
