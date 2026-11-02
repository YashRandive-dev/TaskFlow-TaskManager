import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Button, Field, ThemeToggle } from '../components/ui';
import OtpInput from '../components/ui/OtpInput';
import Icon from '../components/ui/Icon';

const FLOATERS = [
  { e: 'checkcircle', t: 'Ship the landing page', c: '#3E9B73', x: '8%', y: '14%', d: 0 },
  { e: 'flame', t: 'Fix prod bug', c: '#C8553D', x: '52%', y: '30%', d: 0.6 },
  { e: 'book', t: 'Study for exam', c: '#3B6EA8', x: '12%', y: '56%', d: 1.1 },
  { e: 'timer', t: 'Focus 25 min', c: '#C8553D', x: '48%', y: '72%', d: 1.7 },
];

function Shell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hero-bg relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between" aria-hidden>
        <Link to="/" className="relative z-10 flex items-center gap-2 text-2xl font-bold">TaskFlow</Link>
        {FLOATERS.map((f) => (
          <motion.div key={f.t} className="absolute w-52 rounded-2xl bg-white/90 p-3.5 text-slate-800 shadow-2xl" style={{ left: f.x, top: f.y }}
            animate={{ y: [0, -16, 0], rotate: [-2, 2, -2] }} transition={{ duration: 5, repeat: Infinity, delay: f.d, ease: 'easeInOut' }}>
            <div className="flex items-center gap-2 text-sm font-semibold"><Icon name={f.e} size={18} style={{ color: f.c }} />{f.t}</div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-200"><div className="h-full rounded-full" style={{ width: `${40 + f.d * 25}%`, background: f.c }} /></div>
          </motion.div>
        ))}
        <div className="relative z-10 max-w-sm">
          <h2 className="text-3xl font-bold leading-tight">Plan your work. Finish what matters.</h2>
          <p className="mt-2 text-white/85">Boards, calendars, focus timers and teamwork in one clean workspace.</p>
        </div>
      </div>
      <div className="relative flex items-center justify-center p-6">
        <div className="absolute right-4 top-4"><ThemeToggle /></div>
        <motion.div className="w-full max-w-md" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/" className="mb-6 flex items-center gap-2 text-xl font-bold lg:hidden">TaskFlow</Link>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="muted mb-6 mt-1">{subtitle}</p>
          {children}
          <div className="muted mt-6 text-center text-sm">{footer}</div>
        </motion.div>
      </div>
    </div>
  );
}

const PasswordField = ({ label = 'Password', value, onChange, autoComplete, placeholder = '' }) => {
  const [show, setShow] = useState(false);
  return (
    <Field label={label}>
      <div className="relative">
        <input className="input !pr-10" type={show ? 'text' : 'password'} required minLength={6} autoComplete={autoComplete} value={value} onChange={onChange} placeholder={placeholder} />
        <button type="button" onClick={() => setShow((s) => !s)} className="muted absolute right-2.5 top-1/2 -translate-y-1/2" aria-label={show ? 'Hide password' : 'Show password'}>
          <Icon name="eye" size={16} className={show ? 'text-primary' : ''} />
        </button>
      </div>
    </Field>
  );
};

/** Resend countdown shared by every code screen. */
function useCountdown(initial = 30) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return undefined;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, setLeft];
}

/** Code entry + verify + resend. `onVerify(code)` should throw on failure. */
function CodeStep({ email, purpose, onVerify, submitLabel = 'Verify code' }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [bad, setBad] = useState(false);
  const [left, setLeft] = useCountdown(30);

  const verify = async (c = code) => {
    if (c.length !== 6) return toast.error('Enter the 6-digit code');
    setBusy(true); setBad(false);
    try { await onVerify(c); } catch (e) { setBad(true); setCode(''); toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const resend = async () => {
    try { await api.post('/auth/resend-otp', { email, purpose }); setLeft(30); toast.success('A new code is on its way'); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-5">
      <OtpInput value={code} onChange={setCode} onComplete={verify} disabled={busy} error={bad} />
      <Button className="w-full" loading={busy} onClick={() => verify()} disabled={code.length !== 6}>{submitLabel}</Button>
      <p className="muted text-center text-sm">
        Did not get it?{' '}
        {left > 0 ? <span>Resend in {left}s</span> : <button type="button" className="font-semibold text-primary hover:underline" onClick={resend}>Resend code</button>}
      </p>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { const r = await login(email, password); toast.success(r.message); nav('/dashboard'); }
    catch (err) {
      // an account that never finished email verification is sent to the code screen
      if (err.response?.data?.data?.needsVerification) { toast(err.response.data.message); nav('/verify-email', { state: { email } }); } else toast.error(errMsg(err));
    } finally { setBusy(false); }
  };

  return (
    <Shell title="Welcome back" subtitle="Log in to pick up where you left off."
      footer={<>New here? <Link to="/register" className="font-semibold text-primary hover:underline">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
        <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Your password" />
        <div className="text-right text-sm"><Link to="/forgot-password" className="text-primary hover:underline">Forgot password?</Link></div>
        <Button className="w-full" loading={busy}>Log in</Button>
      </form>
    </Shell>
  );
}

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const strength = Math.min(4, (f.password.length >= 6) + (f.password.length >= 10) + /[A-Z]/.test(f.password) + /\d|\W/.test(f.password));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await register(f.name, f.email, f.password); toast.success('We sent a code to your email'); nav('/verify-email', { state: { email: f.email } }); }
    catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <Shell title="Create your account" subtitle="Free to start. We will verify your email with a code."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-primary hover:underline">Log in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name"><input className="input" required maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Priya Sharma" autoComplete="name" /></Field>
        <Field label="Email"><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@example.com" autoComplete="email" /></Field>
        <div>
          <PasswordField value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" placeholder="At least 6 characters" />
          <div className="mt-2 flex gap-1" aria-hidden>
            {[1, 2, 3, 4].map((i) => <span key={i} className="h-1.5 flex-1 rounded-full transition-colors" style={{ background: i <= strength ? ['#C8553D', '#C98A1B', '#3B6EA8', '#3E9B73'][strength - 1] : 'var(--surface-2)' }} />)}
          </div>
        </div>
        <Button className="w-full" loading={busy}>Create account</Button>
      </form>
    </Shell>
  );
}

export function VerifyEmail() {
  const { state } = useLocation();
  const { verifyEmail } = useAuth();
  const nav = useNavigate();
  const email = state?.email;
  if (!email) return <Navigate to="/register" replace />;
  return (
    <Shell title="Verify your email" subtitle={`Enter the 6-digit code we sent to ${email}`}
      footer={<Link to="/register" className="font-semibold text-primary hover:underline">Use a different email</Link>}>
      <CodeStep email={email} purpose="verify" submitLabel="Verify and continue"
        onVerify={async (c) => { const r = await verifyEmail(email, c); toast.success(r.message); nav('/onboarding'); }} />
    </Shell>
  );
}

export function ForgotPassword() {
  const nav = useNavigate();
  const [step, setStep] = useState(0); // 0 email, 1 code, 2 new password
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const sendCode = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.post('/auth/forgot-password', { email }); setStep(1); toast.success('Check your email for the code'); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  const setNew = async (e) => {
    e.preventDefault();
    if (password !== confirm) return toast.error('Passwords do not match');
    setBusy(true);
    try { await api.post(`/auth/reset-password/${token}`, { password }); toast.success('Password updated. Please log in'); nav('/login'); }
    catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  const titles = ['Forgot password?', 'Enter the code', 'Set a new password'];
  const subs = ['Enter your email and we will send you a code.', `We sent a 6-digit code to ${email}`, 'Choose a strong password you have not used before.'];

  return (
    <Shell title={titles[step]} subtitle={subs[step]} footer={<Link to="/login" className="font-semibold text-primary hover:underline">Back to login</Link>}>
      <div className="mb-5 flex gap-1.5" aria-label={`Step ${step + 1} of 3`}>{[0, 1, 2].map((i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= step ? 'var(--primary)' : 'var(--border)' }} />)}</div>
      {step === 0 && (
        <form onSubmit={sendCode} className="space-y-4">
          <Field label="Email"><input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
          <Button className="w-full" loading={busy}>Send code</Button>
        </form>
      )}
      {step === 1 && (
        <CodeStep email={email} purpose="reset"
          onVerify={async (c) => { const r = await api.post('/auth/verify-reset-otp', { email, code: c }); setToken(r.data.data.resetToken); setStep(2); }} />
      )}
      {step === 2 && (
        <form onSubmit={setNew} className="space-y-4">
          <PasswordField label="New password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 6 characters" />
          <PasswordField label="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          <Button className="w-full" loading={busy}>Update password</Button>
        </form>
      )}
    </Shell>
  );
}
