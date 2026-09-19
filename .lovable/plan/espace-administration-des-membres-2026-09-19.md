# Espace administration des membres

Une page réservée à l'équipe Art de Vie pour gérer les membres invités, avec la même
identité visuelle que le reste de l'app (beige, violet, Playfair, cartes arrondies).

## Ce que l'admin pourra faire

- **Voir la liste des membres** : nom, email, formule, numéro de membre, statut (actif / désactivé),
  nombre de demandes. Recherche par nom ou email.
- **Créer un membre** : nom, email, téléphone, formule (Essentiel / Signature), concierge référent.
  Le compte est créé immédiatement côté backend.
- **Envoyer l'email d'invitation** : un bouton par membre qui envoie (ou renvoie) l'email
  contenant le lien privé de première connexion.
- **Modifier un membre** : nom, téléphone, formule, rôle affiché, concierge référent et son WhatsApp.
- **Désactiver / réactiver un membre** : le membre désactivé ne peut plus se connecter,
  ses données restent intactes.
- **Fiche membre** : ses demandes (avec statut) et ses factures (montant, date, statut),
  en lecture seule.

## Accès

- Nouvelle page `/admin` (et `/admin/membres/<id>` pour la fiche), réservée aux comptes
  ayant le rôle administrateur.
- Un membre sans ce rôle ne voit ni le lien ni la page.
- Le lien « Administration » n'apparaît dans la navigation que pour les administrateurs.
- Votre compte (sasha.allio.test@gmail.com) reçoit le rôle administrateur.

## Détails techniques

- Nouvelle table `user_roles` (enum `app_role`) + fonction `has_role()` SECURITY DEFINER,
  jamais de rôle stocké sur `profiles` (sécurité).
- Colonne `profiles.disabled_at` (timestamptz nullable) pour la désactivation ;
  policy SELECT/UPDATE admin sur `profiles`, `requests`, `invoices` via `has_role`.
- Toutes les opérations privilégiées passent par des `createServerFn` avec
  `requireSupabaseAuth` + vérification `has_role(userId,'admin')` avant chargement de
  `supabaseAdmin` : `listMembers`, `createMember`, `updateMember`, `setMemberDisabled`,
  `sendMemberInvite`, `getMemberDetail`.
- Création de compte : Auth Admin API (`createUser` avec email confirmé + metadata) ;
  invitation : `inviteUserByEmail` avec redirection vers `/reset-password`,
  comme sur l'écran Parrainer.
- Désactivation : `updateUserById` avec `ban_duration` + `disabled_at` sur le profil ;
  réactivation remet les deux à zéro.
- Gate de route : `src/routes/_authenticated/admin/route.tsx` qui redirige vers `/`
  si le compte n'est pas administrateur.
- Responsive : liste en cartes empilées sur mobile, en tableau à partir de `lg:`.
