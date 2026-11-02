import { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Avatar, Button, Field, ProgressBar } from '../components/ui';
import Icon from '../components/ui/Icon';
import { PURPOSES } from '../utils/constants';

const FIELDS = ['jobTitle', 'company', 'phone', 'location', 'bio', 'website'];

export default function Profile() {
  const { user, setUser } = useAuth();
  const fileRef = useRef(null);
  const [name, setName] = useState(user.name);
  const [profile, setProfile] = useState(() => Object.fromEntries(FIELDS.map((k) => [k, user.profile?.[k] || ''])));
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  const work = user.purposes?.includes('work');
  const study = user.purposes?.includes('study');
  const completeness = useMemo(() => {
    const checks = [!!user.avatar || !!file, !!profile.jobTitle, !!profile.company, !!profile.location, !!profile.bio, !!profile.phone];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [user.avatar, file, profile]);

  const set = (k) => (e) => setProfile({ ...profile, [k]: e.target.value });

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast.error('Please choose an image file');
    if (f.size > 5 * 1024 * 1024) return toast.error('Image must be under 5MB');
    setFile(f); setPreview(URL.createObjectURL(f));
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('profile', JSON.stringify(profile));
      if (file) fd.append('avatar', file);
      const r = await api.put('/users/me', fd);
      setUser(r.data.data); setFile(null); setPreview(null);
      toast.success('Profile saved');
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  const removeAvatar = async () => {
    try { setUser((await api.put('/users/me', { removeAvatar: true })).data.data); setPreview(null); setFile(null); toast.success('Photo removed'); } catch (e) { toast.error(errMsg(e)); }
  };

  const savePw = async (e) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) return toast.error('Passwords do not match');
    setPwBusy(true);
    try {
      await api.put('/users/me', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed');
    } catch (err) { toast.error(errMsg(err)); } finally { setPwBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div><h1 className="text-2xl font-bold">Profile</h1><p className="muted text-sm">Your personal and professional details.</p></div>

      <div className="card p-5">
        <div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold">Profile completeness</span><span className="muted">{completeness}%</span></div>
        <ProgressBar value={completeness} label="Profile completeness" />
        {completeness < 100 && <p className="muted mt-2 text-xs">Add a photo, role, organisation, location, phone and a short bio to complete your profile.</p>}
      </div>

      <form onSubmit={saveProfile} className="card space-y-5 p-6">
        <div className="flex flex-wrap items-center gap-5">
          {preview ? <img src={preview} alt="New avatar preview" className="h-24 w-24 rounded-full object-cover" /> : <Avatar user={user} size={96} />}
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} aria-label="Upload avatar" />
            <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => fileRef.current.click()}><Icon name="camera" /> Change photo</Button>{user.avatar && <Button type="button" variant="ghost" onClick={removeAvatar}>Remove</Button>}</div>
            <p className="muted text-xs">PNG or JPG, up to 5MB.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required /></Field>
          <Field label="Email" hint="Email cannot be changed."><input className="input opacity-70" value={user.email} disabled /></Field>
          <Field label={work ? 'Job title' : study ? 'Course or field of study' : 'Occupation'}><input className="input" value={profile.jobTitle} onChange={set('jobTitle')} maxLength={80} /></Field>
          <Field label={work ? 'Company' : study ? 'School or university' : 'Organisation'}><input className="input" value={profile.company} onChange={set('company')} maxLength={80} /></Field>
          <Field label="Phone"><input className="input" type="tel" value={profile.phone} onChange={set('phone')} maxLength={30} /></Field>
          <Field label="Location"><input className="input" value={profile.location} onChange={set('location')} maxLength={80} /></Field>
          <div className="sm:col-span-2"><Field label="Website or LinkedIn"><input className="input" type="url" placeholder="https://" value={profile.website} onChange={set('website')} maxLength={120} /></Field></div>
          <div className="sm:col-span-2"><Field label="Bio"><textarea className="input" rows={3} maxLength={300} value={profile.bio} onChange={set('bio')} /></Field></div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button loading={busy}>Save profile</Button>
          <span className="muted flex items-center gap-3 text-sm"><span className="flex items-center gap-1"><Icon name="flame" size={14} /> Streak {user.streak?.current || 0}</span><span className="flex items-center gap-1"><Icon name="trophy" size={14} /> Best {user.streak?.longest || 0}</span></span>
        </div>
      </form>

      <section className="card p-6">
        <h2 className="text-lg font-bold">Your use cases</h2>
        <p className="muted mb-3 text-sm">Change these in Settings to adjust categories and available features.</p>
        <div className="flex flex-wrap gap-2">
          {(user.purposes || []).map((id) => { const p = PURPOSES.find((x) => x.id === id); return p ? <span key={id} className="chip !px-3 !py-1.5 text-sm"><Icon name={p.icon} size={14} /> {p.name}</span> : null; })}
        </div>
      </section>

      <form onSubmit={savePw} className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">Change password</h2>
        <Field label="Current password"><input className="input" type="password" required autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password"><input className="input" type="password" required minLength={6} autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
          <Field label="Confirm new password"><input className="input" type="password" required minLength={6} autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
        </div>
        <Button loading={pwBusy}>Update password</Button>
      </form>
    </div>
  );
}
