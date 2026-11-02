import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { EMPTY_FILTERS, useTasks } from '../context/TaskContext';
import { useUI } from '../context/UIContext';
import QuickAdd from '../components/tasks/QuickAdd';
import TaskCard from '../components/tasks/TaskCard';
import { CountUp, EmptyState, ProgressBar, ProgressRing, Skeleton } from '../components/ui';
import Icon from '../components/ui/Icon';
import { celebrate, formatMinutes, greeting } from '../utils/helpers';
import { DEFAULT_CATEGORIES } from '../utils/constants';

const PIE = { high: '#C8553D', medium: '#F59E0B', low: '#3E9B73' };
const LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

function Stat({ icon, label, value, grad, to, suffix }) {
  const body = (
    <motion.div whileHover={{ y: -4 }} className="card relative h-full overflow-hidden p-4">
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-20" style={{ background: grad }} />
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon name={icon} size={18} /></div>
      <p className="mt-2 text-3xl font-bold"><CountUp value={value} suffix={suffix} /></p>
      <p className="muted text-xs font-semibold uppercase tracking-wide">{label}</p>
    </motion.div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { tasks: ctxTasks, setFilters } = useTasks();
  const { openTask } = useUI();
  const [stats, setStats] = useState(null);
  const [today, setToday] = useState(null);
  const g = greeting();
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem('tf-profile-dismissed') === '1'; } catch { return false; } });
  const needsProfile = !dismissed && (!user.avatar || !user.profile?.jobTitle);
  const goal = user.preferences?.dailyGoal || 5;
  const doneToday = stats?.weekly?.[6]?.completed || 0;
  const categories = user.categories?.length ? user.categories : DEFAULT_CATEGORIES;

  const sig = useMemo(() => ctxTasks.map((t) => `${t._id}${t.status}${t.dueDate}`).join('|'), [ctxTasks]);

  const load = useCallback(async () => {
    try {
      const [s, t, o] = await Promise.all([
        api.get('/analytics/summary', { params: { tzOffset: new Date().getTimezoneOffset() } }),
        api.get('/tasks', { params: { due: 'today', sort: 'priority', order: 'desc' } }),
        api.get('/tasks', { params: { due: 'overdue', sort: 'dueDate' } }),
      ]);
      setStats(s.data.data);
      const seen = new Set();
      setToday([...o.data.data.tasks, ...t.data.data.tasks].filter((x) => !seen.has(x._id) && seen.add(x._id)));
    } catch (e) { toast.error(errMsg(e)); }
  }, []);

  useEffect(() => { load(); }, [load, sig]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('tf:comment', h);
    return () => window.removeEventListener('tf:comment', h);
  }, [load]);

  const toggle = async (t) => {
    const status = t.status === 'done' ? 'todo' : 'done';
    try {
      await api.patch(`/tasks/${t._id}/status`, { status });
      if (status === 'done') { celebrate(); toast.success('Task completed! Great job!'); }
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const donut = (stats?.byPriority || []).filter((p) => p.value > 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="hero-bg relative overflow-hidden rounded-3xl p-6 text-white shadow-glow sm:p-8">
                <h1 className="text-2xl font-bold sm:text-3xl">{g.text}, {user.name.split(' ')[0]} </h1>
        <p className="mt-1 text-white/90">
          {stats ? (stats.dueToday + (stats.overdue || 0) > 0 ? `You have ${stats.dueToday} task${stats.dueToday === 1 ? '' : 's'} due today${stats.overdue ? ` and ${stats.overdue} overdue` : ''}. Let's crush it!` : 'Nothing urgent today. Enjoy the calm!') : 'Loading your day…'}
        </p>
        <div className="mt-5 max-w-2xl text-slate-800"><QuickAdd /></div>
      </section>

      {needsProfile && (
        <div className="card flex flex-wrap items-center gap-3 p-4" style={{ borderColor: 'var(--primary)' }}>
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon name="user" size={20} /></span>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Complete your profile</p><p className="muted text-xs">Add a photo and your role so teammates can recognise you.</p></div>
          <Link to="/profile" className="btn-primary !py-2 text-xs">Set up profile</Link>
          <button className="btn-ghost !p-2" aria-label="Dismiss" onClick={() => { try { localStorage.setItem('tf-profile-dismissed', '1'); } catch { /* ignore */ } setDismissed(true); }}><Icon name="x" size={16} /></button>
        </div>
      )}

      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat icon="layers" label="Total tasks" value={stats.total} grad="#3B6EA8" to="/tasks" />
            <Stat icon="checkcircle" label="Completed" value={stats.completed} grad="#3E9B73" />
            <Stat icon="progress" label="In progress" value={stats.inProgress} grad="#3B6EA8" />
            <Stat icon="timer" label="Time tracked" value={stats.timeSpent} grad="#3E9B73" suffix="m" />
          </div>


          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold">Daily goal</span><span className="muted">{doneToday} of {goal} tasks completed today</span></div>
            <ProgressBar value={Math.min(100, Math.round((doneToday / goal) * 100))} label="Daily goal progress" />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="card flex flex-col items-center justify-center gap-3 p-5">
              <h2 className="self-start font-bold">Completion rate</h2>
              <ProgressRing value={stats.completionRate} size={150} label="completed" />
              <p className="muted text-xs">{stats.completed} of {stats.total} tasks done</p>
            </div>

            <div className="card p-5">
              <h2 className="font-bold">Productivity streak</h2>
              <div className="mt-3 flex items-end gap-3">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/15 text-secondary"><Icon name="flame" size={32} /></span>
                <div><p className="text-5xl font-bold leading-none"><CountUp value={stats.streak.current} /></p><p className="muted text-sm">day{stats.streak.current === 1 ? '' : 's'} in a row</p></div>
              </div>
              <p className="muted mt-4 text-xs">Longest streak: <b>{stats.streak.longest}</b> days</p>
              <p className="muted mt-1 text-xs">{stats.streak.current === 0 ? 'Complete a task today to start your streak!' : 'Keep it going — finish one task today.'}</p>
            </div>

            <motion.div
              className={`card p-5 ${stats.overdue ? 'border-secondary' : ''}`}
              style={stats.overdue ? { background: 'color-mix(in srgb, #C8553D 10%, var(--surface))' } : undefined}
              animate={stats.overdue ? { boxShadow: ['0 0 0 0 rgba(255,107,107,.0)', '0 0 0 8px rgba(255,107,107,.18)', '0 0 0 0 rgba(255,107,107,0)'] } : undefined}
              transition={{ duration: 2.4, repeat: Infinity }}
            >
              <h2 className="font-bold">{stats.overdue ? 'Overdue tasks' : 'All on schedule'}</h2>
              <p className={`mt-3 text-6xl font-bold ${stats.overdue ? 'text-secondary' : 'text-accent-600'}`}><CountUp value={stats.overdue} /></p>
              <p className="muted mt-2 text-sm">{stats.overdue ? 'These need attention. Reschedule or knock them out!' : 'Nothing is overdue. Nice work!'}</p>
              {stats.overdue > 0 && <Link to="/tasks" onClick={() => setFilters({ ...EMPTY_FILTERS, due: 'overdue' })} className="btn-danger mt-3 !py-2 text-xs">Review overdue →</Link>}
            </motion.div>
          </div>

          <div className="grid gap-5 lg:grid-cols-5">
            <div className="card p-5 lg:col-span-3">
              <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">Completed this week</h2><span className="chip">{stats.completedThisWeek} total</span></div>
              <div className="h-60" role="img" aria-label="Bar chart of tasks completed per day this week">
                <ResponsiveContainer>
                  <BarChart data={stats.weekly} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
                    <defs><linearGradient id="barG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3B6EA8" /><stop offset="100%" stopColor="#3E9B73" /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(91,75,255,.08)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)' }} />
                    <Bar dataKey="completed" name="Completed" fill="url(#barG)" radius={[8, 8, 0, 0]} animationDuration={1000} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-5 lg:col-span-2">
              <h2 className="font-bold">Tasks by priority</h2>
              {donut.length === 0 ? <EmptyState icon="inbox" title="No data yet" hint="Create a few tasks to see the breakdown." /> : (
                <>
                  <div className="h-48" role="img" aria-label="Donut chart of tasks by priority">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={donut} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={4} animationDuration={900} stroke="none">
                          {donut.map((d) => <Cell key={d.name} fill={PIE[d.name]} />)}
                        </Pie>
                        <Tooltip formatter={(v, n) => [v, LABEL[n]]} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 text-xs font-medium">{stats.byPriority.map((p) => <span key={p.name}>{LABEL[p.name]} · {p.value}</span>)}</div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Today&apos;s tasks</h2><Link to="/tasks" className="text-sm font-semibold text-primary hover:underline">All tasks →</Link></div>
        {!today ? <Skeleton className="h-28" /> : today.length === 0 ? (
          <div className="card"><EmptyState icon="checklist" title="No tasks here" hint={`Nothing due today. ${stats ? `You've tracked ${formatMinutes(stats.timeSpent)} so far.` : ''}`} /></div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {today.map((t, i) => <TaskCard key={t._id} task={t} index={i} categories={categories} onOpen={openTask} onToggle={toggle} />)}
          </div>
        )}
      </section>
    </div>
  );
}
