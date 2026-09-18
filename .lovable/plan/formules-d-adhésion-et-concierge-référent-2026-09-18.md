# Formules d’adhésion et concierge référent

## Objectif
Mettre à jour les informations de formule à partir du profil réel, sans alourdir la carte membre.

## Changements
- Ajouter `concierge_referent` au profil dans la base, nullable afin que les membres Essentiel n’affichent aucune ligne.
- Attribuer un nom réaliste au compte de test actuel et prévoir une valeur dédiée pour les nouveaux membres Signature.
- Afficher le concierge référent dans « Vos informations », à la suite du rôle, uniquement pour la formule Signature et lorsqu’un nom existe.
- Adapter la carte « Mes factures » à la formule active :
  - Signature : 1 490 €/mois, prochain prélèvement, engagement minimum 12 mois, sans commission supplémentaire.
  - Essentiel : 890 €/an, prochain prélèvement annuel, + 10 % de commission, sans mention d’engagement.
- Mettre à jour les types et la lecture du profil pour inclure le nouveau champ.

## Vérification
- Tester visuellement les pages « Vos informations » et « Mes factures » avec le profil de test Signature sur mobile.
- Vérifier que la disposition reste lisible sur écran étroit et qu’aucune erreur n’apparaît.
- Contrôler la logique Essentiel dans le code afin que le référent et l’engagement soient absents.
