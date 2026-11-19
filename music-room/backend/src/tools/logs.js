// Shows the back-end logs written for every request of the app (subject V.6): npm run logs [count]
import { openDb } from '../db.js';
const db = openDb();
const n = Number(process.argv[2]) || 20;
const rows = db.prepare('SELECT l.ts,l.user_id,l.method,l.path,l.status,l.platform,l.device,l.app_version,l.ip,l.duration_ms,l.action FROM logs l ORDER BY l.id DESC LIMIT ?').all(n).reverse();
if (!rows.length) console.log('No log yet: use the app first.');
for (const r of rows) {
  console.log(`${new Date(r.ts).toISOString()} user=${r.user_id ?? '-'} ${r.method} ${r.path} ${r.status} ${r.duration_ms}ms | platform=${r.platform} | device=${r.device} | version=${r.app_version} | ip=${r.ip}${r.action ? ` | ui-action=${r.action}` : ''}`);
}
