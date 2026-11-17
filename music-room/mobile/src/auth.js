import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, loadSettings, setToken, state, logAction } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const refresh = useCallback(async () => { const u = await api('GET', '/me'); setUser(u); return u; }, []);
  const signOut = useCallback(async () => { try { await api('POST', '/auth/logout'); } catch { /* ignore */ } await setToken(null); setUser(null); }, []);
  useEffect(() => {
    state.onUnauthorized = () => { setToken(null); setUser(null); };
    (async () => { await loadSettings(); if (state.token) { try { await refresh(); } catch { await setToken(null); } } setReady(true); })();
  }, [refresh]);
  const signIn = async (token) => { await setToken(token); const u = await refresh(); logAction('login'); return u; };
  return <Ctx.Provider value={{ ready, user, refresh, signIn, signOut }}>{children}</Ctx.Provider>;
}
