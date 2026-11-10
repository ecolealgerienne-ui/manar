# Connecteurs de données (à brancher)
Chaque fournisseur doit implémenter :
```js
export default {
  name: 'awin',
  async fetchOffers(since) { /* → [{ merchantSlug, ean, title, brand, size, unit, price, priceOrig, available, url, fetchedAt }] */ },
};
```
Pipeline cible : (1) récupérer via flux/API **autorisés** (Awin, Effinity, CJ Affiliate, TradeTracker : accès soumis à l’adhésion aux programmes) ; (2) rapprocher par EAN/GTIN, sinon marque + nom normalisé + format + concentration avec score de confiance ; (3) confiance < 0,9 ou EAN absent → table `matches` (validation manuelle en admin) ; (4) upsert dans `offers` avec `source`, `fetched_at`, `verified_status` ; (5) appender `price_history` ; (6) `checkAlerts()`. Aucun scraping non autorisé.
