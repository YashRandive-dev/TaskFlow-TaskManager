import { Link } from 'react-router-dom';
import Icon from '../components/ui/Icon';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon name="search" size={36} /></div>
      <h1 className="gradient-text mt-6 text-6xl font-extrabold">404</h1>
      <p className="mt-2 text-xl font-bold">Page not found</p>
      <p className="muted mt-1 max-w-sm">The page you&apos;re looking for doesn&apos;t exist or was moved. Let&apos;s get you back on track.</p>
      <Link to="/dashboard" className="btn-primary mt-6">Back to dashboard</Link>
    </div>
  );
}
