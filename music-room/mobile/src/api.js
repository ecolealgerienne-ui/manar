import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const DEFAULT_URL = Constants.expoConfig?.extra?.defaultApiUrl || 'http://localhost:4000';
export const state = { baseUrl: DEFAULT_URL, token: null, onUnauthorized: () => {} };

// The app is a pure remote control: all data lives on the back-end whose address is configurable (Settings).
export async function loadSettings() {
  const [url, token] = await Promise.all([AsyncStorage.getItem('apiUrl'), AsyncStorage.getItem('token')]);
  if (url) state.baseUrl = url;
  state.token = token;
  return { url: state.baseUrl, token };
}
export async function setBaseUrl(url) { state.baseUrl = url.trim().replace(/\/+$/, ''); await AsyncStorage.setItem('apiUrl', state.baseUrl); }
export async function setToken(t) { state.token = t; if (t) await AsyncStorage.setItem('token', t); else await AsyncStorage.removeItem('token'); }

const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
// Sent on every call: the back-end logs platform, device and application version (subject V.6).
const browserLabel = () => {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent, b = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const o = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return o ? `${b} on ${o}` : b;
};
export const deviceLabel = () => Device.modelName || Device.deviceName || browserLabel() || 'unknown';
const clientHeaders = () => ({ 'X-Platform': Platform.OS, 'X-Device-Model': deviceLabel(), 'X-App-Version': APP_VERSION });

export class ApiError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }

export async function api(method, path, body) {
  let res;
  try {
    res = await fetch(state.baseUrl + path, { method, headers: { 'Content-Type': 'application/json', ...clientHeaders(), ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch { throw new ApiError(0, 'NETWORK', `Cannot reach ${state.baseUrl}`); }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && state.token) state.onUnauthorized();
    throw new ApiError(res.status, json?.error?.code, json?.error?.message || `HTTP ${res.status}`);
  }
  return json;
}
export const logAction = (action) => { if (state.token) api('POST', '/logs', { action }).catch(() => {}); };

/** WebSocket subscription helper: returns an unsubscribe function. Reconnects with backoff. */
export function subscribe(channel, onState) {
  let ws, closed = false, retry = 0;
  const connect = () => {
    const url = state.baseUrl.replace(/^http/, 'ws') + '/ws';
    ws = new WebSocket(url);
    ws.onopen = () => { retry = 0; ws.send(JSON.stringify({ action: 'auth', token: state.token })); ws.send(JSON.stringify({ action: 'subscribe', channel })); };
    ws.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.type === 'state' && m.channel === channel) onState(m.data); } catch { /* ignore */ } };
    ws.onclose = () => { if (!closed) setTimeout(connect, Math.min(10000, 500 * 2 ** retry++)); };
  };
  connect();
  return () => { closed = true; try { ws.close(); } catch { /* ignore */ } };
}
