import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { fileUrl } from '../../api/axios';
import { initials } from '../../utils/helpers';
import { PRIORITIES } from '../../utils/constants';
import Icon from './Icon';

/* ---------- Button with ripple ---------- */
export function Button({ variant = 'primary', className = '', children, onClick, loading, ...rest }) {
  const ref = useRef(null);
  const handle = (e) => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const size = Math.max(r.width, r.height);
      const dot = document.createElement('span');
      dot.className = 'ripple-dot';
      dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      el.appendChild(dot);
      setTimeout(() => dot.remove(), 650);
    }
    onClick?.(e);
  };
  return (
    <button ref={ref} className={`btn-${variant} ${className}`} onClick={handle} disabled={loading || rest.disabled} {...rest}>
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden /> : null}
      {children}
    </button>
  );
}

/* ---------- Modal (spring + blurred backdrop) ---------- */
export function Modal({ open, onClose, title, children, wide, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog" aria-modal="true" aria-label={title}
            className={`card flex max-h-[92vh] w-full flex-col overflow-hidden rounded-b-none sm:rounded-b-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
            initial={{ scale: 0.85, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          >
            <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-lg font-bold">{title}</h2>
              <button className="btn-ghost !p-2" onClick={onClose} aria-label="Close dialog"><Icon name="x" size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
            {footer && <div className="border-t px-5 py-3" style={{ borderColor: 'var(--border)' }}>{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Skeletons ---------- */
export const Skeleton = ({ className = 'h-4 w-full' }) => <div className={`skeleton ${className}`} aria-hidden />;

export const TaskSkeletons = ({ count = 4 }) => (
  <div className="space-y-3" role="status" aria-label="Loading tasks">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="card space-y-3 p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <div className="flex gap-2"><Skeleton className="h-5 w-16" /><Skeleton className="h-5 w-20" /></div>
      </div>
    ))}
  </div>
);

/* ---------- Empty state ---------- */
export function EmptyState({ icon = 'checklist', title = 'Nothing here', hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon name={icon} size={30} /></div>
      <h3 className="mt-4 text-base font-bold">{title}</h3>
      {hint && <p className="muted mt-1 max-w-xs text-sm">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Progress ---------- */
export function ProgressBar({ value = 0, className = '', label }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full ${className}`} style={{ background: 'var(--surface-2)' }}
      role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label || 'Progress'}>
      <motion.div className="h-full rounded-full bg-grad-progress" initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} />
    </div>
  );
}

export function ProgressRing({ value = 0, size = 140, stroke = 12, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const id = `ring-${size}`;
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${label || 'Progress'} ${value}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#3B6EA8" /><stop offset="100%" stopColor="#3E9B73" /></linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (c * value) / 100 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <CountUp value={value} suffix="%" className="text-2xl font-extrabold" />
        {label && <span className="muted text-[11px]">{label}</span>}
      </div>
    </div>
  );
}

export function CountUp({ value = 0, suffix = '', className = '' }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const dur = 900;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{n}{suffix}</span>;
}

/* ---------- Avatar ---------- */
export function Avatar({ user, size = 28, className = '' }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (user?.avatar) {
    return <img src={fileUrl(user.avatar)} alt={user.name} title={user.name} style={style} className={`rounded-full object-cover ring-2 ring-[var(--surface)] ${className}`} />;
  }
  return (
    <span title={user?.name} style={style} aria-label={user?.name}
      className={`inline-flex items-center justify-center rounded-full bg-grad-hero font-bold text-white ring-2 ring-[var(--surface)] ${className}`}>
      {initials(user?.name)}
    </span>
  );
}

export function AvatarStack({ users = [], max = 3, size = 26 }) {
  if (!users.length) return null;
  return (
    <div className="flex -space-x-2">
      {users.slice(0, max).map((u) => <Avatar key={u._id} user={u} size={size} />)}
      {users.length > max && (
        <span style={{ width: size, height: size, fontSize: size * 0.38 }} className="inline-flex items-center justify-center rounded-full bg-primary/15 font-bold text-primary ring-2 ring-[var(--surface)]">
          +{users.length - max}
        </span>
      )}
    </div>
  );
}

/* ---------- Theme toggle ---------- */
export function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} className={`btn-ghost !p-2 text-xl ${className}`} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title="Toggle theme">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={theme} initial={{ rotate: -90, scale: 0, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} exit={{ rotate: 90, scale: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/* ---------- Field wrapper ---------- */
export const Field = ({ label, children, hint }) => (
  <label className="block">
    {label && <span className="label">{label}</span>}
    {children}
    {hint && <span className="muted mt-1 block text-xs">{hint}</span>}
  </label>
);

/* ---------- Page transition ---------- */
export const PageTransition = ({ children }) => (
  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
    {children}
  </motion.div>
);

/* ---------- Chips ---------- */
export const PriorityBadge = ({ priority }) => {
  const p = PRIORITIES[priority] || PRIORITIES.medium;
  return (
    <span className="chip font-semibold" style={{ background: `${p.color}22`, color: p.color }}>
      <Icon name="flag" size={11} /> {p.label}
    </span>
  );
};
