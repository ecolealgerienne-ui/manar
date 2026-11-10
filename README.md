# VELUNE — Discover your beauty. Find your value.

Plateforme de découverte, comparaison et promotions beauté (parfums, skincare, maquillage, cheveux, corps).
VELUNE **ne vend pas** : elle redirige vers des marchands. **Cette version est une démonstration : tout le catalogue, les marchands, les prix, historiques, avis et codes promo sont fictifs et signalés comme tels.**

## Lancement rapide
Prérequis : Node.js ≥ 22.13 (SQLite intégré, **aucune dépendance npm**).

```bash
npm start            # http://localhost:3000 ; la base de démonstration est créée au premier démarrage
npm test             # 15 tests (parcours 1 à 9 du cahier des charges + sécurité)
npm run seed -- --reset   # régénère la base
```

Au premier démarrage, les identifiants de démonstration sont affichés (et écrits dans `data/DEMO_CREDENTIALS.txt` via `npm run seed`) :
- **Administrateur** : `admin@velune.demo` — mot de passe **aléatoire** généré au seed (ou fixé par `VELUNE_ADMIN_PASSWORD`). Changez-le avant tout déploiement.
- **Utilisateur** : `user@velune.demo` / `Demo-Velune-2024!` (profil beauté pré-rempli).

## Documentation
- [Utilisateur](docs/utilisateur.md) · [Administrateur](docs/administrateur.md) · [Technique](docs/technique.md) · [Déploiement](docs/deploiement.md) · [Fonctionnalités et intégrations restantes](docs/etat-des-lieux.md)
