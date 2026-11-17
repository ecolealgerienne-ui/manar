import { config } from './config.js';
import { HttpError } from './util.js';

/**
 * Verification of social tokens obtained by the mobile app (Google ID token / Facebook access token).
 * The backend never trusts the client's claim: it asks the provider. Exported as an object so tests can stub it.
 * Returns { id, email, emailVerified, name }.
 */
export const social = {
  async verify(provider, token) {
    if (provider === 'google') return this.google(token);
    if (provider === 'facebook') return this.facebook(token);
    throw new HttpError(400, 'BAD_PROVIDER', 'provider must be google or facebook');
  },
  async google(idToken) {
    if (!config.googleClientIds.length) throw new HttpError(501, 'PROVIDER_NOT_CONFIGURED', 'Google login is not configured');
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!r.ok) throw new HttpError(401, 'INVALID_SOCIAL_TOKEN', 'Invalid Google token');
    const j = await r.json();
    if (!config.googleClientIds.includes(j.aud)) throw new HttpError(401, 'INVALID_SOCIAL_TOKEN', 'Token audience mismatch');
    return { id: j.sub, email: j.email, emailVerified: j.email_verified === 'true' || j.email_verified === true, name: j.name || j.email };
  },
  async facebook(accessToken) {
    if (!config.facebookAppId || !config.facebookAppSecret) throw new HttpError(501, 'PROVIDER_NOT_CONFIGURED', 'Facebook login is not configured');
    const appToken = `${config.facebookAppId}|${config.facebookAppSecret}`;
    const dbg = await fetch(`https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`);
    const dj = await dbg.json().catch(() => ({}));
    if (!dbg.ok || !dj.data?.is_valid || dj.data.app_id !== config.facebookAppId) throw new HttpError(401, 'INVALID_SOCIAL_TOKEN', 'Invalid Facebook token');
    const me = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`);
    const mj = await me.json();
    if (!me.ok || !mj.id) throw new HttpError(401, 'INVALID_SOCIAL_TOKEN', 'Invalid Facebook token');
    return { id: mj.id, email: mj.email, emailVerified: !!mj.email, name: mj.name || 'Facebook user' };
  },
};
