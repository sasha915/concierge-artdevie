# Accueil responsive desktop

## Objectif
Adapter l’application existante à partir de 1024 px, sans modifier l’expérience mobile actuelle ni dupliquer les pages.

## Changements
- Ajouter dans le cadre partagé une barre latérale fixe desktop avec logo, navigation active et résumé du membre alimenté par son profil réel.
- Masquer la navigation flottante uniquement à partir de `lg:` et décaler le contenu principal pour laisser la place à la barre latérale.
- Conserver l’accueil mobile actuel sous `lg:`.
- Créer sur desktop une barre d’outils, un héros horizontal avec la carte membre à droite, des statistiques plus aérées, puis une grille à deux colonnes pour les demandes récentes et les privilèges en vedette.
- Réutiliser `profile`, `requests` et `offers`, avec les états vides existants lorsque les données manquent.

## Détails techniques
- Les différences mobile/desktop seront portées par les variantes Tailwind `lg:` dans les mêmes composants.
- La navigation active continuera d’utiliser l’URL courante.
- Les cartes desktop seront des variantes de présentation resserrées, sans modifier les composants mobiles existants.

## Vérification
- Contrôler le rendu et les interactions à 390 px et 1280 px.
- Vérifier l’absence de chevauchement, de contenu coupé et d’erreurs dans la console.
- Vérifier le typecheck et l’état du build de prévisualisation.
