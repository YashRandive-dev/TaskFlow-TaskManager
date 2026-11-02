import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api/axios';
import { useAuth } from './AuthContext';
import { celebrate } from '../utils/helpers';
import { STATUS_MAP } from '../utils/constants';

const TaskContext = createContext(null);
export const useTasks = () => useContext(TaskContext);

export const EMPTY_FILTERS = {
  search: '', priority: [], status: [], category: [], project: '', due: '', from: '', to: '', sort: 'position', order: 'asc', assignee: '',
};

const toParams = (f, extra = {}) => {
  const p = { ...extra };
  Object.entries(f).forEach(([k, v]) => {
    if (Array.isArray(v)) { if (v.length) p[k] = v.join(','); } else if (v) p[k] = v;
  });
  return p;
};

export function TaskProvider({ children }) {
  const { user, socket } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [focusMode, setFocusMode] = useState(false);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const focusRef = useRef(focusMode);
  focusRef.current = focusMode;

  const fetchTasks = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const extra = focusRef.current ? { due: 'today' } : {};
      const r = await api.get('/tasks', { params: toParams(filtersRef.current, extra) });
      setTasks(r.data.data.tasks);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchTasks(); }, [fetchTasks, filters, focusMode]);

  const upsert = useCallback((task) => {
    setTasks((prev) => (prev.some((t) => t._id === task._id) ? prev.map((t) => (t._id === task._id ? task : t)) : prev));
  }, []);

  // ---------- real-time ----------
  useEffect(() => {
    if (!socket) return undefined;
    const mine = (e) => e.actorId === user?._id;
    const onCreated = (e) => { if (!mine(e)) fetchTasks(true); };
    const onUpdated = (e) => {
      upsert(e.task);
      if (!mine(e) && e.actorName) toast(`${e.actorName} updated "${e.task.title}"`, { id: `rt-${e.task._id}` });
    };
    const onMoved = (e) => {
      upsert(e.task);
      if (!mine(e)) toast(`${e.actorName || 'Someone'} moved "${e.task.title}" to ${STATUS_MAP[e.task.status].label}`);
    };
    const onDeleted = (e) => setTasks((prev) => prev.filter((t) => t._id !== e.id));
    const onReordered = (e) => {
      if (mine(e)) return;
      const pos = Object.fromEntries(e.items.map((i) => [i.id, i.position]));
      setTasks((prev) => prev.map((t) => (pos[t._id] !== undefined ? { ...t, position: pos[t._id] } : t)));
    };
    const onComment = (e) => {
      if (!mine(e)) toast(`${e.actorName} commented on "${e.title}"`);
      window.dispatchEvent(new CustomEvent('tf:comment', { detail: e }));
    };
    socket.on('task:created', onCreated);
    socket.on('task:updated', onUpdated);
    socket.on('task:moved', onMoved);
    socket.on('task:deleted', onDeleted);
    socket.on('task:reordered', onReordered);
    socket.on('comment:added', onComment);
    return () => {
      socket.off('task:created', onCreated);
      socket.off('task:updated', onUpdated);
      socket.off('task:moved', onMoved);
      socket.off('task:deleted', onDeleted);
      socket.off('task:reordered', onReordered);
      socket.off('comment:added', onComment);
    };
  }, [socket, user?._id, fetchTasks, upsert]);

  // ---------- actions ----------
  const createTask = useCallback(async (data) => {
    try {
      const r = await api.post('/tasks', data);
      toast.success('Task created');
      if (r.data.data.status === 'done') celebrate();
      await fetchTasks(true);
      return r.data.data;
    } catch (e) { toast.error(`${errMsg(e)}`); throw e; }
  }, [fetchTasks]);

  const updateTask = useCallback(async (id, data, { quiet } = {}) => {
    try {
      const wasDone = tasks.find((t) => t._id === id)?.status === 'done';
      const r = await api.put(`/tasks/${id}`, data);
      upsert(r.data.data);
      if (!quiet) toast.success('Task updated');
      if (data.status === 'done' && !wasDone) { celebrate(); toast.success('Task completed!'); }
      return r.data.data;
    } catch (e) { toast.error(`${errMsg(e)}`); throw e; }
  }, [tasks, upsert]);

  const changeStatus = useCallback(async (id, status, position) => {
    const prev = tasks;
    const old = tasks.find((t) => t._id === id);
    if (!old) return null;
    setTasks((ts) => ts.map((t) => (t._id === id ? { ...t, status, position: position ?? t.position, completedAt: status === 'done' ? new Date().toISOString() : null } : t)));
    try {
      const r = await api.patch(`/tasks/${id}/status`, { status, position });
      upsert(r.data.data);
      if (status === 'done' && old.status !== 'done') { celebrate(); toast.success('Task completed! Great job!'); }
      return r.data.data;
    } catch (e) {
      setTasks(prev);
      toast.error(`${errMsg(e)}`);
      return null;
    }
  }, [tasks, upsert]);

  const reorder = useCallback(async (items) => {
    const pos = Object.fromEntries(items.map((i) => [i.id, i.position]));
    setTasks((ts) => ts.map((t) => (pos[t._id] !== undefined ? { ...t, position: pos[t._id] } : t)));
    try { await api.patch('/tasks/reorder', { items }); } catch (e) { toast.error(errMsg(e)); fetchTasks(true); }
  }, [fetchTasks]);

  const restoreTask = useCallback(async (id) => {
    try {
      await api.patch(`/tasks/${id}/restore`);
      toast.success('Task restored');
      fetchTasks(true);
    } catch (e) { toast.error(errMsg(e)); }
  }, [fetchTasks]);

  const deleteTask = useCallback(async (id) => {
    const t = tasks.find((x) => x._id === id);
    try {
      await api.delete(`/tasks/${id}`);
      setTasks((ts) => ts.filter((x) => x._id !== id));
      toast((tt) => (
        <span className="flex items-center gap-3 text-sm">
          Deleted{t ? ` "${t.title.slice(0, 24)}"` : ''}
          <button
            className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-white"
            onClick={() => { toast.dismiss(tt.id); restoreTask(id); }}
          >
            Undo
          </button>
        </span>
      ), { duration: 5000 });
    } catch (e) { toast.error(errMsg(e)); }
  }, [tasks, restoreTask]);

  const archiveTask = useCallback(async (id, archived = true) => {
    try {
      await api.patch(`/tasks/${id}/archive`, { archived });
      setTasks((ts) => ts.filter((x) => x._id !== id));
      toast.success(archived ? 'Archived' : 'Unarchived');
    } catch (e) { toast.error(errMsg(e)); }
  }, []);

  const value = useMemo(() => ({
    tasks, loading, filters, setFilters, focusMode, setFocusMode, fetchTasks,
    createTask, updateTask, changeStatus, reorder, deleteTask, archiveTask, restoreTask, upsert,
  }), [tasks, loading, filters, focusMode, fetchTasks, createTask, updateTask, changeStatus, reorder, deleteTask, archiveTask, restoreTask, upsert]);

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}
