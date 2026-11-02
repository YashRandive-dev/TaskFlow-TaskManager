import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CompleteCheckbox } from './TaskCard';
import { AvatarStack, EmptyState, PriorityBadge, ProgressBar } from '../ui';
import { PRIORITIES, STATUSES } from '../../utils/constants';
import { formatDue, isOverdue, progressOf, toLocalInput } from '../../utils/helpers';
import Icon, { CategoryIcon } from '../ui/Icon';

const COLS = [
  { key: 'title', label: 'Task', sortable: true },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority', sortable: true },
  { key: 'dueDate', label: 'Due', sortable: true },
  { key: 'progress', label: 'Progress' },
  { key: 'who', label: 'Who' },
];

function Row({ task, i, categories, onOpen, onToggle, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const done = task.status === 'done';
  const overdue = isOverdue(task);
  const prog = progressOf(task);
  const cat = categories.find((c) => c.name === task.category);

  const saveTitle = () => {
    setEditing(false);
    const t = title.trim();
    if (t && t !== task.title) onUpdate(task._id, { title: t }, { quiet: true });
    else setTitle(task.title);
  };

  return (
    <motion.div
      layout initial={{ opacity: 0, x: -16 }} animate={{ opacity: done ? 0.7 : 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
      transition={{ delay: Math.min(i, 10) * 0.025 }}
      className="grid grid-cols-[auto_1fr_auto_auto] transition-colors hover:bg-primary/5 items-center gap-3 border-b px-3 py-2.5 xl:grid-cols-[28px_minmax(0,2.4fr)_130px_110px_150px_110px_90px_36px]"
      style={{ borderColor: 'var(--border)', background: overdue ? 'color-mix(in srgb, #C8553D 8%, var(--surface))' : undefined }}
      role="row"
    >
      <CompleteCheckbox done={done} onToggle={() => onToggle(task)} />
      <div className="min-w-0">
        {editing ? (
          <input
            autoFocus className="input !py-1" value={title} onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle} onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(task.title); setEditing(false); } }}
            aria-label="Edit task title"
          />
        ) : (
          <button className={`block w-full truncate text-left text-sm font-semibold ${done ? 'muted line-through' : ''}`} onClick={() => onOpen(task._id)} onDoubleClick={() => setEditing(true)} title="Click to open · double-click to rename">
            {task.title}
          </button>
        )}
        <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs">
          {task.category && <span className="chip"><CategoryIcon icon={cat?.icon} size={12} /> {task.category}</span>}
          {task.project && <span className="chip">{task.project.name}</span>}
          {task.recurring?.frequency && task.recurring.frequency !== 'none' && <span className="chip"><Icon name="repeat" size={12} /> {task.recurring.frequency}</span>}
        </div>
      </div>

      <select className="input hidden !w-auto !py-1 text-xs xl:block" value={task.status} aria-label="Status" onChange={(e) => onUpdate(task._id, { status: e.target.value }, { quiet: true })}>
        {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <select className="input hidden !w-auto !py-1 text-xs xl:block" value={task.priority} aria-label="Priority" onChange={(e) => onUpdate(task._id, { priority: e.target.value }, { quiet: true })}>
        {Object.entries(PRIORITIES).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
      </select>
      <input
        type="datetime-local" className={`input hidden !w-auto !py-1 text-xs xl:block ${overdue ? '!border-secondary !text-secondary' : ''}`}
        value={toLocalInput(task.dueDate)} aria-label="Due date"
        onChange={(e) => onUpdate(task._id, { dueDate: e.target.value ? new Date(e.target.value).toISOString() : null }, { quiet: true })}
      />
      <div className="hidden xl:block">{prog !== null ? <ProgressBar value={prog} /> : <span className="muted text-xs">—</span>}</div>
      <div className="hidden xl:block"><AvatarStack users={task.assignees} size={24} /></div>

      {/* compact mobile meta */}
      <div className="flex flex-col items-end gap-1 xl:hidden">
        <PriorityBadge priority={task.priority} />
        {task.dueDate && <span className={`text-[11px] ${overdue ? 'font-bold text-secondary' : 'muted'}`}>{formatDue(task.dueDate)}</span>}
      </div>
      <button className="btn-ghost !p-1.5 text-secondary" onClick={() => onDelete(task._id)} aria-label={`Delete ${task.title}`}><Icon name="trash" size={16} /></button>
    </motion.div>
  );
}

export default function ListView({ tasks, categories, sort, order, onSort, onOpen, onToggle, onUpdate, onDelete }) {
  if (!tasks.length) return <EmptyState icon="checklist" title="No tasks here" hint="Nothing matches here. Add a task or clear your filters." />;
  return (
    <div className="card overflow-hidden" role="table" aria-label="Task list">
      <div className="hidden grid-cols-[28px_minmax(0,2.4fr)_130px_110px_150px_110px_90px_36px] gap-3 border-b px-3 py-2.5 xl:grid" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }} role="row">
        <span />
        {COLS.map((c) => (
          <button key={c.key} disabled={!c.sortable} onClick={() => onSort(c.key === 'title' ? 'title' : c.key)} className="label !mb-0 text-left disabled:cursor-default" role="columnheader" aria-sort={sort === c.key ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}>
            {c.label} {sort === c.key ? (order === 'asc' ? '▲' : '▼') : ''}
          </button>
        ))}
        <span />
      </div>
      <AnimatePresence initial={false}>
        {tasks.map((t, i) => <Row key={t._id} task={t} i={i} categories={categories} onOpen={onOpen} onToggle={onToggle} onUpdate={onUpdate} onDelete={onDelete} />)}
      </AnimatePresence>
    </div>
  );
}
