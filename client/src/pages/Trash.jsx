import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api/axios';
import { useTasks } from '../context/TaskContext';
import { Button, EmptyState, TaskSkeletons } from '../components/ui';
import { PRIORITIES } from '../utils/constants';
import Icon from '../components/ui/Icon';

export default function Trash() {
  const { fetchTasks } = useTasks();
  const [tab, setTab] = useState('archive');
  const [items, setItems] = useState(null);

  const load = useCallback(async () => {
    setItems(null);
    try {
      const r = await api.get('/tasks', { params: tab === 'trash' ? { trash: 'true' } : { archived: 'true' }, limit: 200 });
      setItems(r.data.data.tasks);
    } catch (e) { toast.error(errMsg(e)); setItems([]); }
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, msg, id) => {
    try { await fn(); toast.success(msg); setItems((p) => p.filter((t) => t._id !== id)); fetchTasks(true); } catch (e) { toast.error(errMsg(e)); }
  };
  const emptyTrash = async () => {
    if (!window.confirm('Permanently delete everything in the trash?')) return;
    try { await api.delete('/tasks/trash/empty'); toast.success('Trash emptied'); setItems([]); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold sm:text-3xl">Trash & Archive</h1><p className="muted text-sm">Restore tasks or remove them for good.</p></div>
        {tab === 'trash' && items?.length > 0 && <Button variant="danger" onClick={emptyTrash}>Empty trash</Button>}
      </div>
      <div className="mb-4 flex gap-1" role="tablist">
        {[['archive', 'Archive'], ['trash', 'Trash']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === k ? 'bg-primary text-white shadow-glow' : 'hover:bg-primary/10'}`}>{l}</button>
        ))}
      </div>

      {items === null ? <TaskSkeletons count={3} /> : items.length === 0 ? (
        <div className="card"><EmptyState icon={tab === 'trash' ? 'sparkles' : 'inbox'} title={tab === 'trash' ? 'Trash is empty' : 'Nothing archived'} hint={tab === 'trash' ? 'Deleted tasks wait here until you remove them for good.' : 'Archive finished tasks to keep your board tidy.'} /></div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {items.map((t) => (
              <motion.li key={t._id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30 }} className="card flex flex-wrap items-center gap-3 p-3.5">
                <Icon name="flag" size={16} style={{ color: PRIORITIES[t.priority].color }} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-semibold ${t.status === 'done' ? 'line-through opacity-70' : ''}`}>{t.title}</p>
                  <p className="muted text-xs">{t.category || 'No category'}{t.project ? ` · ${t.project.name}` : ''}</p>
                </div>
                <Button variant="outline" className="!py-1.5" onClick={() => act(() => api.patch(`/tasks/${t._id}/restore`), 'Task restored', t._id)}>Restore</Button>
                <Button variant="ghost" className="!py-1.5 !text-secondary" onClick={() => { if (window.confirm('Delete permanently? This cannot be undone.')) act(() => api.delete(`/tasks/${t._id}`, { params: { permanent: true } }), 'Deleted forever', t._id); }}>Delete forever</Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
