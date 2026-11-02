import { forwardRef, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { parseQuickAdd } from '../../utils/nlp';
import { PRIORITIES } from '../../utils/constants';
import Icon from '../ui/Icon';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';

/** Natural-language quick add: "Call mom tomorrow 5pm #personal !high" */
const QuickAdd = forwardRef(function QuickAdd({ defaults = {}, className = '' }, ref) {
  const { user } = useAuth();
  const { createTask } = useTasks();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => (text.trim() ? parseQuickAdd(text, user?.categories || []) : null), [text, user]);

  const submit = async (e) => {
    e.preventDefault();
    if (!parsed?.title) return;
    setBusy(true);
    try {
      await createTask({
        ...defaults,
        title: parsed.title,
        priority: parsed.priority || 'medium',
        category: parsed.category,
        tags: parsed.tags,
        recurring: parsed.recurring,
        dueDate: parsed.dueDate ? parsed.dueDate.toISOString() : null,
      });
      setText('');
    } catch { /* toast already shown */ } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className={className} aria-label="Quick add task">
      <div className="card flex items-center gap-2 p-1.5 pl-3 focus-within:ring-2 focus-within:ring-primary/40">
        <Icon name="zap" size={17} className="text-primary" />
        <input
          ref={ref} value={text} onChange={(e) => setText(e.target.value)}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
          placeholder='Quick add: "Call mom tomorrow 5pm #personal !high"' aria-label="Quick add a task"
        />
        <button className="btn-primary !py-2" disabled={!parsed?.title || busy}>{busy ? 'Adding' : 'Add'}</button>
      </div>
      {parsed?.title && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1 text-xs">
          <span className="muted">Detected:</span>
          <span className="chip font-semibold">{parsed.title}</span>
          {parsed.dueDate && <span className="chip">{format(parsed.dueDate, 'EEE, MMM d · h:mm a')}</span>}
          {parsed.category && <span className="chip">{parsed.category}</span>}
          {parsed.priority && <span className="chip">{PRIORITIES[parsed.priority].label}</span>}
          {parsed.recurring !== 'none' && <span className="chip">Repeats {parsed.recurring}</span>}
          {parsed.tags.map((t) => <span key={t} className="chip">#{t}</span>)}
        </div>
      )}
    </form>
  );
});

export default QuickAdd;
