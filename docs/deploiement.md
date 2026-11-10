# Déploiement
Variables : `PORT`, `HOST`, `VELUNE_DB` (chemin SQLite), `VELUNE_ADMIN_PASSWORD` (mot de passe admin au 1er seed), `VELUNE_BASE_URL` (sitemap/canonical), `VELUNE_SECURE_COOKIES=1`, `VELUNE_INDEXING=1`, `NODE_ENV=production`.
```bash
docker build -t velune . && docker run -p 3000:3000 -v velune-data:/data -e VELUNE_ADMIN_PASSWORD='mot-de-passe-long' velune
```
Placer un proxy HTTPS (Caddy/nginx) devant, transmettre `X-Forwarded-Proto`. Sauvegarder le volume `/data`. Avant mise en production : compléter `server/data/pages.js` (mentions légales), connecter de vraies sources de données, configurer SMTP, supprimer le compte utilisateur de démo.
