import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Minimal .env loader (no dependency). Real environment variables win.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
for (const f of [path.join(root, '.env'), path.join(root, 'backend', '.env')]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const env = process.env;
const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

export const config = {
  port: num(env.PORT, 4000),
  isProd: env.NODE_ENV === 'production',
  tokenSecret: env.TOKEN_SECRET || 'dev-only-secret-do-not-use-in-production',
  dbPath: env.DB_PATH || path.join(root, 'data', 'musicroom.db'),
  publicUrl: env.PUBLIC_URL || `http://localhost:${num(env.PORT, 4000)}`,
  smtp: { host: env.SMTP_HOST, port: num(env.SMTP_PORT, 587), user: env.SMTP_USER, pass: env.SMTP_PASS },
  mailFrom: env.MAIL_FROM || 'Music Room <no-reply@musicroom.local>',
  googleClientIds: (env.GOOGLE_CLIENT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean),
  facebookAppId: env.FACEBOOK_APP_ID || '',
  facebookAppSecret: env.FACEBOOK_APP_SECRET || '',
  rateLimitMax: num(env.RATE_LIMIT_MAX, 300),
  authRateLimitMax: num(env.AUTH_RATE_LIMIT_MAX, 20),
  corsOrigins: env.CORS_ORIGINS || '*',
  logDir: env.LOG_DIR || path.join(root, 'logs'),
  sessionDays: 7,
};
// Dev mode = not production AND no SMTP: the API hands the verification token / reset code back in the response
// so the app can be tried without a mail server. Never active in production.
config.devMode = !config.isProd && !config.smtp.host;

if (config.isProd && config.tokenSecret.startsWith('dev-only')) {
  throw new Error('TOKEN_SECRET must be set in production');
}
