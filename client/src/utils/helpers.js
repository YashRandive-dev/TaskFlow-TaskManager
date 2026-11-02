import confetti from 'canvas-confetti';
import { format, isToday, isTomorrow, isPast, isThisYear } from 'date-fns';

// User time-format preference ('12h' | '24h'), set from AuthContext so every formatter agrees.
let use24h = false;
export const setTimeFormat = (v) => { use24h = v === '24h'; };
export const timeFmt = (compact = false) => (use24h ? 'HH:mm' : compact ? 'h:mma' : 'h:mm a');

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const celebrate = () => {
  if (reducedMotion()) return;
  const colors = ['#3B6EA8', '#C8553D', '#3E9B73'];
  confetti({ particleCount: 90, spread: 75, origin: { y: 0.65 }, colors });
  setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors }), 150);
  setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors }), 250);
};

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return { text: 'Working late', emoji: '' };
  if (h < 12) return { text: 'Good morning', emoji: '' };
  if (h < 17) return { text: 'Good afternoon', emoji: '' };
  if (h < 21) return { text: 'Good evening', emoji: '' };
  return { text: 'Good night', emoji: '' };
};

export const isOverdue = (t) => !!t.dueDate && t.status !== 'done' && isPast(new Date(t.dueDate));

export const formatDue = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const time = format(date, timeFmt());
  if (isToday(date)) return `Today, ${time}`;
  if (isTomorrow(date)) return `Tomorrow, ${time}`;
  return format(date, `${isThisYear(date) ? 'MMM d' : 'MMM d yyyy'}, ${timeFmt()}`);
};

/** ISO -> value for <input type="datetime-local"> in local time */
export const toLocalInput = (d) => (d ? format(new Date(d), "yyyy-MM-dd'T'HH:mm") : '');

export const formatMinutes = (m = 0) => {
  if (!m) return '0m';
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h ? `${h}h${r ? ` ${r}m` : ''}` : `${r}m`;
};

export const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';

export const progressOf = (t) => {
  const s = t.subtasks || [];
  return s.length ? Math.round((s.filter((x) => x.done).length / s.length) * 100) : null;
};

export const downloadBlob = (data, filename) => {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
