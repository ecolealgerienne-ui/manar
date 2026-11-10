# Documentation technique
**Stack** : Node 22, `node:http`, `node:sqlite`, front en modules ES natifs (sans build). Zéro dépendance.
- `server/db.js` schéma SQLite · `server/seed.js` + `server/data/*` jeu de démonstration (205 parfums, 58 skincare, 53 maquillage, 24 cheveux/corps, 85 marques, 8 marchands fictifs, ~3 400 offres, historiques fictifs)
- `server/lib/catalog.js` catalogue en mémoire (rechargé après chaque écriture admin) · `search.js` analyse de requête (prix, tailles, notes incluses/exclues, familles, ingrédients, genre, finition…, flou Damerau-Levenshtein), score de couverture · `similarity.js` Beauty Match (critères pondérés + raisons + différences) · `pricing.js` prix unitaire, livraison, codes, historique · `services.js` panier (exhaustif ≤120 000 combinaisons, sinon recherche locale), alertes, recommandations
- `server/routes/{public,user,admin}.js` API REST JSON · `server/seo.js` meta, JSON-LD, sitemap
- Sécurité : scrypt, sessions en base (cookie HttpOnly SameSite=Lax, `Secure` derrière HTTPS), CSRF par en-tête `X-Requested-With` + contrôle d’origine, limitation de débit, verrouillage après 5 échecs, CSP stricte, rôle admin vérifié côté serveur, requêtes SQL paramétrées, échappement systématique côté client.
- Honnêteté des données : tout produit/offre de démo porte `demo=1` et un badge ; images = illustrations SVG générées ; EAN de démo en préfixe 29 (usage interne) ; liens marchands en `.invalid` ; pas d’historique inventé pour un produit récent ; qualification « exceptionnelle » uniquement avec ≥ 20 relevés.
- Alertes : évaluées à chaque modification d’offre, au démarrage et toutes les 15 min ; seules les offres **vérifiées, disponibles, non périmées, non expirées** déclenchent une notification.
- SEO : `noindex` par défaut (données fictives) ; `VELUNE_INDEXING=1` pour autoriser l’indexation.
- Intégrations : voir `server/providers/README.md`.
