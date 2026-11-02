import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import TaskWorkspace from '../components/tasks/TaskWorkspace';
import { Avatar, Button, EmptyState, Skeleton } from '../components/ui';
import { ProjectForm } from './Projects';
import Icon from '../components/ui/Icon';

export default function ProjectDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, socket } = useAuth();
  const { loadProjects } = useUI();
  const [project, setProject] = useState(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState('tasks');
  const [activity, setActivity] = useState([]);
  const [invite, setInvite] = useState({ email: '', role: 'Member' });
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try { setProject((await api.get(`/projects/${id}`)).data.data); setError(false); } catch { setError(true); }
  }, [id]);
  useEffect(() => { setProject(null); load(); }, [load]);
  useEffect(() => {
    if (tab === 'activity') api.get(`/projects/${id}/activity`).then((r) => setActivity(r.data.data)).catch(() => {});
  }, [tab, id]);
  useEffect(() => {
    if (!socket) return undefined;
    socket.emit('project:join', id);
    const h = () => load();
    socket.on('project:updated', h);
    return () => socket.off('project:updated', h);
  }, [socket, id, load]);

  if (error) return <EmptyState icon="lock" title="Project not found" hint="It may have been deleted or you aren't a member." action={<Link to="/projects" className="btn-primary">Back to projects</Link>} />;
  if (!project) return <div className="mx-auto max-w-7xl space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;

  const isAdmin = ['Owner', 'Admin'].includes(project.myRole);
  const isOwner = project.myRole === 'Owner';

  const sendInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    try {
      const r = await api.post(`/projects/${id}/invite`, invite);
      toast.success(r.data.message);
      setInvite({ email: '', role: 'Member' });
      load(); loadProjects();
    } catch (err) { toast.error(`${errMsg(err)}`); } finally { setInviting(false); }
  };
  const setRole = async (uid, role) => {
    try { setProject({ ...(await api.put(`/projects/${id}/members/${uid}`, { role })).data.data, myRole: project.myRole }); toast.success('Role updated'); } catch (e) { toast.error(errMsg(e)); }
  };
  const removeMember = async (uid, self) => {
    if (!window.confirm(self ? 'Leave this project?' : 'Remove this member?')) return;
    try {
      await api.delete(`/projects/${id}/members/${uid}`);
      loadProjects();
      if (self) { toast.success('You left the project'); nav('/projects'); } else load();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const del = async () => {
    if (!window.confirm(`Delete "${project.name}" and ALL its tasks? This cannot be undone.`)) return;
    try { await api.delete(`/projects/${id}`); toast.success('Project deleted'); loadProjects(); nav('/projects'); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="card flex flex-wrap items-center gap-4 overflow-hidden p-5" style={{ borderTop: `4px solid ${project.color}` }}>
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold" style={{ background: `${project.color}22`, color: project.color }}>{project.name[0]?.toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold">{project.name}</h1>
          <p className="muted text-sm">{project.description || 'No description'}</p>
        </div>
        <div className="flex -space-x-2">{project.members.slice(0, 5).map((m) => <Avatar key={m.user._id} user={m.user} size={34} />)}</div>
        {isAdmin && <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button>}
        {isOwner && <Button variant="danger" onClick={del}>Delete</Button>}
      </header>

      <div className="flex gap-1" role="tablist">
        {[['tasks', 'Tasks'], ['members', `Members (${project.members.length})`], ['activity', 'Activity']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === k ? 'bg-primary text-white shadow-glow' : 'hover:bg-primary/10'}`}>{l}</button>
        ))}
      </div>

      {tab === 'tasks' && <TaskWorkspace projectId={id} />}

      {tab === 'members' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <ul className="card divide-y lg:col-span-2" style={{ '--tw-divide-opacity': 1 }}>
            {project.members.map((m) => {
              const self = m.user._id === user._id;
              return (
                <li key={m.user._id} className="flex flex-wrap items-center gap-3 p-4" style={{ borderColor: 'var(--border)' }}>
                  <Avatar user={m.user} size={38} />
                  <div className="min-w-0 flex-1"><p className="truncate font-semibold">{m.user.name} {self && <span className="muted text-xs">(you)</span>}</p><p className="muted truncate text-xs">{m.user.email}</p></div>
                  {isOwner && m.role !== 'Owner' ? (
                    <select className="input !w-auto !py-1 text-xs" value={m.role} onChange={(e) => setRole(m.user._id, e.target.value)} aria-label={`Role for ${m.user.name}`}>
                      <option>Admin</option><option>Member</option>
                    </select>
                  ) : <span className="chip">{m.role === 'Owner' ? 'Owner' : m.role}</span>}
                  {m.role !== 'Owner' && (isAdmin || self) && <button className="text-xs font-semibold text-secondary hover:underline" onClick={() => removeMember(m.user._id, self)}>{self ? 'Leave' : 'Remove'}</button>}
                </li>
              );
            })}
            {project.pendingInvites?.map((i) => (
              <li key={i.email} className="muted flex items-center gap-3 p-4 text-sm"><Icon name="mail" size={14} /> {i.email} <span className="chip">Invited · {i.role}</span></li>
            ))}
          </ul>
          {isAdmin && (
            <form onSubmit={sendInvite} className="card h-fit space-y-3 p-5">
              <h2 className="font-bold">Invite a teammate</h2>
              <input className="input" type="email" required placeholder="teammate@example.com" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} aria-label="Email to invite" />
              <select className="input" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })} aria-label="Role"><option>Member</option><option>Admin</option></select>
              <Button className="w-full" loading={inviting}>Send invite</Button>
              <p className="muted text-xs">Existing users are added instantly. New people get an email and join when they sign up.</p>
            </form>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="card p-5">
          {activity.length === 0 ? <EmptyState icon="clock" title="No activity yet" /> : (
            <ul className="space-y-3">
              {activity.map((a) => (
                <li key={a._id} className="flex items-center gap-3 text-sm">
                  <Avatar user={a.user} size={28} /><span><b>{a.user?.name}</b> {a.action}</span>
                  <span className="muted ml-auto whitespace-nowrap text-xs">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {editing && <ProjectForm open project={project} onClose={() => setEditing(false)} onSaved={() => { load(); loadProjects(); }} />}
    </div>
  );
}
