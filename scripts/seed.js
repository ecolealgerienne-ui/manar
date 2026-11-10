import { openDb } from '../server/db.js';
import { seed } from '../server/seed.js';
import { writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
const reset = process.argv.includes('--reset');
const path = process.env.VELUNE_DB || resolve(process.cwd(), 'data/velune.db');
if (reset) { const fs = await import('node:fs'); for (const s of ['', '-wal', '-shm']) fs.rmSync(path + s, { force: true }); }
const db = openDb(path);
if (db.prepare('SELECT COUNT(*) c FROM products').get().c > 0) { console.log('Base déjà peuplée. Utilisez --reset pour la régénérer.'); process.exit(0); }
const { credentials: c } = seed(db);
mkdirSync('data', { recursive: true });
const f = resolve('data/DEMO_CREDENTIALS.txt');
writeFileSync(f, `ADMIN  ${c.adminEmail}  ${c.adminPassword}\nUSER   ${c.userEmail}  ${c.userPassword}\n`);
try { chmodSync(f, 0o600); } catch {}
console.log('Base peuplée. Identifiants de démonstration écrits dans', f);
console.log(`  Administrateur : ${c.adminEmail} / ${c.adminPassword}\n  Utilisateur    : ${c.userEmail} / ${c.userPassword}`);
