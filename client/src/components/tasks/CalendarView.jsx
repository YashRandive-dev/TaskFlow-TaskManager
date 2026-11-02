import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek,
} from 'date-fns';
import Icon from '../ui/Icon';
import { PRIORITIES } from '../../utils/constants';
import { isOverdue, timeFmt } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

export default function CalendarView({ tasks, onOpen, onCreate }) {
  const { user } = useAuth();
  const weekStartsOn = user.preferences?.weekStart === 'sunday' ? 0 : 1;
  const dayLabels = weekStartsOn === 0 ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const [mode, setMode] = useState('month');
  const [cursor, setCursor] = useState(new Date());

  const days = useMemo(() => {
    const start = mode === 'month' ? startOfWeek(startOfMonth(cursor), { weekStartsOn }) : startOfWeek(cursor, { weekStartsOn });
    const end = mode === 'month' ? endOfWeek(endOfMonth(cursor), { weekStartsOn }) : endOfWeek(cursor, { weekStartsOn });
    return eachDayOfInterval({ start, end });
  }, [cursor, mode, weekStartsOn]);

  const byDay = useMemo(() => {
    const m = {};
    tasks.forEach((t) => {
      if (!t.dueDate) return;
      const k = format(new Date(t.dueDate), 'yyyy-MM-dd');
      (m[k] ||= []).push(t);
    });
    return m;
  }, [tasks]);

  const step = (dir) => setCursor((c) => (mode === 'month' ? addMonths(c, dir) : addWeeks(c, dir)));
  const noDue = tasks.filter((t) => !t.dueDate).length;

  return (
    <div className="card p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button className="btn-outline !px-3" onClick={() => step(-1)} aria-label="Previous"><Icon name="left" size={16} /></button>
          <button className="btn-outline" onClick={() => setCursor(new Date())}>Today</button>
          <button className="btn-outline !px-3" onClick={() => step(1)} aria-label="Next"><Icon name="right" size={16} /></button>
        </div>
        <h2 className="text-lg font-bold">{format(cursor, mode === 'month' ? 'MMMM yyyy' : "'Week of' MMM d, yyyy")}</h2>
        <div className="flex rounded-xl border p-0.5" style={{ borderColor: 'var(--border)' }} role="tablist" aria-label="Calendar mode">
          {['month', 'week'].map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${mode === m ? 'bg-primary text-white' : ''}`}>{m}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {dayLabels.map((d) => <div key={d} className="label !mb-0 py-1">{d}</div>)}
        <AnimatePresence mode="popLayout">
          {days.map((d) => {
            const items = byDay[format(d, 'yyyy-MM-dd')] || [];
            const dim = mode === 'month' && !isSameMonth(d, cursor);
            return (
              <motion.div
                key={d.toISOString()} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: dim ? 0.45 : 1, scale: 1 }}
                className={`fc-day group relative rounded-xl border p-1 text-left ${mode === 'week' ? '!min-h-[260px]' : ''}`}
                style={{ borderColor: isToday(d) ? 'var(--primary)' : 'var(--border)', background: isToday(d) ? 'color-mix(in srgb, var(--primary) 8%, var(--surface))' : 'var(--surface)' }}
              >
                <div className="flex items-center justify-between px-1">
                  <span className={`text-xs font-bold ${isToday(d) ? 'rounded-full bg-primary px-1.5 text-white' : ''}`}>{format(d, 'd')}</span>
                  <button className="rounded-md px-1 text-xs opacity-0 transition hover:bg-primary/10 group-hover:opacity-100 focus:opacity-100" onClick={() => onCreate(d)} aria-label={`Add task on ${format(d, 'MMM d')}`}><Icon name="plus" size={13} /></button>
                </div>
                <div className="mt-1 space-y-1">
                  {items.slice(0, mode === 'week' ? 12 : 3).map((t) => (
                    <button
                      key={t._id} onClick={() => onOpen(t._id)} title={t.title}
                      className={`block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium ${t.status === 'done' ? 'line-through opacity-60' : ''}`}
                      style={{ background: `${isOverdue(t) ? '#C8553D' : PRIORITIES[t.priority].color}26`, color: isOverdue(t) ? '#C8553D' : 'var(--text)', borderLeft: `3px solid ${PRIORITIES[t.priority].color}` }}
                    >
                      {format(new Date(t.dueDate), timeFmt(true)).toLowerCase()} {t.title}
                    </button>
                  ))}
                  {items.length > 3 && mode === 'month' && <span className="muted block px-1 text-[10px]">+{items.length - 3} more</span>}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {noDue > 0 && <p className="muted mt-3 text-xs">{noDue} task{noDue > 1 ? 's have' : ' has'} no due date and isn&apos;t shown here.</p>}
    </div>
  );
}
