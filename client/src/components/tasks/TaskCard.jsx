import { memo } from 'react';
import { motion } from 'framer-motion';
import { AvatarStack, PriorityBadge, ProgressBar } from '../ui';
import { formatDue, isOverdue, progressOf } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import Icon, { CategoryIcon } from '../ui/Icon';

/** Checkbox that morphs into a with a mint ripple. */
export function CompleteCheckbox({ done, onToggle, size = 24 }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? 'Mark as not done' : 'Mark as done'}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      onPointerDown={(e) => e.stopPropagation()}
      className="relative flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size }}
    >
      <motion.span
        className="absolute inset-0 rounded-full border-2"
        animate={{ borderColor: done ? '#3E9B73' : 'var(--muted)', scale: done ? 0 : 1, opacity: done ? 0 : 1 }}
        transition={{ duration: 0.2 }}
      />
      {done && (
        <>
          <motion.span className="absolute inset-0 rounded-full bg-accent/50" initial={{ scale: 0.5, opacity: 0.8 }} animate={{ scale: 2.4, opacity: 0 }} transition={{ duration: 0.6 }} />
          <motion.span className="relative leading-none" style={{ fontSize: size * 0.95 }} initial={{ scale: 0, rotate: -120 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}>
            <Icon name="checkcircle" size={size} className="text-accent" />
          </motion.span>
        </>
      )}
    </button>
  );
}

function TaskCardBase({ task, onOpen, onToggle, categories = [], dragging = false, index = 0 }) {
  const { user } = useAuth();
  const done = task.status === 'done';
  const overdue = isOverdue(task);
  const prog = progressOf(task);
  const cat = categories.find((c) => c.name === task.category);

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: done ? 0.7 : 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.3 }}
      whileHover={dragging ? undefined : { y: -3, boxShadow: '0 14px 30px -10px rgba(91,75,255,.5)' }}
      onClick={() => onOpen?.(task._id)}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen?.(task._id); }}
      aria-label={`${task.title}, ${task.priority} priority${overdue ? ', overdue' : ''}`}
      className="card relative cursor-pointer select-none p-3.5 text-left"
      style={{
        borderLeft: `4px solid ${overdue ? '#C8553D' : done ? '#3E9B73' : task.priority === 'high' ? '#C8553D' : task.priority === 'medium' ? '#F59E0B' : '#3E9B73'}`,
        ...(dragging ? { transform: 'rotate(3deg) scale(1.05)', boxShadow: '0 20px 40px -10px rgba(91,75,255,.6)' } : null),
        ...(overdue ? { background: 'color-mix(in srgb, #C8553D 8%, var(--surface))' } : null),
      }}
    >
      <div className="flex items-start gap-2.5">
        <CompleteCheckbox done={done} onToggle={() => onToggle?.(task)} />
        <div className="min-w-0 flex-1">
          <h3 className={`relative break-words text-sm font-semibold leading-snug ${done ? 'muted line-through' : ''}`}>{task.title}</h3>
          {task.description && !done && (
            <p className="muted mt-0.5 line-clamp-2 text-xs">{task.description.replace(/[#*_`>-]/g, '')}</p>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        {task.category && <span className="chip"><CategoryIcon icon={cat?.icon} size={12} /> {task.category}</span>}
        {task.recurring?.frequency !== 'none' && task.recurring?.frequency && <span className="chip" title={`Repeats ${task.recurring.frequency}`}><Icon name="repeat" size={12} /> {task.recurring.frequency}</span>}
        {task.tags?.slice(0, 2).map((t) => <span key={t} className="chip">#{t}</span>)}
      </div>

      {prog !== null && (
        <div className="mt-2.5 flex items-center gap-2">
          <ProgressBar value={prog} label="Subtasks complete" />
          <span className="muted text-[11px] font-medium">{task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}</span>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className={`text-xs font-medium ${overdue ? 'font-bold text-secondary' : 'muted'}`}>
          {task.dueDate ? `${overdue ? 'Overdue · ' : ''}${formatDue(task.dueDate)}` : ''}
        </span>
        <div className="flex items-center gap-2">
          {task.attachments?.length > 0 && <span className="muted flex items-center gap-1 text-xs"><Icon name="clip" size={12} /> {task.attachments.length}</span>}
          {task.createdBy && task.createdBy._id !== user?._id && !task.assignees?.length && <AvatarStack users={[task.createdBy]} size={22} />}
          <AvatarStack users={task.assignees} size={22} />
        </div>
      </div>
    </motion.article>
  );
}

export default memo(TaskCardBase);
