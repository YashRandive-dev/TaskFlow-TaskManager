import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api/axios';
import { useUI } from '../context/UIContext';
import { AvatarStack, Button, EmptyState, Field, Modal, ProgressBar } from '../components/ui';
import { PROJECT_COLORS } from '../utils/constants';

export function ProjectForm({ open, onClose, project, onSaved }) {
  const [f, setF] = useState(() => ({ name: project?.name || '', description: project?.description || '', color: project?.color || '#3B6EA8' }));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!f.name.trim()) return toast.error('Name your project');
    setBusy(true);
    try {
      const r = project ? await api.put(`/projects/${project._id}`, f) : await api.post('/projects', f);
      toast.success(project ? 'Project updated' : 'Project created');
      onSaved(r.data.data);
      onClose();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={project ? 'Edit project' : 'New project'}
      footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>{project ? 'Save' : 'Create project'}</Button></div>}>
      <div className="space-y-4">
        <Field label="Name"><input className="input" autoFocus maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Website redesign" /></Field>
        <Field label="Description"><textarea className="input" rows={2} maxLength={500} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div><span className="label">Colour</span><div className="flex flex-wrap gap-2">
          {PROJECT_COLORS.map((c) => <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={f.color === c} onClick={() => setF({ ...f, color: c })} className="h-8 w-8 rounded-full ring-offset-2 transition" style={{ background: c, boxShadow: f.color === c ? `0 0 0 3px var(--surface), 0 0 0 5px ${c}` : 'none' }} />)}
        </div></div>
      </div>
    </Modal>
  );
}

export default function Projects() {
  const { projects, loadProjects } = useUI();
  const [open, setOpen] = useState(false);
  const loaded = projects !== null;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold sm:text-3xl">Projects</h1><p className="muted text-sm">Workspaces to plan together with your team.</p></div>
        <Button onClick={() => setOpen(true)}>New project</Button>
      </div>
      {loaded && projects.length === 0 ? (
        <div className="card"><EmptyState icon="projects" title="No projects yet" hint="Create a project, invite teammates and assign tasks." action={<Button onClick={() => setOpen(true)}>Create your first project</Button>} /></div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p, i) => {
            const pct = p.taskCount ? Math.round((p.doneCount / p.taskCount) * 100) : 0;
            return (
              <motion.div key={p._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link to={`/projects/${p._id}`} className="card card-hover block overflow-hidden">
                  <div className="h-2" style={{ background: p.color }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-bold" style={{ background: `${p.color}22`, color: p.color }}>{p.name[0]?.toUpperCase()}</span>
                      <span className="chip">{p.myRole}</span>
                    </div>
                    <h2 className="mt-3 font-bold">{p.name}</h2>
                    <p className="muted mt-0.5 line-clamp-2 min-h-[2.5rem] text-sm">{p.description || 'No description'}</p>
                    <div className="mt-3"><ProgressBar value={pct} label={`${p.name} progress`} /></div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="muted text-xs">{p.doneCount}/{p.taskCount} tasks · {pct}%</span>
                      <AvatarStack users={p.members.map((m) => m.user)} />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
      {open && <ProjectForm open onClose={() => setOpen(false)} onSaved={loadProjects} />}
    </div>
  );
}
