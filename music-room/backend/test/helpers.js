process.env.NODE_ENV = 'test';
import { start } from '../src/index.js';
import { outbox } from '../src/mail.js';

export async function boot(opts = {}) {
  const s = await start({ port: 0, dbPath: ':memory:', logFile: false, rateLimitMax: 100000, authRateLimitMax: 100000, ...opts });
  const base = `http://127.0.0.1:${s.port}`;
  const call = async (method, path, { token, body, headers } = {}) => {
    const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    let json = null; try { json = await r.json(); } catch { /* html */ }
    return { status: r.status, body: json };
  };
  let n = 0;
  /** Register + verify (through the e-mailed link) + login. */
  const user = async (name = `user${++n}`) => {
    const email = `${name}${Date.now()}${n}@test.io`;
    const pw = 'Passw0rd!x';
    await call('POST', '/auth/register', { body: { email, password: pw, display_name: name } });
    const mail = outbox.findLast((m) => m.to === email);
    const link = mail.text.match(/https?:\/\/\S+token=\S+/)[0].replace(/^https?:\/\/[^/]+/, '');
    const v = await fetch(base + link); if (v.status !== 200) throw new Error('verify failed');
    const l = await call('POST', '/auth/login', { body: { email, password: pw } });
    return { email, pw, token: l.body.token, id: l.body.user_id, name };
  };
  return { ...s, base, call, user, outbox };
}
