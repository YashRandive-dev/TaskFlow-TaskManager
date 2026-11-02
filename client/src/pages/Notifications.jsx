import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '../context/NotificationContext';
import { Button, EmptyState } from '../components/ui';
import Icon from '../components/ui/Icon';

const ICON = { assigned: 'pin', comment: 'comment', reminder: 'clock', invite: 'projects', status: 'activity', system: 'info' };

export default function Notifications() {
  const { items, unread, markRead, markAll, clearAll } = useNotifications();
  const nav = useNavigate();

  const open = (n) => { if (!n.read) markRead(n._id); if (n.link) nav(n.link); };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold sm:text-3xl">Notifications</h1><p className="muted text-sm">{unread ? `${unread} unread` : 'You\'re all caught up'}</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={markAll} disabled={!unread}>Mark all read</Button>
          <Button variant="ghost" onClick={clearAll} disabled={!items.length}>Clear</Button>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="card"><EmptyState icon="bell" title="No notifications" hint="Assignments, comments and due-date reminders show up here." /></div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {items.map((n) => (
              <motion.li key={n._id} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30 }}>
                <button onClick={() => open(n)} className="card flex w-full items-center gap-3 p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-glow" style={!n.read ? { borderColor: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 6%, var(--surface))' } : undefined}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl"><Icon name={ICON[n.type] || 'bell'} size={18} className="text-primary" /></span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.read ? '' : 'font-bold'}`}>{n.message}</span>
                    <span className="muted text-xs">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
                  </span>
                  {!n.read && <span className="h-2.5 w-2.5 rounded-full bg-secondary" aria-label="Unread" />}
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
