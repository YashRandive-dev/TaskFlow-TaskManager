import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Button, EmptyState } from '../components/ui';
import { celebrate, formatMinutes } from '../utils/helpers';
import Icon from '../components/ui/Icon';

const beep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 660; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.15, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.22);
    });
  } catch { /* audio unavailable */ }
};

export default function Focus() {
  const { user, setUser } = useAuth();
  const [params] = useSearchParams();
  const cfg = user.preferences?.pomodoro || { work: 25, shortBreak: 5, longBreak: 15 };
  const MODES = { work: { label: 'Focus', icon: 'timer', min: cfg.work }, short: { label: 'Short break', icon: 'coffee', min: cfg.shortBreak }, long: { label: 'Long break', icon: 'coffee', min: cfg.longBreak } };

  const [mode, setMode] = useState('work');
  const [left, setLeft] = useState(cfg.work * 60);
  const [running, setRunning] = useState(false);
  const [rounds, setRounds] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [taskId, setTaskId] = useState(params.get('task') || '');
  const [sessionMin, setSessionMin] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cfg);
  const endRef = useRef(null);

  useEffect(() => {
    api.get('/tasks', { params: { status: 'todo,inprogress,review', sort: 'priority', order: 'desc' } })
      .then((r) => setTasks(r.data.data.tasks)).catch(() => {});
  }, []);

  const reset = useCallback((m) => { setRunning(false); setMode(m); setLeft(MODES[m].min * 60); }, [cfg.work, cfg.shortBreak, cfg.longBreak]); // eslint-disable-line react-hooks/exhaustive-deps

  const complete = useCallback(async () => {
    beep();
    if (mode === 'work') {
      const n = rounds + 1;
      setRounds(n);
      setSessionMin((m) => m + cfg.work);
      celebrate();
      toast.success(`Pomodoro #${n} complete! Time for a break.`);
      if (taskId) {
        try {
          const r = await api.patch(`/tasks/${taskId}/time`, { minutes: cfg.work });
          setTasks((ts) => ts.map((t) => (t._id === taskId ? r.data.data : t)));
        } catch (e) { toast.error(errMsg(e)); }
      }
      reset(n % 4 === 0 ? 'long' : 'short');
    } else {
      toast('Break over — ready to focus?');
      reset('work');
    }
    if ('Notification' in window && Notification.permission === 'granted') new Notification('TaskFlow', { body: mode === 'work' ? 'Focus session done!' : 'Break is over!' });
  }, [mode, rounds, taskId, cfg.work, reset]);

  // Skipping moves to the next phase without crediting time or celebrating
  const skip = () => reset(mode === 'work' ? (rounds % 4 === 3 ? 'long' : 'short') : 'work');

  // wall-clock based so background tabs stay accurate
  useEffect(() => {
    if (!running) return undefined;
    endRef.current = Date.now() + left * 1000;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) { clearInterval(id); complete(); }
    }, 250);
    return () => clearInterval(id);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { document.title = running ? `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')} · TaskFlow` : 'TaskFlow'; return () => { document.title = 'TaskFlow'; }; }, [left, running, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = MODES[mode].min * 60;
  const pct = total ? (1 - left / total) * 100 : 0;
  const R = 120; const C = 2 * Math.PI * R;
  const task = tasks.find((t) => t._id === taskId);

  const saveCfg = async () => {
    const pomodoro = { work: +draft.work || 25, shortBreak: +draft.shortBreak || 5, longBreak: +draft.longBreak || 15 };
    try {
      const r = await api.put('/users/me', { preferences: JSON.stringify({ pomodoro }) });
      setUser(r.data.data);
      setEditing(false);
      setRunning(false); setLeft(({ work: pomodoro.work, short: pomodoro.shortBreak, long: pomodoro.longBreak })[mode] * 60);
      toast.success('Timer settings saved');
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Focus</h1>
      <p className="muted mb-5 text-sm">Work in focused sprints and log the time to a task automatically.</p>

      <div className="card p-6 text-center sm:p-8">
        <div className="mb-6 inline-flex rounded-2xl border p-1" style={{ borderColor: 'var(--border)' }} role="tablist">
          {Object.entries(MODES).map(([k, m]) => (
            <button key={k} role="tab" aria-selected={mode === k} onClick={() => reset(k)} className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${mode === k ? 'bg-primary text-white' : 'hover:bg-primary/10'}`}>{m.label}</button>
          ))}
        </div>

        <div className="relative mx-auto h-[280px] w-[280px]" role="timer" aria-live="off" aria-label={`${Math.floor(left / 60)} minutes ${left % 60} seconds remaining`}>
          <svg viewBox="0 0 280 280" className="-rotate-90">
            <defs><linearGradient id="timerG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={mode === 'work' ? '#3B6EA8' : '#3E9B73'} /><stop offset="100%" stopColor={mode === 'work' ? '#C8553D' : '#3B6EA8'} /></linearGradient></defs>
            <circle cx="140" cy="140" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="14" />
            <motion.circle cx="140" cy="140" r={R} fill="none" stroke="url(#timerG)" strokeWidth="14" strokeLinecap="round" strokeDasharray={C} animate={{ strokeDashoffset: C - (C * pct) / 100 }} transition={{ duration: 0.4 }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span className="text-4xl" animate={running ? { scale: [1, 1.15, 1] } : {}} transition={{ duration: 1.2, repeat: Infinity }} aria-hidden><Icon name={MODES[mode].icon} size={34} className="text-primary" /></motion.span>
            <span className="text-6xl font-extrabold tabular-nums">{String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}</span>
            <span className="muted text-sm">{MODES[mode].label}</span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={() => setRunning((r) => !r)} className="min-w-[130px] !py-3">{running ? 'Pause' : left < total ? 'Resume' : 'Start'}</Button>
          <Button variant="outline" onClick={() => reset(mode)}>Reset</Button>
          <Button variant="outline" onClick={skip}>Skip</Button>
          <Button variant="ghost" onClick={() => { setDraft(cfg); setEditing((e) => !e); }}>Configure</Button>
        </div>

        {editing && (
          <div className="mx-auto mt-5 grid max-w-md grid-cols-3 gap-3 text-left">
            {[['work', 'Focus (min)'], ['shortBreak', 'Short (min)'], ['longBreak', 'Long (min)']].map(([k, l]) => (
              <label key={k}><span className="label">{l}</span><input type="number" min="1" max="180" className="input" value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} /></label>
            ))}
            <Button className="col-span-3" onClick={saveCfg}>Save timer settings</Button>
          </div>
        )}

        <div className="mt-6 flex justify-center gap-1.5" aria-label={`${rounds % 4} of 4 pomodoros before long break`}>
          {[0, 1, 2, 3].map((i) => <span key={i} className="text-xl transition" style={{ opacity: i < rounds % 4 || (rounds && rounds % 4 === 0) ? 1 : 0.25 }}><Icon name="timer" size={20} className="text-primary" /></span>)}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <label className="label" htmlFor="focus-task">Working on</label>
          <select id="focus-task" className="input" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">— No task linked —</option>
            {tasks.map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}
          </select>
          {task ? (
            <p className="muted mt-3 text-sm">Tracked: <b>{formatMinutes(task.timeSpent)}</b>{task.estimatedTime ? <> of {formatMinutes(task.estimatedTime)} estimated</> : null}</p>
          ) : <p className="muted mt-3 text-xs">Link a task and each finished focus session is added to its time spent.</p>}
        </div>
        <div className="card flex items-center justify-around p-5 text-center">
          <div><p className="text-3xl font-extrabold">{rounds}</p><p className="muted text-xs">Pomodoros</p></div>
          <div><p className="text-3xl font-extrabold">{formatMinutes(sessionMin)}</p><p className="muted text-xs">Focused today</p></div>
        </div>
      </div>
      {tasks.length === 0 && <div className="card mt-5"><EmptyState icon="timer" title="No open tasks" hint="Create a task to link your focus sessions." /></div>}
    </div>
  );
}
