import http from 'node:http';
import { config } from './config.js';
import { openDb } from './db.js';
import { createApp } from './app.js';
import { createHub } from './realtime.js';
import { createServices } from './services.js';
import { createCatalog } from './catalog.js';

export function start({ port = config.port, dbPath = config.dbPath, ...opts } = {}) {
  const db = openDb(dbPath);
  const catalog = createCatalog(db);
  const server = http.createServer();
  // The hub needs the services' access rules, the services need the hub's publish: wire them together.
  const access = createServices(db, catalog).access;
  const hub = createHub(server, { db, access });
  const app = createApp(db, { catalog, publish: hub.publish, ...opts });
  server.on('request', app);
  return new Promise((resolve) => server.listen(port, () => resolve({ server, db, hub, port: server.address().port, close: () => { hub.close(); server.close(); db.close(); } })));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const s = await start();
  console.log(`Music Room API on ${config.publicUrl}  (docs: /docs, ws: /ws)`);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { s.close(); process.exit(0); });
}
