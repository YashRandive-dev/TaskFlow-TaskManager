import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { TaskProvider } from './context/TaskContext';
import { NotificationProvider } from './context/NotificationContext';
import { UIProvider } from './context/UIContext';
import AppLayout from './components/layout/AppLayout';
import { Skeleton } from './components/ui';

const Landing = lazy(() => import('./pages/Landing'));
const { Login, Register, ForgotPassword, VerifyEmail } = {
  Login: lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.Login }))),
  Register: lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.Register }))),
  ForgotPassword: lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.ForgotPassword }))),
  VerifyEmail: lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.VerifyEmail }))),
};
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Focus = lazy(() => import('./pages/Focus'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const Trash = lazy(() => import('./pages/Trash'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Onboarding = lazy(() => import('./pages/Onboarding'));

const Loading = () => (
  <div className="mx-auto max-w-3xl space-y-4 p-8" role="status" aria-label="Loading">
    <Skeleton className="h-10 w-1/3" /><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" />
  </div>
);

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.onboardingCompleted) return <Navigate to="/onboarding" replace />;
  return (
    <UIProvider>
      <NotificationProvider>
        <TaskProvider>
          <AppLayout />
        </TaskProvider>
      </NotificationProvider>
    </UIProvider>
  );
}

function NeedsOnboarding({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return user.onboardingCompleted ? <Navigate to="/dashboard" replace /> : children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
        <Route path="/verify-email" element={<GuestOnly><VerifyEmail /></GuestOnly>} />
        <Route path="/onboarding" element={<NeedsOnboarding><Onboarding /></NeedsOnboarding>} />
        <Route element={<Protected />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/focus" element={<Focus />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/trash" element={<Trash />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
