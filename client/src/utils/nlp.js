import { addDays, addWeeks, addMonths, setHours, setMinutes, startOfDay, nextDay } from 'date-fns';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const parseTime = (text) => {
  // 5pm, 5:30pm, 17:30, at 5
  const m = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) || text.match(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const mer = m[3]?.toLowerCase();
  if (mer === 'pm' && h < 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  if (h > 23) return null;
  return { h, min, raw: m[0] };
};

/**
 * "Call mom tomorrow 5pm #personal !high" ->
 * { title: 'Call mom', dueDate: Date, category: 'Personal', priority: 'high', tags: [] }
 */
export function parseQuickAdd(input, categories = []) {
  let text = ` ${input} `;
  const out = { title: '', priority: undefined, category: '', tags: [], dueDate: null, recurring: 'none' };

  const pr = text.match(/\s!(high|h|medium|med|m|low|l)\b/i);
  if (pr) {
    const k = pr[1].toLowerCase()[0];
    out.priority = { h: 'high', m: 'medium', l: 'low' }[k];
    text = text.replace(pr[0], ' ');
  }

  const hashes = [...text.matchAll(/\s#([\w-]+)/g)];
  hashes.forEach((h) => {
    const name = h[1].toLowerCase();
    const cat = categories.find((c) => c.name.toLowerCase() === name);
    if (cat && !out.category) out.category = cat.name;
    else out.tags.push(h[1]);
    text = text.replace(h[0], ' ');
  });

  const rec = text.match(/\severy\s+(day|week|month)\b/i) || text.match(/\s(daily|weekly|monthly)\b/i);
  if (rec) {
    const w = rec[1].toLowerCase();
    out.recurring = w.startsWith('day') || w === 'daily' ? 'daily' : w.startsWith('week') ? 'weekly' : 'monthly';
    text = text.replace(rec[0], ' ');
  }

  const now = new Date();
  let date = null;
  const t = parseTime(text);
  if (t) text = text.replace(t.raw, ' ');

  const rel = [
    [/\s(today|tonight)\b/i, () => now],
    [/\s(tomorrow|tmrw)\b/i, () => addDays(now, 1)],
    [/\sin\s+(\d+)\s+days?\b/i, (m) => addDays(now, +m[1])],
    [/\sin\s+(\d+)\s+weeks?\b/i, (m) => addWeeks(now, +m[1])],
    [/\sin\s+(\d+)\s+months?\b/i, (m) => addMonths(now, +m[1])],
    [/\snext\s+week\b/i, () => addWeeks(now, 1)],
    [/\snext\s+month\b/i, () => addMonths(now, 1)],
  ];
  for (const [rx, fn] of rel) {
    const m = text.match(rx);
    if (m) { date = fn(m); text = text.replace(m[0], ' '); break; }
  }
  if (!date) {
    const m = text.match(new RegExp(`\\s(?:on\\s+|next\\s+)?(${DAYS.join('|')}|${DAYS.map((d) => d.slice(0, 3)).join('|')})\\b`, 'i'));
    if (m) {
      const idx = DAYS.findIndex((d) => d === m[1].toLowerCase() || d.slice(0, 3) === m[1].toLowerCase());
      date = nextDay(now, idx);
      text = text.replace(m[0], ' ');
    }
  }

  if (date || t) {
    date = date || now;
    date = t ? setMinutes(setHours(date, t.h), t.min) : setHours(setMinutes(startOfDay(date), 0), 9);
    if (!date.getSeconds) date = new Date(date);
    date.setSeconds(0, 0);
    out.dueDate = date;
  }

  out.title = text.replace(/\s+/g, ' ').replace(/\b(on|at|by|due)$/i, '').trim();
  return out;
}
