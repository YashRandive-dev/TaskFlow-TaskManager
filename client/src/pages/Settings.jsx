import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useUI } from '../context/UIContext';
import { Button, Field, Modal } from '../components/ui';
import Icon, { CategoryIcon } from '../components/ui/Icon';
import { DEFAULT_CATEGORIES, PURPOSES } from '../utils/constants';
import { downloadBlob } from '../utils/helpers';

const CATEGORY_ICONS = ['tag', 'briefcase', 'book', 'heart', 'cart', 'home', 'dumbbell', 'wallet', 'rocket', 'coffee', 'star', 'layers'];

function Switch({ checked, onChange, label, hint }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div><p className="text-sm font-semibold">{label}</p>{hint && <p className="muted text-xs">{hint}</p>}</div>
      <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-slate-400/40'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

const Section = ({ title, desc, children }) => (
  <section className="card p-6">
    <h2 className="text-lg font-bold">{title}</h2>
    {desc && <p className="muted mb-4 text-sm">{desc}</p>}
    {children}
  </section>
);

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { setView } = useUI();
  const nav = useNavigate();
  const prefs = user.preferences || {};
  const categories = user.categories?.length ? user.categories : DEFAULT_CATEGORIES;
  const [newCat, setNewCat] = useState({ name: '', icon: 'tag' });
  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delBusy, setDelBusy] = useState(false);
  const [devices, setDevices] = useState(null);
  const [maxDevices, setMaxDevices] = useState(5);
  const [renaming, setRenaming] = useState(null); // { id, name }

  const loadDevices = async () => {
    try { const r = await api.get('/auth/sessions'); setDevices(r.data.data.devices); setMaxDevices(r.data.data.max); } catch (e) { toast.error(errMsg(e)); }
  };
  useEffect(() => { loadDevices(); }, []);

  const renameDevice = async () => {
    if (!renaming?.name.trim()) return setRenaming(null);
    try { await api.patch(`/auth/sessions/${renaming.id}`, { name: renaming.name }); setRenaming(null); loadDevices(); } catch (e) { toast.error(errMsg(e)); }
  };
  const signOutDevice = async (d) => {
    if (!window.confirm(d.current ? 'Sign out of this device?' : `Sign out ${d.deviceName}?`)) return;
    try {
      await api.delete(`/auth/sessions/${d._id}`);
      if (d.current) { await logout(); nav('/login'); return; }
      toast.success('Device signed out'); loadDevices();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const signOutOthers = async () => {
    if (!window.confirm('Sign out of every other device?')) return;
    try { await api.delete('/auth/sessions'); toast.success('Signed out of all other devices'); loadDevices(); } catch (e) { toast.error(errMsg(e)); }
  };

  const zones = useMemo(() => (Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : ['UTC']), []);

  const put = async (body, msg = 'Settings saved') => {
    try { setUser((await api.put('/users/me', body)).data.data); toast.success(msg); } catch (e) { toast.error(errMsg(e)); }
  };
  const savePrefs = (patch) => put({ preferences: JSON.stringify(patch) });
  const pickTheme = (t) => { setTheme(t); savePrefs({ theme: t }); };

  const togglePush = async (on) => {
    if (on) {
      if (!('Notification' in window)) return toast.error('This browser does not support notifications');
      if ((await Notification.requestPermission()) !== 'granted') return toast.error('Permission was not granted');
    }
    savePrefs({ pushNotifications: on });
  };

  const togglePurpose = (id) => {
    const cur = user.purposes || [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    if (!next.length) return toast.error('Keep at least one use case selected');
    put({ purposes: JSON.stringify(next) }, 'Use cases updated');
  };

  const saveCategories = (next) => put({ categories: JSON.stringify(next) }, 'Categories saved');
  const addCat = (e) => {
    e.preventDefault();
    const name = newCat.name.trim();
    if (!name) return;
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) return toast.error('That category already exists');
    saveCategories([...categories, { name, icon: newCat.icon }]);
    setNewCat({ name: '', icon: 'tag' });
  };

  const exportTasks = async (format) => {
    try { downloadBlob((await api.get('/tasks/export', { params: { format }, responseType: 'blob' })).data, `taskflow-tasks.${format}`); } catch (e) { toast.error(errMsg(e)); }
  };

  const deleteAccount = async () => {
    setDelBusy(true);
    try {
      await api.delete('/users/me', { data: { password: delPw } });
      toast.success('Account deleted');
      await logout();
      nav('/');
    } catch (e) { toast.error(errMsg(e)); } finally { setDelBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div><h1 className="text-2xl font-bold">Settings</h1><p className="muted text-sm">Preferences for how TaskFlow looks and works for you.</p></div>

      <Section title="Use cases" desc="Choose what you use TaskFlow for. Categories and features adapt to your selection.">
        <div className="grid gap-2 sm:grid-cols-2">
          {PURPOSES.map((p) => {
            const on = user.purposes?.includes(p.id);
            return (
              <button key={p.id} type="button" aria-pressed={on} onClick={() => togglePurpose(p.id)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${on ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`} style={on ? undefined : { borderColor: 'var(--border)' }}>
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${on ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}><Icon name={p.icon} size={18} /></span>
                <span className="flex-1 text-sm font-semibold">{p.name}</span>
                {on && <Icon name="check" size={16} className="text-primary" />}
              </button>
            );
          })}
        </div>
        <p className="muted mt-3 text-xs">Projects need Work. The focus timer needs Work or Study.</p>
      </Section>

      <Section title="Appearance">
        <div className="grid grid-cols-2 gap-3">
          {[['light', 'sun', 'Light'], ['dark', 'moon', 'Dark']].map(([t, i, l]) => (
            <button key={t} onClick={() => pickTheme(t)} aria-pressed={theme === t} className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3.5 text-sm font-semibold transition ${theme === t ? 'border-primary bg-primary/10' : ''}`} style={theme === t ? undefined : { borderColor: 'var(--border)' }}><Icon name={i} size={16} /> {l}</button>
          ))}
        </div>
      </Section>

      <Section title="Preferences" desc="Regional and task defaults.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Time zone">
            <select className="input" value={prefs.timezone || ''} onChange={(e) => savePrefs({ timezone: e.target.value })}>
              <option value="">Automatic</option>
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </Field>
          <Field label="Week starts on">
            <select className="input" value={prefs.weekStart || 'monday'} onChange={(e) => savePrefs({ weekStart: e.target.value })}><option value="monday">Monday</option><option value="sunday">Sunday</option></select>
          </Field>
          <Field label="Time format">
            <select className="input" value={prefs.timeFormat || '12h'} onChange={(e) => savePrefs({ timeFormat: e.target.value })}><option value="12h">12-hour (3:30 PM)</option><option value="24h">24-hour (15:30)</option></select>
          </Field>
          <Field label="Default task view">
            <select className="input" value={prefs.defaultView || 'list'} onChange={(e) => { setView(e.target.value); savePrefs({ defaultView: e.target.value }); }}><option value="list">List</option><option value="kanban">Board</option><option value="calendar">Calendar</option></select>
          </Field>
          <Field label="Default priority">
            <select className="input" value={prefs.defaultPriority || 'medium'} onChange={(e) => savePrefs({ defaultPriority: e.target.value })}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
          </Field>
          <Field label="Daily goal (tasks)">
            <input className="input" type="number" min="1" max="50" defaultValue={prefs.dailyGoal || 5} onBlur={(e) => { const v = Math.min(50, Math.max(1, +e.target.value || 5)); if (v !== prefs.dailyGoal) savePrefs({ dailyGoal: v }); }} />
          </Field>
        </div>
      </Section>

      <section className="card divide-y px-6 py-3" style={{ borderColor: 'var(--border)' }}>
        <h2 className="py-3 text-lg font-bold">Notifications</h2>
        <Switch checked={prefs.inAppNotifications !== false} onChange={(v) => savePrefs({ inAppNotifications: v })} label="In-app alerts" hint="Show pop-ups when something changes." />
        <Switch checked={prefs.emailReminders !== false} onChange={(v) => savePrefs({ emailReminders: v })} label="Email reminders" hint="Receive an email 24 hours before a task is due." />
        <Switch checked={!!prefs.weeklyDigest} onChange={(v) => savePrefs({ weeklyDigest: v })} label="Weekly summary email" hint="A recap of what you completed each week." />
        <Switch checked={!!prefs.pushNotifications} onChange={togglePush} label="Browser notifications" hint="Desktop alerts while TaskFlow is open." />
      </section>

      {(user.purposes?.includes('work') || user.purposes?.includes('study')) && (
        <Section title="Focus timer" desc="Pomodoro durations in minutes.">
          <div className="grid grid-cols-3 gap-3">
            {[['work', 'Focus'], ['shortBreak', 'Short break'], ['longBreak', 'Long break']].map(([k, l]) => (
              <Field key={k} label={l}><input className="input" type="number" min="1" max="180" defaultValue={prefs.pomodoro?.[k]} onBlur={(e) => { const v = Math.max(1, +e.target.value || 1); if (v !== prefs.pomodoro?.[k]) savePrefs({ pomodoro: { [k]: v } }); }} /></Field>
            ))}
          </div>
        </Section>
      )}

      <Section title="Categories" desc="Used to organise your tasks.">
        <ul className="mb-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <li key={c.name} className="chip !px-3 !py-1.5 text-sm"><CategoryIcon icon={c.icon} size={14} /> {c.name}
              <button className="ml-1 text-secondary" aria-label={`Delete category ${c.name}`} onClick={() => saveCategories(categories.filter((x) => x.name !== c.name))}><Icon name="x" size={13} /></button></li>
          ))}
        </ul>
        <form onSubmit={addCat} className="flex flex-wrap gap-2">
          <select className="input !w-36" value={newCat.icon} onChange={(e) => setNewCat({ ...newCat, icon: e.target.value })} aria-label="Icon">{CATEGORY_ICONS.map((i) => <option key={i} value={i}>{i}</option>)}</select>
          <input className="input min-w-[160px] flex-1" placeholder="New category name" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} maxLength={30} aria-label="Category name" />
          <button className="btn-primary">Add</button>
        </form>
      </Section>

      <Section title="Devices" desc={`Where you are signed in. You can be signed in on up to ${maxDevices} devices at once; signing in on another one signs out the least recently used.`}>
        {devices === null ? <div className="skeleton h-16" /> : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="chip !px-3 !py-1.5 text-sm font-semibold">{devices.length} of {maxDevices} devices in use</span>
              {devices.length > 1 && <Button variant="outline" className="!py-1.5 text-xs" onClick={signOutOthers}><Icon name="logout" size={14} /> Sign out all other devices</Button>}
            </div>
            <ul className="space-y-2">
              {devices.map((d) => (
                <li key={d._id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3" style={{ borderColor: d.current ? 'var(--primary)' : 'var(--border)' }}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon name={d.deviceType === 'mobile' ? 'smartphone' : d.deviceType === 'tablet' ? 'tablet' : 'monitor'} size={20} /></span>
                  <div className="min-w-0 flex-1">
                    {renaming?.id === d._id ? (
                      <input className="input !py-1" autoFocus maxLength={40} value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} onBlur={renameDevice} onKeyDown={(e) => { if (e.key === 'Enter') renameDevice(); if (e.key === 'Escape') setRenaming(null); }} aria-label="Device name" />
                    ) : (
                      <p className="flex flex-wrap items-center gap-2 truncate text-sm font-semibold">{d.deviceName}{d.current && <span className="chip !bg-primary/15 !text-primary">This device</span>}</p>
                    )}
                    <p className="muted truncate text-xs">{d.browser} · {d.os}{d.ip ? ` · ${d.ip}` : ''} · {d.current ? 'Active now' : `Active ${formatDistanceToNow(new Date(d.lastActive), { addSuffix: true })}`}</p>
                  </div>
                  <button className="btn-ghost !p-2" onClick={() => setRenaming({ id: d._id, name: d.deviceName })} aria-label={`Rename ${d.deviceName}`} title="Rename"><Icon name="edit" size={15} /></button>
                  <button className="btn-ghost !p-2 !text-secondary" onClick={() => signOutDevice(d)} aria-label={`Sign out ${d.deviceName}`} title="Sign out"><Icon name="logout" size={15} /></button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title="Data and privacy" desc="Download your tasks or permanently delete your account.">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exportTasks('csv')}><Icon name="download" /> Export CSV</Button>
          <Button variant="outline" onClick={() => exportTasks('json')}><Icon name="download" /> Export JSON</Button>
          <Button variant="danger" onClick={() => setDelOpen(true)}><Icon name="trash" /> Delete account</Button>
        </div>
      </Section>

      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Delete account"
        footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDelOpen(false)}>Cancel</Button><Button variant="danger" disabled={!delPw} loading={delBusy} onClick={deleteAccount}>Delete permanently</Button></div>}>
        <p className="mb-4 text-sm">This permanently removes your account, tasks, and any projects you own. This cannot be undone. Enter your password to confirm.</p>
        <input className="input" type="password" placeholder="Password" value={delPw} onChange={(e) => setDelPw(e.target.value)} autoComplete="current-password" aria-label="Password" />
      </Modal>
    </div>
  );
}
