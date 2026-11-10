# Fonctionnalités terminées / intégrations restantes
**Terminé et testé** : toutes les pages demandées (22 + admin), moteur de recherche intelligent, filtres combinables, univers parfumerie (familles, notes, recherche avancée avec exclusions), Beauty Match expliqué, comparateurs prix/valeur/panier (livraison, franco, codes), historique, alertes, promotions et codes, skincare/maquillage/cheveux/corps, profil et recommandations, favoris/listes persistants, comptes, administration complète avec journal, SEO, responsive, accessibilité de base, RGPD (export/suppression, cookies), tests automatisés.
**Non connecté (volontairement, rien n’est simulé comme réel)** :
- Flux Awin, Effinity, CJ Affiliate, TradeTracker, API marchands, bases sous licence : interface décrite dans `server/providers/README.md` ; aucune donnée réelle, pas de scraping.
- Envoi d’emails (SMTP) : les emails d’alerte sont consignés dans une boîte d’envoi.
- Photos produits réelles et logos de marques : illustrations/monogrammes générés.
- Mentions légales de l’éditeur à renseigner. Pas de mesure d’audience.
**Limites connues** : « Mon compte » n’a pas de réinitialisation de mot de passe par email (SMTP requis) ; l’optimisation multi-boutiques est approchée au-delà de 120 000 combinaisons (signalé dans l’interface) ; saisons/occasions des parfums sont déduites, non issues des marques.
