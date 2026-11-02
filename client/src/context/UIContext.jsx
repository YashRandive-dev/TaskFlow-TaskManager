import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const UIContext = createContext(null);
export const useUI = () => useContext(UIContext);

export function UIProvider({ children }) {
  const { user } = useAuth();
  const [taskModal, setTaskModal] = useState({ open: false, taskId: null, defaults: null });
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('tf-sidebar') === '1'; } catch { return false; }
  });
  const [mobileNav, setMobileNav] = useState(false);
  const [view, setViewState] = useState(() => {
    try { return localStorage.getItem('tf-view') || user?.preferences?.defaultView || 'list'; } catch { return 'list'; }
  });

  const setView = useCallback((v) => {
    setViewState(v);
    try { localStorage.setItem('tf-view', v); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem('tf-sidebar', collapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [collapsed]);

  const openTask = useCallback((taskId) => setTaskModal({ open: true, taskId, defaults: null }), []);
  const newTask = useCallback((defaults = null) => setTaskModal({ open: true, taskId: null, defaults }), []);
  const closeTask = useCallback(() => setTaskModal({ open: false, taskId: null, defaults: null }), []);

  // Projects (shared by sidebar, filters, modal)
  const [projects, setProjects] = useState([]);
  const loadProjects = useCallback(async () => {
    if (!user) return;
    try { setProjects((await api.get('/projects')).data.data); } catch { /* ignore */ }
  }, [user]);
  useEffect(() => { loadProjects(); }, [loadProjects]);

  const value = useMemo(() => ({
    taskModal, openTask, newTask, closeTask, shortcutsOpen, setShortcutsOpen,
    collapsed, setCollapsed, mobileNav, setMobileNav, view, setView, projects, loadProjects,
  }), [taskModal, openTask, newTask, closeTask, shortcutsOpen, collapsed, mobileNav, view, setView, projects, loadProjects]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}
