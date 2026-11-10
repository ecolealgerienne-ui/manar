import { openDb } from './db.js';
import { seed } from './seed.js';
import { createApp } from './app.js';
import { checkAlerts } from './lib/services.js';

const port = +process.env.PORT || 3000;
const db = openDb();
if (db.prepare('SELECT COUNT(*) c FROM products').get().c === 0) {
  console.log('Base vide : génération du jeu de données de démonstration…');
  const { credentials: c } = seed(db);
  console.log(`  Admin démo : ${c.adminEmail} / ${c.adminPassword}\n  Utilisateur démo : ${c.userEmail} / ${c.userPassword}\n  (notez le mot de passe admin : il n'est affiché qu'une fois ; définissez VELUNE_ADMIN_PASSWORD pour le fixer)`);
}
const app = createApp(db, { dev: process.env.NODE_ENV !== 'production' });
checkAlerts(db, app.cat);
app.server.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`MANOU démarré sur http://localhost:${port}`));
process.on('SIGTERM', () => { app.close(); process.exit(0); });
