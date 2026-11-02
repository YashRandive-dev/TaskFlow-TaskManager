import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const Ctx = createContext(null);
export const useNotifications = () => useContext(Ctx);

export function NotificationProvider({ children }) {
  const { user, socket } = useAuth();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [ringKey, setRingKey] = useState(0); // bump to trigger bell shake

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const r = await api.get('/notifications');
      setItems(r.data.data.notifications);
      setUnread(r.data.data.unread);
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    const onNew = (n) => {
      setItems((p) => [n, ...p]);
      setUnread((u) => u + 1);
      setRingKey((k) => k + 1);
      if (user?.preferences?.inAppNotifications !== false) toast(n.message);
      if (user?.preferences?.pushNotifications && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('TaskFlow', { body: n.message });
      }
    };
    socket.on('notification:new', onNew);
    return () => socket.off('notification:new', onNew);
  }, [socket, user]);

  const markRead = useCallback(async (id) => {
    setItems((p) => p.map((n) => (n._id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try { await api.patch(`/notifications/${id}`); } catch { load(); }
  }, [load]);

  const markAll = useCallback(async () => {
    setItems((p) => p.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try { await api.patch('/notifications/read-all'); } catch { load(); }
  }, [load]);

  const clearAll = useCallback(async () => {
    setItems([]);
    setUnread(0);
    try { await api.delete('/notifications'); } catch { load(); }
  }, [load]);

  const value = useMemo(() => ({ items, unread, ringKey, markRead, markAll, clearAll, reload: load }), [items, unread, ringKey, markRead, markAll, clearAll, load]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
