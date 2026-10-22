# Art De Vie App

Construis l'application membre "Art de Vie" — une app de conciergerie privée haut de gamme (React, Tailwind, Supabase pour l'auth et les données). Voici le système de design exact à respecter, puis les écrans à construire.

## Système de design

**Couleurs** (jamais d'autre teinte que celles-ci, sauf mention explicite) :
- Beige (fond) : #EEEDE3
- Beige surface de carte, légèrement détaché du fond : #FBFAF5
- Violet (texte, accent principal, dégradés) : #503975
- Violet clair : #4F3F6D
- Violet profond : #3B2D55
- Gris-violet (texte secondaire) : #6E6486
- Or (Club Privé uniquement — jamais en texte, seulement en filet 1px ou icône décorative) : #B08D57

**Typographie** : Playfair Display (serif) pour tous les titres, les gros chiffres (prix, statistiques) et les noms propres de lieux. Poids 400 pour les accroches éditoriales et les noms de lieux ; poids 600 pour les titres de page (32px). Work Sans (sans-serif) pour tout le reste : corps de texte, boutons, libellés. Libellés et catégories en petites capitales, tracking large (0.13em), 11-13px.

**Formes** : angle vif (0px) réservé aux photographies plein cadre uniquement. Cartes de contenu, blocs de champs et feuilles modales en rayon généreux (16 à 24px). Boutons, filtres, badges de statut et barre de navigation en pilule complète (rayon 999px). Ne jamais mélanger : une photo n'est jamais arrondie, un bouton n'est jamais ad angle vif.

**Ombres** : aucune ombre sur les cartes de contenu (la séparation se fait par la teinte de fond, #FBFAF5 sur #EEEDE3, jamais par une ombre portée). Une ombre légère est réservée aux éléments qui se détachent réellement du fond : la navigation flottante, les boutons principaux, la carte de membre.

**Photographies** : chaque photo (ou son emplacement en attente) reçoit un voile violet permanent à 32% d'opacité (rgba(80,57,117,0.32)) posé dessus, sans lien avec le survol — c'est un filtre constant, pas une interaction.

**Badges de statut d'une demande** : jamais de couleur sémantique (pas de vert/bleu/rouge). Une échelle de valeur dans la seule famille violette : Nouvelle = violet très clair (fond rgba(80,57,117,0.10), texte #503975) ; En cours = violet moyen #4F3F6D, texte beige ; Confirmée = violet plein #503975, texte beige ; Terminée = violet profond #3B2D55, texte beige (le plus soutenu) ; Annulée = transparent avec filet 1px violet à 25%, texte #6E6486 (volontairement hors de l'échelle, pas la plus pâle).

**Icônes de navigation** : contour fin (stroke 1.5) à l'état inactif, remplies (fill plein) à l'état actif.

## Écrans à construire

1. **Connexion** — logo centré, titre "Bon retour", champs email/mot de passe, bouton "Se connecter" en pilule violette pleine, lien "Mot de passe oublié ?", puis "Pas encore membre ? Demander une invitation" (pas d'inscription libre — c'est une conciergerie sur invitation).

2. **Accueil** (onglet 1) — en-tête avec logo et bouton notifications. Bloc héros en dégradé violet (#503975 → #3B2D55) avec accroche éditoriale en Playfair ("Votre conciergerie, à votre rythme."), deux boutons ("Nouvelle demande", "Voir les offres"), et un petit aperçu de la carte de membre qui déborde du bloc. Trois tuiles de statistiques (nombre de demandes actives, nombre d'offres en vedette, délai de réponse moyen). Un encart "Prochaine demande" (titre, date, badge de statut). Une liste "Offres en vedette" avec deux ou trois cartes photo.

3. **Mes demandes** (onglet 2, icône enveloppe/inbox) — titre de page, bouton "+ Nouvelle demande" en pilule pleine, filtres par statut en pilules horizontales (Toutes / Nouvelle / En cours / Confirmée / Terminée / Annulée). Liste de cartes : catégorie en petites capitales, badge de statut à droite, titre de la demande en Playfair, description tronquée sur deux lignes, date souhaitée en pied de carte.

4. **Nouvelle demande** — écran de création, atteint par un bouton, avec une croix pour fermer (pas une flèche retour, ce n'est pas un onglet). Catégories en pilules (Tables / Séjours / Transferts / Soins). Bloc de champs : prestation souhaitée, date souhaitée, heure et couverts (deux colonnes), et un champ "Précisions pour votre concierge" en texte libre. Bouton "Envoyer la demande". En dessous, une section "Idées du mois" avec des cartes d'inspiration.

5. **Fiche d'une demande** — écran de détail atteint depuis une carte de la liste. Photo plein cadre en en-tête (angle vif, voile violet permanent, logo et bouton retour en verre dépoli dessus), nom du lieu en Playfair. En dessous : message de confirmation ("Votre demande a bien été transmise..."), détails (date, heure, concierge assigné), boutons "Faire une nouvelle demande" et "Modifier ma demande".

6. **Offres** (onglet 3, icône marque-page/ruban) — catalogue de privilèges partenaires négociés. Filtres par catégorie en pilules (Toutes / Restaurant / Bien-être / Voyage / Culture...). Cartes en une colonne : photo en ratio 4:5, badge promo en haut à gauche ("Upgrade offert", "-25%"...), catégorie, titre, nom du partenaire, lieu et date de validité.

7. **Membership / Ma carte de membre** (onglet 4, icône silhouette) — titre "Ma carte de membre". Une carte de membre virtuelle en 3D : dégradé violet, légère inclinaison en perspective (rotateX), grain discret, ombre portée marquée (c'est un objet qui se détache), logo et monogramme en en-tête, nom de la formule en Playfair avec un badge "VIP" (contour or, texte beige — jamais de texte doré), numéro de membre, nom du membre, puis membre-depuis et validité en pied de carte. En dessous, un menu de réglages : Vos informations, Mes factures, Historique des demandes, Parrainer un membre, Se déconnecter. Une citation de marque en italique Playfair en bas de page.

8. **Vos informations** — nom, email, téléphone, rôle en lecture, bouton "Modifier mes informations", puis un bloc de préférences de notification avec des interrupteurs à bascule.

9. **Historique des demandes** — liste des demandes passées (Terminée, Annulée), même structure de carte que Mes demandes.

10. **Mes factures** — carte "Formule Signature" en dégradé violet avec le prix et la date de prochain prélèvement. En dessous, filtres Toutes / Abonnement / Prestations, puis une liste de factures (numéro, date, montant, statut "Payée" en violet plein — jamais en vert).

## Formules d'adhésion (à modéliser dans Supabase)

- **Essentiel** — 890 €/an + 10% de commission sur les prestations.
- **Signature** — 1490 €/mois, accès illimité.

## Navigation

Barre de navigation flottante en bas (piste mobile), quatre onglets : Accueil, Mes demandes, Offres, Membership. Icône seule pour les onglets inactifs, icône remplie + libellé sur fond violet très clair pour l'onglet actif.

Construis d'abord la structure complète (routing, les dix écrans avec des données d'exemple statiques, le système de couleurs et de typographie en variables Tailwind), avant de brancher Supabase pour l'authentification et les données réelles.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/41b1075b-2b17-4a5b-8120-aca5edc05f47).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
