# Documentation administrateur
Connexion avec le compte admin puis `/admin` (accès refusé aux autres comptes, vérifié côté serveur).
- **Tableau de bord** : compteurs (produits, marques, marchands, offres actives/obsolètes, sans image, incomplets), recherches fréquentes, produits consultés, bouton « relevé de prix simulé » (démo).
- **Produits** : ajout/modification (notes issues de la bibliothèque, actifs, formats avec EAN), vérification, suppression, **fusion de doublons**, filtres « sans image / incomplets / non vérifiés ».
- **Marques**, **Marchands** (type, frais, franco, statut ; *Suspendre* retire immédiatement ses offres), **Offres** (vérifier/modifier le prix, signaler obsolète — une offre non relevée depuis plus de 7 jours est automatiquement périmée), **Codes promo**.
- **Utilisateurs** : suspension, traitement des demandes de suppression. **Signalements**, **Messages** et boîte d’envoi des emails d’alerte (non envoyés : SMTP non configuré).
- **Rapprochements** : file de validation manuelle des correspondances produit/offre incertaines.
- **Journal** : toutes les modifications administratives sont tracées (qui, quoi, quand).
