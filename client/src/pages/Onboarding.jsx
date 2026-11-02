import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Avatar, Button, Field } from '../components/ui';
import Icon from '../components/ui/Icon';
import { PURPOSES } from '../utils/constants';

const roleLabel = (p) => (p.includes('work') ? 'Job title' : p.includes('study') ? 'Course or field of study' : 'Occupation');
const orgLabel = (p) => (p.includes('work') ? 'Company' : p.includes('study') ? 'School or university' : 'Organisation');

export default function Onboarding() {
  const { user, setUser, logout } = useAuth();
  const nav = useNavigate();
  const fileRef = useRef(null);
  const [step, setStep] = useState(0);
  const [purposes, setPurposes] = useState(user.purposes?.length ? user.purposes : []);
  const [profile, setProfile] = useState({ jobTitle: '', company: '', location: '', bio: '', ...(user.profile?.toObject?.() || user.profile || {}) });
  const [tz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const toggle = (id) => setPurposes((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const finish = async (skipProfile) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('purposes', JSON.stringify(purposes));
      fd.append('onboardingCompleted', 'true');
      fd.append('preferences', JSON.stringify({ timezone: tz }));
      if (!skipProfile) {
        fd.append('profile', JSON.stringify(profile));
        if (file) fd.append('avatar', file);
      }
      const r = await api.put('/users/me', fd);
      setUser(r.data.data);
      toast.success('Your workspace is ready');
      nav('/dashboard', { replace: true });
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/') || f.size > 5 * 1024 * 1024) return toast.error('Choose an image under 5MB');
    setFile(f); setPreview(URL.createObjectURL(f));
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <span className="flex items-center gap-2 text-lg font-bold"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-grad-hero text-white"><Icon name="checkcircle" size={20} /></span> TaskFlow</span>
          <button className="muted text-sm hover:underline" onClick={logout}>Sign out</button>
        </div>

        <div className="mb-6 flex items-center gap-2" aria-label={`Step ${step + 1} of 2`}>
          {[0, 1].map((i) => <span key={i} className="h-1.5 flex-1 rounded-full transition-colors" style={{ background: i <= step ? 'var(--primary)' : 'var(--border)' }} />)}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 ? (
            <motion.div key="a" className="card p-6 sm:p-8" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h1 className="text-2xl font-bold">Welcome, {user.name.split(' ')[0]}</h1>
              <p className="muted mt-1">What will you use TaskFlow for? Choose all that apply. We will set up categories and features to match.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2" role="group" aria-label="Purposes">
                {PURPOSES.map((p) => {
                  const on = purposes.includes(p.id);
                  return (
                    <button key={p.id} type="button" aria-pressed={on} onClick={() => toggle(p.id)}
                      className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition ${on ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`} style={on ? undefined : { borderColor: 'var(--border)' }}>
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${on ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}><Icon name={p.icon} size={20} /></span>
                      <span className="flex-1"><span className="block font-semibold">{p.name}</span><span className="muted block text-xs">{p.desc}</span></span>
                      {on && <Icon name="check" size={18} className="text-primary" />}
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 flex justify-end">
                <Button disabled={!purposes.length} onClick={() => setStep(1)}>Continue <Icon name="arrow" size={16} /></Button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="b" className="card p-6 sm:p-8" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h1 className="text-2xl font-bold">Set up your profile</h1>
              <p className="muted mt-1">Help teammates recognise you. You can change any of this later in Profile.</p>
              <div className="mt-6 flex items-center gap-4">
                {preview ? <img src={preview} alt="Preview" className="h-20 w-20 rounded-full object-cover" /> : <Avatar user={user} size={80} />}
                <div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} aria-label="Upload photo" />
                  <Button type="button" variant="outline" onClick={() => fileRef.current.click()}><Icon name="camera" /> Upload photo</Button>
                  <p className="muted mt-1 text-xs">PNG or JPG, up to 5MB</p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label={roleLabel(purposes)}><input className="input" value={profile.jobTitle} onChange={(e) => setProfile({ ...profile, jobTitle: e.target.value })} maxLength={80} /></Field>
                <Field label={orgLabel(purposes)}><input className="input" value={profile.company} onChange={(e) => setProfile({ ...profile, company: e.target.value })} maxLength={80} /></Field>
                <Field label="Location"><input className="input" value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} maxLength={80} /></Field>
                <Field label="Time zone"><input className="input opacity-70" value={tz} disabled /></Field>
                <div className="sm:col-span-2"><Field label="Short bio"><textarea className="input" rows={2} maxLength={300} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} /></Field></div>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <button className="btn-ghost" onClick={() => setStep(0)}>Back</button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => finish(true)} disabled={busy}>Skip for now</Button>
                  <Button onClick={() => finish(false)} loading={busy}>Finish setup</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
