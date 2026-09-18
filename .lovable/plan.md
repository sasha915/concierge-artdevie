# Plan de construction — Art de Vie

## Objectif
Créer une première version mobile complète de l’espace membre avec dix écrans, une navigation fluide et des données de démonstration. Cette étape reste entièrement visuelle et locale : la connexion aux données réelles viendra ensuite.

## Expérience proposée
- Connexion sur invitation, puis accès à l’accueil membre.
- Navigation flottante persistante entre Accueil, Mes demandes, Offres et Membership.
- Parcours complet des demandes : liste, création, détail et historique.
- Catalogue d’offres, carte de membre, informations personnelles et factures.
- Contenus d’exemple cohérents pour rendre chaque écran immédiatement testable.

## Écrans et parcours
1. `/connexion` — formulaire de connexion et demande d’invitation.
2. `/` — accueil, statistiques, prochaine demande et offres vedettes.
3. `/demandes` — filtres et liste des demandes.
4. `/demandes/nouvelle` — formulaire de création fermé par une croix.
5. `/demandes/$requestId` — détail d’une demande.
6. `/offres` — catalogue filtrable de privilèges.
7. `/membership` — carte virtuelle et menu du compte.
8. `/membership/informations` — coordonnées et notifications.
9. `/membership/historique` — demandes terminées ou annulées.
10. `/membership/factures` — formule, filtres et factures.

## Direction visuelle
- Palette strictement limitée aux beiges, violets et or décoratif fournis.
- Playfair Display pour titres, lieux et chiffres importants ; Work Sans pour le reste.
- Photos plein cadre à angles vifs avec voile violet permanent.
- Cartes sans ombre ; ombres uniquement pour navigation, actions principales et carte membre.
- Statuts exprimés exclusivement dans l’échelle violette prescrite.
- Mise en page pensée d’abord pour mobile, avec une largeur confortable sur grand écran.

## Interactions
- Filtres fonctionnels sur demandes, historique, offres et factures.
- Navigation et boutons ouvrant chaque écran attendu.
- Interrupteurs de notifications manipulables.
- Carte membre avec perspective légère et mouvement discret au pointeur, désactivé si les animations sont réduites.

## Détails techniques
- Définir les couleurs, polices, rayons et ombres comme variables sémantiques globales Tailwind.
- Créer des composants partagés pour la navigation, les statuts, les demandes, les offres et les en-têtes.
- Utiliser des données TypeScript statiques centralisées pour cette première étape.
- Donner à chaque écran ses propres métadonnées de partage et de référencement.
- Charger les polices dans l’en-tête du document.
- Aucun branchement Lovable Cloud, authentification réelle ou stockage persistant dans cette étape.

## Validation
- Vérifier les dix écrans sur formats mobile et bureau.
- Vérifier les liens, filtres, champs, boutons et absence de chevauchement.
- Vérifier que la compilation et l’affichage ne présentent aucune erreur.
