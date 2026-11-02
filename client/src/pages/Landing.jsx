import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ThemeToggle } from '../components/ui';
import Icon from '../components/ui/Icon';
import { useAuth } from '../context/AuthContext';

const WORDS = ['organised.', 'focused.', 'productive.', 'on schedule.'];

function Typewriter() {
  const [i, setI] = useState(0);
  const [txt, setTxt] = useState('');
  const [del, setDel] = useState(false);
  useEffect(() => {
    const w = WORDS[i];
    const t = setTimeout(() => {
      if (!del) { setTxt(w.slice(0, txt.length + 1)); if (txt.length + 1 === w.length) setTimeout(() => setDel(true), 1100); }
      else { setTxt(w.slice(0, txt.length - 1)); if (txt.length - 1 === 0) { setDel(false); setI((x) => (x + 1) % WORDS.length); } }
    }, del ? 45 : 90);
    return () => clearTimeout(t);
  }, [txt, del, i]);
  return <span className="text-accent">{txt}<span className="animate-blink">|</span></span>;
}

const FEATURES = [
  ['kanban', 'Kanban, List & Calendar', 'Drag cards between columns, sort in a table, or plan on a calendar.'],
  ['zap', 'Natural-language quick add', 'Type “Call mom tomorrow 5pm #personal !high” and we do the rest.'],
  ['timer', 'Pomodoro & time tracking', 'Link a focus timer to any task and see estimated vs. actual time.'],
  ['users', 'Real-time collaboration', 'Invite teammates, assign tasks, and watch changes land live.'],
  ['trend', 'Analytics & streaks', 'Completion rings, weekly charts and a productivity streak.'],
  ['bell', 'Smart reminders', 'In-app, email and browser notifications before things are due.'],
  ['moon', 'Light & dark mode', 'Easy on the eyes any time of day, saved across visits.'],
  ['', 'Keyboard-first', 'N, /, K, L and ? — fly through TaskFlow without a mouse.'],
];

const TESTIMONIALS = [
  ['Aarav M.', 'Product Designer', 'The board view is so clean that closing tasks is actually satisfying.'],
  ['Sofia L.', 'Grad Student', 'Pomodoro linked to tasks plus the streak counter fixed my study routine.'],
  ['Dev Team Nova', 'Startup', 'Real-time updates and project roles replaced two other tools for us.'],
];

export default function Landing() {
  const { user } = useAuth();
  const cta = user ? { to: '/dashboard', label: 'Open dashboard →' } : { to: '/register', label: 'Get started free' };
  return (
    <div className="min-h-screen">
      <nav className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-6xl items-center justify-between px-5 py-4 text-white">
        <span className="text-xl font-bold">TaskFlow</span>
        <div className="flex items-center gap-2">
          <ThemeToggle className="!text-white" />
          {!user && <Link to="/login" className="rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/15">Log in</Link>}
          <Link to={cta.to} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-primary shadow-lg">{user ? 'Dashboard' : 'Sign up'}</Link>
        </div>
      </nav>

      <header className="hero-bg relative overflow-hidden px-5 pb-28 pt-32 text-center text-white">
        {[['Design review', '6%', '30%', 0], ['Fix login bug', '76%', '24%', 0.8], ['Read chapter 4', '10%', '72%', 1.4], ['Focus session', '72%', '70%', 2]].map(([t, l, tp, d]) => (
          <motion.div key={t} aria-hidden className="absolute hidden rounded-2xl bg-white/90 px-4 py-3 text-sm font-semibold text-slate-800 shadow-2xl md:block"
            style={{ left: l, top: tp }} animate={{ y: [0, -18, 0], rotate: [-3, 3, -3] }} transition={{ duration: 5, repeat: Infinity, delay: d, ease: 'easeInOut' }}>{t}</motion.div>
        ))}
        <motion.div className="relative mx-auto max-w-3xl" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <span className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold backdrop-blur">Task management for focused people</span>
          <h1 className="mt-6 text-4xl font-bold leading-tight sm:text-6xl">Stay <Typewriter /><br />Every single day.</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/90">Plan, track and celebrate your work with Kanban boards, calendars, focus timers and teammates — all in one clean workspace.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={cta.to} className="rounded-2xl bg-white px-7 py-3.5 text-base font-bold text-primary shadow-2xl transition hover:-translate-y-1">{cta.label}</Link>
            <a href="#features" className="rounded-2xl border-2 border-white/60 px-7 py-3.5 text-base font-bold transition hover:bg-white/15">See features</a>
          </div>
        </motion.div>
      </header>

      <section id="features" className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">Everything you need, <span className="gradient-text">nothing you don&apos;t</span></h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(([e, t, d], i) => (
            <motion.div key={t} className="card card-hover p-5" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon name={e} size={22} /></div>
              <h3 className="mt-4 font-bold">{t}</h3>
              <p className="muted mt-1 text-sm">{d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="px-5 py-16" style={{ background: 'var(--surface-2)' }}>
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold">Loved by busy people</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map(([n, r, q]) => (
              <figure key={n} className="card p-6">
                <blockquote className="text-sm leading-relaxed">“{q}”</blockquote>
                <figcaption className="mt-4 text-sm font-bold">{n} <span className="muted font-normal">· {r}</span></figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 text-center">
        <div className="hero-bg mx-auto max-w-4xl rounded-3xl p-10 text-white shadow-glow sm:p-14">
          <h2 className="text-3xl font-bold sm:text-4xl">Ready to flow?</h2>
          <p className="mx-auto mt-3 max-w-md text-white/90">Create your free account in seconds and clear your to-do list with style.</p>
          <Link to={cta.to} className="mt-7 inline-block rounded-2xl bg-white px-8 py-3.5 font-bold text-primary shadow-xl transition hover:-translate-y-1">{cta.label}</Link>
        </div>
      </section>

      <footer className="border-t px-5 py-8 text-center text-sm" style={{ borderColor: 'var(--border)' }}>
        <p className="font-bold">TaskFlow</p>
        <p className="muted mt-1">Built with the MERN stack · Made with for productive humans</p>
      </footer>
    </div>
  );
}
