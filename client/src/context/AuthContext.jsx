import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import api, { tokenStore } from '../api/axios';
import { setTimeFormat } from '../utils/helpers';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get('/users/me')
      .then((r) => alive && setUser(r.data.data))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setLoading(false));
    const onLogout = () => setUser(null);
    window.addEventListener('tf:logout', onLogout);
    return () => { alive = false; window.removeEventListener('tf:logout', onLogout); };
  }, []);

  setTimeFormat(user?.preferences?.timeFormat); // applied during render so children format with the right clock

  // One socket per signed-in user
  useEffect(() => {
    if (!user) { setSocket(null); return undefined; }
    const s = io(import.meta.env.VITE_SOCKET_URL || undefined, {
      auth: (cb) => cb({ token: tokenStore.get() }),
      withCredentials: true,
    });
    s.on('connect_error', () => { /* token may be mid-refresh; socket.io retries */ });
    setSocket(s);
    return () => s.disconnect();
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback((data) => {
    tokenStore.set(data.accessToken);
    setUser(data.user);
  }, []);

  // password sign in; rejects with err.response.data.data.needsVerification when the email is unverified
  const login = useCallback(async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    finish(r.data.data);
    return r.data;
  }, [finish]);

  // sign up only creates the account and emails a code; the session starts after verification
  const register = useCallback(async (name, email, password) => (await api.post('/auth/register', { name, email, password })).data, []);

  const verifyEmail = useCallback(async (email, code) => {
    const r = await api.post('/auth/verify-email', { email, code });
    finish(r.data.data);
    return r.data;
  }, [finish]);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    tokenStore.set(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, loading, login, register, verifyEmail, logout, socket }),
    [user, loading, login, register, verifyEmail, logout, socket]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
