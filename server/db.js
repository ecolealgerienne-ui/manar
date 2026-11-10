import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function openDb(path = process.env.VELUNE_DB || resolve(process.cwd(), 'data/velune.db')) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

export const tx = (db, fn) => {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS brands (
  id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT, fictional INTEGER DEFAULT 0, demo INTEGER DEFAULT 1, created_at TEXT
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, brand_id INTEGER NOT NULL REFERENCES brands(id),
  category TEXT NOT NULL, subcategory TEXT, description TEXT, gender TEXT, year INTEGER, perfumer TEXT, concentration TEXT,
  families TEXT DEFAULT '[]', accords TEXT DEFAULT '[]', notes_top TEXT DEFAULT '[]', notes_heart TEXT DEFAULT '[]', notes_base TEXT DEFAULT '[]',
  intensity INTEGER, seasons TEXT DEFAULT '[]', occasions TEXT DEFAULT '[]',
  actives TEXT DEFAULT '[]', skin_types TEXT DEFAULT '[]', hair_types TEXT DEFAULT '[]', inci TEXT, texture TEXT, finish TEXT, coverage TEXT,
  shades TEXT DEFAULT '[]', image_source TEXT, source TEXT, verified INTEGER DEFAULT 0, demo INTEGER DEFAULT 1,
  popularity INTEGER DEFAULT 0, status TEXT DEFAULT 'active', created_at TEXT, updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category);
CREATE TABLE IF NOT EXISTS formats (
  id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size REAL NOT NULL, unit TEXT NOT NULL DEFAULT 'ml', ean TEXT, ref_price REAL
);
CREATE INDEX IF NOT EXISTS idx_formats_product ON formats(product_id);
CREATE TABLE IF NOT EXISTS merchants (
  id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, verified INTEGER DEFAULT 0,
  last_check TEXT, ship_fee REAL DEFAULT 0, free_threshold REAL, delivery_days INTEGER DEFAULT 3, status TEXT DEFAULT 'active',
  url TEXT, criteria TEXT, contact TEXT, selected INTEGER DEFAULT 0, demo INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY, format_id INTEGER NOT NULL REFERENCES formats(id) ON DELETE CASCADE,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  price REAL NOT NULL, price_orig REAL, available INTEGER DEFAULT 1, url TEXT, source TEXT, fetched_at TEXT NOT NULL,
  verified_status TEXT DEFAULT 'unverified', expires_at TEXT, flagged INTEGER DEFAULT 0, demo INTEGER DEFAULT 1,
  UNIQUE(format_id, merchant_id)
);
CREATE INDEX IF NOT EXISTS idx_offers_format ON offers(format_id);
CREATE TABLE IF NOT EXISTS price_history (
  format_id INTEGER NOT NULL REFERENCES formats(id) ON DELETE CASCADE, day TEXT NOT NULL, price REAL NOT NULL, kind TEXT DEFAULT 'demo',
  PRIMARY KEY (format_id, day)
);
CREATE TABLE IF NOT EXISTS promo_codes (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL, merchant_id INTEGER REFERENCES merchants(id) ON DELETE CASCADE,
  type TEXT NOT NULL, value REAL DEFAULT 0, min_amount REAL DEFAULT 0, expires_at TEXT, conditions TEXT,
  categories TEXT DEFAULT '[]', brands TEXT DEFAULT '[]', verified_at TEXT, active INTEGER DEFAULT 1, demo INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, user_id INTEGER,
  author TEXT, rating INTEGER NOT NULL, text TEXT, demo INTEGER DEFAULT 0, status TEXT DEFAULT 'published', created_at TEXT
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, pw_hash TEXT NOT NULL, name TEXT, role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active', profile TEXT DEFAULT '{}', deletion_requested TEXT, failed_logins INTEGER DEFAULT 0, locked_until INTEGER DEFAULT 0, created_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS lists (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, is_default INTEGER DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS list_items (list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, added_at TEXT, PRIMARY KEY (list_id, product_id));
CREATE TABLE IF NOT EXISTS baskets (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT, items TEXT NOT NULL, updated_at TEXT);
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  format_id INTEGER NOT NULL REFERENCES formats(id) ON DELETE CASCADE, target_price REAL NOT NULL, merchant_ids TEXT DEFAULT '[]',
  active INTEGER DEFAULT 1, last_triggered TEXT, last_notified_price REAL, created_at TEXT
);
CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT, message TEXT, link TEXT, read INTEGER DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS email_outbox (id INTEGER PRIMARY KEY, user_id INTEGER, to_email TEXT, subject TEXT, body TEXT, status TEXT DEFAULT 'non-envoyé (SMTP non configuré)', created_at TEXT);
CREATE TABLE IF NOT EXISTS search_log (id INTEGER PRIMARY KEY, user_id INTEGER, q TEXT, results INTEGER, at TEXT);
CREATE TABLE IF NOT EXISTS product_views (id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL, at TEXT);
CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY, admin_id INTEGER, admin_email TEXT, action TEXT, entity TEXT, entity_id TEXT, detail TEXT, at TEXT);
CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY, user_id INTEGER, product_id INTEGER, offer_id INTEGER, message TEXT, status TEXT DEFAULT 'open', created_at TEXT);
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, name TEXT, email TEXT, subject TEXT, body TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY, merchant_id INTEGER, feed_title TEXT, feed_brand TEXT, feed_size TEXT, feed_ean TEXT, product_id INTEGER, format_id INTEGER,
  confidence REAL, reason TEXT, status TEXT DEFAULT 'pending', created_at TEXT
);
`;
