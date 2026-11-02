import axios from 'axios';

const baseURL = `${import.meta.env.VITE_API_URL || ''}/api`;

export const api = axios.create({ baseURL, withCredentials: true });

export const tokenStore = {
  get: () => { try { return localStorage.getItem('tf-token'); } catch { return null; } },
  set: (t) => { try { t ? localStorage.setItem('tf-token', t) : localStorage.removeItem('tf-token'); } catch { /* ignore */ } },
};

api.interceptors.request.use((cfg) => {
  const t = tokenStore.get();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

let refreshing = null;
const refresh = () => {
  refreshing ??= axios
    .post(`${baseURL}/auth/refresh`, null, { withCredentials: true })
    .then((r) => { tokenStore.set(r.data.data.accessToken); return r.data.data.accessToken; })
    .finally(() => { refreshing = null; });
  return refreshing;
};

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    const isAuthCall = /^\/auth\/(login|register|refresh|verify|resend|forgot|reset|logout)/.test(original?.url || '');
    if (err.response?.status === 401 && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        const t = await refresh();
        original.headers.Authorization = `Bearer ${t}`;
        return api(original);
      } catch {
        tokenStore.set(null);
        window.dispatchEvent(new Event('tf:logout'));
      }
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) => {
  const msg = e?.response?.data?.message;
  if (msg) return msg;
  // No JSON body from the API means the proxy could not reach it (server stopped or crashed on start).
  if (e?.response && e.response.status >= 500) return 'Cannot reach the server. Make sure the API is running, then try again.';
  if (e?.code === 'ERR_NETWORK') return 'Network error. Check your connection and that the API is running.';
  return e?.message || 'Something went wrong';
};

/** Resolve upload URLs (local uploads are served by the API). */
export const fileUrl = (u) => (u?.startsWith('/') ? `${import.meta.env.VITE_API_URL || ''}${u}` : u);

export default api;
