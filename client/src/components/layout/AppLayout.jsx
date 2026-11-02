import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, Button, Modal, ThemeToggle, PageTransition } from '../ui';
import Icon from '../ui/Icon';
import TaskModal from '../tasks/TaskModal';
import TaskComposer from '../tasks/TaskComposer';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useTasks } from '../../context/TaskContext';
import { useUI } from '../../context/UIContext';
import { useMediaQuery, useShortcuts } from '../../hooks/hooks';

/** `when` limits an item to users who picked one of these purposes during onboarding. */
const NAV = [
  { to: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { to: '/tasks', icon: 'checklist', label: 'Tasks' },
  { to: '/projects', icon: 'projects', label: 'Projects', when: ['work'] },
  { to: '/focus', icon: 'timer', label: 'Focus timer', when: ['work', 'study'] },
  { to: '/notifications', icon: 'bell', label: 'Notifications' },
  { to: '/trash', icon: 'archive', label: 'Archive & Trash' },
  { to: '/profile', icon: 'user', label: 'Profile' },
  { to: '/settings', icon: 'settings', label: 'Settings' },
];

function NotificationBell() {
  const { unread, ringKey } = useNotifications();
  return (
    <Link to="/notifications" className="btn-ghost relative !p-2" aria-label={`Notifications, ${unread} unread`}>
      <motion.span key={ringKey} className={`inline-block origin-top ${ringKey ? 'animate-shake' : ''}`}><Icon name="bell" size={19} /></motion.span>
      <AnimatePresence>
        {unread > 0 && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

function Sidebar({ mobile }) {
  const { collapsed, setCollapsed, setMobileNav, projects } = useUI();
  const { user } = useAuth();
  const { unread } = useNotifications();
  const items = useMemo(() => NAV.filter((n) => !n.when || n.when.some((p) => user.purposes?.includes(p))), [user.purposes]);
  const isCollapsed = collapsed && !mobile;
  const showProjects = user.purposes?.includes('work') && projects.length > 0;
  return (
    <motion.aside
      animate={{ width: isCollapsed ? 72 : 244 }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}
      className="flex h-full flex-col border-r" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} aria-label="Main navigation"
    >
      <div className="flex items-center justify-between px-4 py-4">
        <Link to="/dashboard" className="flex items-center gap-2.5 overflow-hidden whitespace-nowrap text-lg font-bold" onClick={() => setMobileNav(false)}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-grad-hero text-white"><Icon name="checkcircle" size={20} /></span>
          {!isCollapsed && <span>TaskFlow</span>}
        </Link>
        {!mobile && (
          <button className="btn-ghost !p-1.5" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <Icon name={collapsed ? 'right' : 'left'} size={16} />
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {items.map((n) => (
          <NavLink key={n.to} to={n.to} onClick={() => setMobileNav(false)} title={n.label}
            className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-primary text-white' : 'hover:bg-primary/10'}`}>
            <span className="relative"><Icon name={n.icon} size={18} />{n.to === '/notifications' && unread > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-secondary" />}</span>
            {!isCollapsed && <span className="truncate">{n.label}</span>}
          </NavLink>
        ))}
        {!isCollapsed && showProjects && (
          <div className="pt-4">
            <p className="label px-3">Projects</p>
            {projects.slice(0, 8).map((p) => (
              <NavLink key={p._id} to={`/projects/${p._id}`} onClick={() => setMobileNav(false)}
                className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${isActive ? 'bg-primary/15 font-semibold' : 'hover:bg-primary/10'}`}>
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
                <span className="truncate">{p.name}</span>
              </NavLink>
            ))}
          </div>
        )}
      </nav>
    </motion.aside>
  );
}

const SHORTCUTS = [
  ['N', 'New task'], ['/', 'Search tasks'], ['K', 'Kanban board'], ['L', 'List view'], ['C', 'Calendar view'], ['F', 'Toggle today-only mode'], ['D', 'Dashboard'], ['?', 'Show this help'], ['Esc', 'Close dialogs'],
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { newTask, openTask, setView, setShortcutsOpen, shortcutsOpen, mobileNav, setMobileNav } = useUI();
  const { focusMode, setFocusMode } = useTasks();
  const nav = useNavigate();
  const loc = useLocation();
  const [params, setParams] = useSearchParams();
  const [menu, setMenu] = useState(false);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const menuRef = useRef(null);

  const toTasks = (v) => { setView(v); if (loc.pathname !== '/tasks') nav('/tasks'); };
  useShortcuts({
    n: () => newTask(),
    '/': () => { if (loc.pathname !== '/tasks') { nav('/tasks'); setTimeout(() => window.dispatchEvent(new Event('tf:focus-search')), 250); } else window.dispatchEvent(new Event('tf:focus-search')); },
    k: () => toTasks('kanban'),
    l: () => toTasks('list'),
    c: () => toTasks('calendar'),
    f: () => setFocusMode((f) => !f),
    d: () => nav('/dashboard'),
    '?': () => setShortcutsOpen(true),
  });

  // open a task from a notification link (/tasks?open=ID)
  useEffect(() => {
    const id = params.get('open');
    if (id) { openTask(id); params.delete('open'); setParams(params, { replace: true }); }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setMobileNav(false); setMenu(false); }, [loc.pathname, setMobileNav]);
  useEffect(() => {
    const h = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-white">Skip to content</a>
      {desktop && <Sidebar />}
      <AnimatePresence>
        {!desktop && mobileNav && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileNav(false)} />
            <motion.div className="fixed inset-y-0 left-0 z-50" initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}>
              <Sidebar mobile />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b px-3 py-2.5 sm:px-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          {!desktop && <button className="btn-ghost !p-2" onClick={() => setMobileNav(true)} aria-label="Open menu"><Icon name="menu" size={20} /></button>}
          <div className="flex-1" />
          <button
            onClick={() => setFocusMode((f) => !f)} aria-pressed={focusMode}
            className={`hidden items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition sm:flex ${focusMode ? 'border-accent bg-accent/15 text-accent' : ''}`} style={focusMode ? undefined : { borderColor: 'var(--border)' }}
            title="Show only tasks due today (F)"
          >
            <Icon name="target" size={14} /> Today only {focusMode ? 'on' : 'off'}
          </button>
          <Button onClick={() => newTask()} className="!px-3 sm:!px-4"><Icon name="plus" size={16} /><span className="hidden sm:inline">New task</span><span className="sr-only sm:hidden">New task</span></Button>
          <button className="btn-ghost hidden !p-2 sm:inline-flex" onClick={() => setShortcutsOpen(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)"><Icon name="keyboard" size={19} /></button>
          <ThemeToggle />
          <NotificationBell />
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} aria-label="Account menu" className="rounded-full">
              <Avatar user={user} size={34} />
            </button>
            <AnimatePresence>
              {menu && (
                <motion.div role="menu" initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} className="card absolute right-0 z-30 mt-2 w-56 p-2">
                  <div className="px-3 py-2"><p className="truncate text-sm font-bold">{user.name}</p><p className="muted truncate text-xs">{user.profile?.jobTitle || user.email}</p></div>
                  <Link role="menuitem" to="/profile" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-primary/10"><Icon name="user" size={15} /> Profile</Link>
                  <Link role="menuitem" to="/settings" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-primary/10"><Icon name="settings" size={15} /> Settings</Link>
                  <button role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-secondary hover:bg-secondary/10" onClick={logout}><Icon name="logout" size={15} /> Log out</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        <main id="main" className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait">
            <PageTransition key={loc.pathname}><Outlet /></PageTransition>
          </AnimatePresence>
        </main>
      </div>

      <TaskComposer />
      <TaskModal />
      <Modal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} title="Keyboard shortcuts">
        <ul className="space-y-2">
          {SHORTCUTS.map(([k, d]) => (
            <li key={k} className="flex items-center justify-between text-sm">
              <span>{d}</span>
              <kbd className="rounded-lg border px-2.5 py-1 font-mono text-xs font-bold" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>{k}</kbd>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
