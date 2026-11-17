import { tx } from './db.js';
import { HttpError, EMAIL_RE, hashPassword, verifyPassword, newToken, hashToken, bad, now, str } from './util.js';
import { config } from './config.js';
import { sendMail } from './mail.js';
import { social } from './social.js';
import { LoginGuard } from './ratelimit.js';

const DAY = 86400000;
const guard = new LoginGuard();

export function createAuth(db) {
  const q = (s, ...p) => db.prepare(s).get(...p);
  const run = (s, ...p) => db.prepare(s).run(...p);

  function checkPassword(pw) {
    if (typeof pw !== 'string' || pw.length < 8 || pw.length > 128) throw bad('password must be 8-128 characters', 'WEAK_PASSWORD');
    if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) throw bad('password must contain letters and digits', 'WEAK_PASSWORD');
  }

  function createSession(userId, meta) {
    const token = newToken();
    run('INSERT INTO sessions (user_id,token_hash,created_at,expires_at,ip,user_agent,platform,device) VALUES (?,?,?,?,?,?,?,?)',
      userId, hashToken(token), now(), now() + config.sessionDays * DAY, meta.ip ?? null, (meta.ua || '').slice(0, 200), meta.platform ?? null, meta.device ?? null);
    return token;
  }

  async function issueToken(userId, kind, ttlMs, short = false) {
    // "reset" tokens are short codes typed in the app; "verify" tokens are long links.
    const token = short ? newToken(6).replace(/[-_]/g, 'x').slice(0, 8).toUpperCase() : newToken();
    run('UPDATE user_tokens SET used=1 WHERE user_id=? AND kind=?', userId, kind);
    run('INSERT INTO user_tokens (user_id,kind,token_hash,expires_at) VALUES (?,?,?,?)', userId, kind, hashToken(token), now() + ttlMs);
    return token;
  }
  function consumeToken(token, kind) {
    return tx(db, () => {
      const t = q('SELECT * FROM user_tokens WHERE token_hash=? AND kind=? AND used=0 AND expires_at>?', hashToken(token), kind, now());
      if (!t) throw new HttpError(400, 'INVALID_TOKEN', 'Invalid or expired token');
      run('UPDATE user_tokens SET used=1 WHERE id=?', t.id);
      return t.user_id;
    });
  }

  async function sendVerification(user) {
    const t = await issueToken(user.id, 'verify', DAY);
    await sendMail(user.email, 'Verify your Music Room account',
      `Hello ${user.display_name},\n\nConfirm your e-mail address:\n${config.publicUrl}/auth/verify-email?token=${t}\n\nThis link is valid for 24 hours.`);
  }

  async function register({ email, password, display_name }) {
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) throw bad('invalid email', 'INVALID_EMAIL');
    checkPassword(password);
    const name = str(display_name, 'display_name', { min: 2, max: 50 });
    const hash = await hashPassword(password);
    try {
      const r = run('INSERT INTO users (email,password_hash,display_name,created_at) VALUES (?,?,?,?)', email.trim().toLowerCase(), hash, name, now());
      const user = q('SELECT * FROM users WHERE id=?', Number(r.lastInsertRowid));
      await sendVerification(user);
    } catch (e) {
      // Same answer whether or not the e-mail exists: no account enumeration.
      if (!String(e.message).includes('UNIQUE')) throw e;
    }
    return { message: 'If the address is valid, a verification e-mail has been sent.' };
  }

  async function resendVerification(email) {
    const u = typeof email === 'string' ? q('SELECT * FROM users WHERE email=? AND email_verified=0 AND password_hash IS NOT NULL', email.trim()) : null;
    if (u) await sendVerification(u);
    return { message: 'If the account exists and is not verified, an e-mail has been sent.' };
  }

  function verifyEmail(token) { run('UPDATE users SET email_verified=1 WHERE id=?', consumeToken(token, 'verify')); }

  async function login({ email, password }, meta) {
    if (typeof email !== 'string' || typeof password !== 'string') throw bad('email and password are required');
    const key = email.trim().toLowerCase();
    guard.check(key);
    const u = q('SELECT * FROM users WHERE email=?', key);
    const ok = await verifyPassword(password, u?.password_hash);
    if (!u || !ok) { guard.fail(key); throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid e-mail or password'); }
    if (!u.email_verified) throw new HttpError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your e-mail address first');
    guard.ok(key);
    return { token: createSession(u.id, meta), user_id: u.id };
  }

  async function forgotPassword(email) {
    const u = typeof email === 'string' ? q('SELECT * FROM users WHERE email=? AND password_hash IS NOT NULL', email.trim()) : null;
    if (u) {
      const code = await issueToken(u.id, 'reset', 30 * 60000, true);
      await sendMail(u.email, 'Reset your Music Room password', `Your reset code is: ${code}\nIt is valid for 30 minutes. If you did not ask for it, ignore this e-mail.`);
    }
    return { message: 'If the account exists, a reset code has been sent.' };
  }
  async function resetPassword(code, password) {
    checkPassword(password);
    if (typeof code !== 'string') throw bad('code is required');
    const uid = consumeToken(code.trim().toUpperCase(), 'reset');
    run('UPDATE users SET password_hash=?, email_verified=1 WHERE id=?', await hashPassword(password), uid);
    run('DELETE FROM sessions WHERE user_id=?', uid); // log out everywhere
  }
  async function changePassword(user, current, next) {
    checkPassword(next);
    if (!(await verifyPassword(current ?? '', user.password_hash))) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Current password is wrong');
    run('UPDATE users SET password_hash=? WHERE id=?', await hashPassword(next), user.id);
  }

  /** Social registration / login. */
  async function socialLogin(provider, token, meta) {
    if (typeof token !== 'string' || !token) throw bad('token is required');
    const p = await social.verify(provider, token);
    let link = q('SELECT user_id FROM social_accounts WHERE provider=? AND provider_id=?', provider, p.id);
    let userId = link?.user_id;
    if (!userId) {
      const existing = p.email ? q('SELECT * FROM users WHERE email=?', p.email.toLowerCase()) : null;
      if (existing) {
        // Auto-link only when both sides are verified, otherwise someone could pre-register a victim's e-mail.
        if (!p.emailVerified || !existing.email_verified) throw new HttpError(409, 'EMAIL_EXISTS', 'An account already exists for this e-mail: log in and link the provider from your profile');
        userId = existing.id;
      } else {
        const r = run('INSERT INTO users (email,email_verified,display_name,created_at) VALUES (?,?,?,?)',
          p.email ? p.email.toLowerCase() : null, p.emailVerified ? 1 : 0, String(p.name || 'Music lover').slice(0, 50), now());
        userId = Number(r.lastInsertRowid);
      }
      run('INSERT INTO social_accounts (provider,provider_id,user_id) VALUES (?,?,?)', provider, p.id, userId);
    }
    return { token: createSession(userId, meta), user_id: userId };
  }
  async function linkSocial(user, provider, token) {
    const p = await social.verify(provider, token);
    const other = q('SELECT user_id FROM social_accounts WHERE provider=? AND provider_id=?', provider, p.id);
    if (other && other.user_id !== user.id) throw new HttpError(409, 'ALREADY_LINKED', 'This social account is linked to another user');
    run('INSERT OR IGNORE INTO social_accounts (provider,provider_id,user_id) VALUES (?,?,?)', provider, p.id, user.id);
    // Linking proves ownership of the provider e-mail only when the user has none yet.
  }
  function unlinkSocial(user, provider) {
    const n = q('SELECT COUNT(*) c FROM social_accounts WHERE user_id=?', user.id).c;
    if (!user.password_hash && n <= 1) throw new HttpError(409, 'LAST_LOGIN_METHOD', 'Set a password before unlinking your only login method');
    run('DELETE FROM social_accounts WHERE user_id=? AND provider=?', user.id, provider);
  }

  function authenticate(token) {
    if (!token) return null;
    const s = q('SELECT s.id sid, s.expires_at, u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?', hashToken(token));
    if (!s || s.expires_at <= now()) return null;
    return s;
  }

  return { register, resendVerification, verifyEmail, login, forgotPassword, resetPassword, changePassword, socialLogin, linkSocial, unlinkSocial,
    authenticate, checkPassword, createSession };
}
