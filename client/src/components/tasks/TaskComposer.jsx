import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Modal } from '../ui';
import Icon, { CategoryIcon } from '../ui/Icon';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { useUI } from '../../context/UIContext';
import { DEFAULT_CATEGORIES, PRIORITIES, SUGGESTIONS, TASK_TYPES } from '../../utils/constants';

const endOfDay = (time) => {
  const d = new Date();
  if (time) { const [h, m] = time.split(':').map(Number); d.setHours(h, m, 0, 0); } else d.setHours(23, 59, 0, 0);
  return d;
};

/** Minimal "new task" dialog: a title, what kind of task it is, and nothing else. */
export default function TaskComposer() {
  const { taskModal, closeTask } = useUI();
  const { user } = useAuth();
  const { createTask } = useTasks();
  const open = taskModal.open && !taskModal.taskId;
  const defaults = taskModal.defaults || {};
  const categories = user.categories?.length ? user.categories : DEFAULT_CATEGORIES;

  const [title, setTitle] = useState('');
  const [type, setType] = useState('today');
  const [when, setWhen] = useState('');
  const [time, setTime] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('medium');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(''); setWhen(''); setTime(''); setBusy(false);
    setType(defaults.dueDate ? 'scheduled' : 'today');
    if (defaults.dueDate) setWhen(defaults.dueDate);
    setCategory('');
    setPriority(user.preferences?.defaultPriority || 'medium');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestions = useMemo(
    () => (user.purposes?.length ? user.purposes : ['personal']).flatMap((p) => (SUGGESTIONS[p] || []).slice(0, 2).map((s) => ({ ...s, purpose: p }))).slice(0, 6),
    [user.purposes]
  );

  const applySuggestion = (s) => {
    setTitle(s.title);
    setType(s.type);
    const cat = categories.find((c) => c.name.toLowerCase() === s.purpose);
    if (cat) setCategory(cat.name);
  };

  const submit = async () => {
    if (!title.trim()) { toast.error('Enter a task title'); return; }
    if (type === 'scheduled' && !when) { toast.error('Choose a date and time'); return; }
    let dueDate = null;
    let recurring = 'none';
    if (type === 'scheduled') dueDate = new Date(when).toISOString();
    else if (type !== 'anytime') {
      dueDate = endOfDay(time).toISOString();
      if (['daily', 'weekly', 'monthly'].includes(type)) recurring = type;
    }
    setBusy(true);
    try {
      const { dueDate: _skip, ...rest } = defaults;
      await createTask({ ...rest, title: title.trim(), priority, category, dueDate, recurring });
      closeTask();
    } catch { /* toast shown by context */ } finally { setBusy(false); }
  };

  return (
    <Modal
      open={open} onClose={closeTask} title="New task"
      footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={closeTask}>Cancel</Button><Button onClick={submit} loading={busy}>Add task</Button></div>}
    >
      <div className="space-y-5">
        <input
          className="input text-base" autoFocus value={title} maxLength={200} placeholder="What do you need to do?" aria-label="Task title"
          onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        {!title && suggestions.length > 0 && (
          <div>
            <p className="label">Suggestions for you</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button key={s.title} type="button" onClick={() => applySuggestion(s)} className="chip transition hover:bg-primary/15">
                  <Icon name="plus" size={12} /> {s.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="label">Task type</p>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6" role="radiogroup" aria-label="Task type">
            {TASK_TYPES.map((t) => (
              <button
                key={t.id} type="button" role="radio" aria-checked={type === t.id} title={t.hint} onClick={() => setType(t.id)}
                className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${type === t.id ? 'border-primary bg-primary text-white' : 'hover:border-primary'}`}
                style={type === t.id ? undefined : { borderColor: 'var(--border)' }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="muted mt-1.5 text-xs">{TASK_TYPES.find((t) => t.id === type).hint}</p>
        </div>

        {type === 'scheduled' && (
          <input type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Due date and time" />
        )}
        {['today', 'daily', 'weekly', 'monthly'].includes(type) && (
          <label className="flex items-center gap-3 text-sm">
            <span className="muted">Time (optional)</span>
            <input type="time" className="input !w-auto" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="label">Category</p>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c.name} type="button" aria-pressed={category === c.name} onClick={() => setCategory(category === c.name ? '' : c.name)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${category === c.name ? 'border-primary bg-primary/10 text-primary' : 'hover:border-primary'}`}
                  style={category === c.name ? undefined : { borderColor: 'var(--border)' }}
                >
                  <CategoryIcon icon={c.icon} size={13} /> {c.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Priority</p>
            <div className="flex gap-1.5">
              {Object.entries(PRIORITIES).map(([k, p]) => (
                <button
                  key={k} type="button" aria-pressed={priority === k} onClick={() => setPriority(k)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl border px-2 py-1.5 text-xs font-semibold transition"
                  style={priority === k ? { background: `${p.color}22`, borderColor: p.color, color: p.color } : { borderColor: 'var(--border)' }}
                >
                  <Icon name="flag" size={12} /> {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
