import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import api, { errMsg, fileUrl } from '../../api/axios';
import { Avatar, Button, Field, Modal, ProgressBar } from '../ui';
import Icon from '../ui/Icon';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { useUI } from '../../context/UIContext';
import { DEFAULT_CATEGORIES, PRIORITIES, RECURRING, STATUSES } from '../../utils/constants';
import { formatMinutes, progressOf, toLocalInput } from '../../utils/helpers';

/** Edit dialog for an existing task. New tasks use the lighter TaskComposer. */
export default function TaskModal() {
  const { taskModal, closeTask, projects } = useUI();
  const { user } = useAuth();
  const { updateTask, deleteTask, archiveTask } = useTasks();
  const nav = useNavigate();
  const { open, taskId } = taskModal;
  const show = open && !!taskId;

  const [tab, setTab] = useState('details');
  const [form, setForm] = useState(null);
  const [task, setTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [more, setMore] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [subInput, setSubInput] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [activity, setActivity] = useState([]);

  const categories = user?.categories?.length ? user.categories : DEFAULT_CATEGORIES;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const members = (projects.find((p) => p._id === form?.project)?.members || []).map((m) => m.user);

  useEffect(() => {
    if (!show) return;
    setTab('details'); setMore(false); setPendingFiles([]); setComments([]); setActivity([]); setTask(null); setForm(null);
    api.get(`/tasks/${taskId}`)
      .then((r) => {
        const t = r.data.data;
        setTask(t);
        setForm({
          title: t.title, description: t.description, priority: t.priority, status: t.status, category: t.category,
          tags: t.tags, dueDate: toLocalInput(t.dueDate), recurring: t.recurring?.frequency || 'none',
          estimatedTime: t.estimatedTime, project: t.project?._id || '', assignees: t.assignees.map((a) => a._id),
          subtasks: t.subtasks.map((s) => ({ _id: s._id, title: s.title, done: s.done })),
        });
      })
      .catch((e) => { toast.error(errMsg(e)); closeTask(); });
  }, [show, taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!show) return;
    if (tab === 'comments') api.get(`/tasks/${taskId}/comments`).then((r) => setComments(r.data.data)).catch(() => {});
    if (tab === 'activity') api.get(`/tasks/${taskId}/activity`).then((r) => setActivity(r.data.data)).catch(() => {});
  }, [tab, show, taskId]);

  useEffect(() => {
    const h = (e) => { if (e.detail.taskId === taskId) setComments((c) => (c.some((x) => x._id === e.detail.comment._id) ? c : [...c, e.detail.comment])); };
    window.addEventListener('tf:comment', h);
    return () => window.removeEventListener('tf:comment', h);
  }, [taskId]);

  const save = async () => {
    if (!form.title.trim()) { toast.error('Enter a task title'); return; }
    setSaving(true);
    try {
      await updateTask(taskId, {
        ...form,
        title: form.title.trim(),
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        project: form.project || null,
        estimatedTime: Number(form.estimatedTime) || 0,
        subtasks: form.subtasks.map((s) => ({ ...(s._id ? { _id: s._id } : null), title: s.title, done: s.done })),
      });
      if (pendingFiles.length) {
        const fd = new FormData();
        pendingFiles.forEach((f) => fd.append('files', f));
        await api.post(`/tasks/${taskId}/attachments`, fd);
      }
      closeTask();
    } catch { /* toast shown by context */ } finally { setSaving(false); }
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '');
    if (t && !form.tags.includes(t)) set({ tags: [...form.tags, t] });
    setTagInput('');
  };
  const addSub = () => {
    if (!subInput.trim()) return;
    set({ subtasks: [...form.subtasks, { title: subInput.trim(), done: false }] });
    setSubInput('');
  };
  const sendComment = async () => {
    if (!commentText.trim()) return;
    try {
      const r = await api.post(`/tasks/${taskId}/comments`, { text: commentText.trim() });
      setComments((c) => (c.some((x) => x._id === r.data.data._id) ? c : [...c, r.data.data]));
      setCommentText('');
    } catch (e) { toast.error(errMsg(e)); }
  };
  const removeFile = async (id) => {
    try { setTask((await api.delete(`/tasks/${taskId}/attachments/${id}`)).data.data); } catch (e) { toast.error(errMsg(e)); }
  };

  const sub = form ? progressOf({ subtasks: form.subtasks }) : null;
  const tabs = [['details', 'Details'], ['comments', 'Comments'], ['files', `Files${task?.attachments?.length ? ` (${task.attachments.length})` : ''}`], ['activity', 'Activity']];

  return (
    <Modal
      open={show} onClose={closeTask} wide title="Edit task"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            <Button variant="ghost" className="!text-secondary" onClick={() => { deleteTask(taskId); closeTask(); }}><Icon name="trash" /> Delete</Button>
            <Button variant="ghost" onClick={() => { archiveTask(taskId, true); closeTask(); }}><Icon name="archive" /> Archive</Button>
            {user.purposes?.some((p) => ['work', 'study'].includes(p)) && <Button variant="ghost" onClick={() => { closeTask(); nav(`/focus?task=${taskId}`); }}><Icon name="timer" /> Focus</Button>}
          </div>
          <div className="flex gap-2"><Button variant="outline" onClick={closeTask}>Cancel</Button><Button onClick={save} loading={saving}>Save changes</Button></div>
        </div>
      }
    >
      {!form ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-10" />)}</div>
      ) : (
        <>
          <div className="-mt-1 mb-4 flex gap-1 overflow-x-auto border-b pb-2" style={{ borderColor: 'var(--border)' }} role="tablist">
            {tabs.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === id ? 'bg-primary text-white' : 'hover:bg-primary/10'}`}>{label}</button>
            ))}
          </div>

          {tab === 'details' && (
            <div className="space-y-4">
              <Field label="Title"><input className="input text-base font-semibold" value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={200} /></Field>
              <Field label="Notes"><textarea className="input min-h-[80px] resize-y" value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Add notes (optional)" /></Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Status">
                  <select className="input" value={form.status} onChange={(e) => set({ status: e.target.value })}>
                    {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="Priority">
                  <select className="input" value={form.priority} onChange={(e) => set({ priority: e.target.value })}>
                    {Object.entries(PRIORITIES).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
                  </select>
                </Field>
                <Field label="Category">
                  <select className="input" value={form.category} onChange={(e) => set({ category: e.target.value })}>
                    <option value="">None</option>
                    {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Due date and time"><input type="datetime-local" className="input" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} /></Field>
                <Field label="Repeat">
                  <select className="input" value={form.recurring} onChange={(e) => set({ recurring: e.target.value })}>
                    {RECURRING.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </Field>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="label !mb-0">Checklist</span>
                  {sub !== null && <span className="muted text-xs font-semibold">{sub}%</span>}
                </div>
                {sub !== null && <ProgressBar value={sub} className="mb-2" label="Checklist progress" />}
                <ul className="space-y-1.5">
                  {form.subtasks.map((s, i) => (
                    <li key={s._id || i} className="flex items-center gap-2">
                      <input type="checkbox" className="h-4 w-4 accent-[#3B6EA8]" checked={s.done} onChange={() => set({ subtasks: form.subtasks.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })} aria-label={`Mark "${s.title}" done`} />
                      <span className={`flex-1 text-sm ${s.done ? 'muted line-through' : ''}`}>{s.title}</span>
                      <button type="button" className="muted hover:text-secondary" aria-label={`Remove ${s.title}`} onClick={() => set({ subtasks: form.subtasks.filter((_, j) => j !== i) })}><Icon name="x" size={14} /></button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  <input className="input" placeholder="Add checklist item" value={subInput} onChange={(e) => setSubInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }} />
                  <button type="button" className="btn-outline" onClick={addSub}>Add</button>
                </div>
              </div>

              <button type="button" className="flex items-center gap-1.5 text-sm font-semibold text-primary" onClick={() => setMore((m) => !m)} aria-expanded={more}>
                <Icon name="right" size={14} className={more ? 'rotate-90 transition' : 'transition'} /> More options
              </button>
              {more && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Estimated time (minutes)" hint={`Time spent: ${formatMinutes(task?.timeSpent)}`}>
                    <input type="number" min="0" className="input" value={form.estimatedTime} onChange={(e) => set({ estimatedTime: e.target.value })} />
                  </Field>
                  {projects.length > 0 && (
                    <Field label="Project">
                      <select className="input" value={form.project} onChange={(e) => set({ project: e.target.value, assignees: [] })}>
                        <option value="">Personal (no project)</option>
                        {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                      </select>
                    </Field>
                  )}
                  <div className="sm:col-span-2">
                    <span className="label">Tags</span>
                    <div className="input flex flex-wrap items-center gap-1.5 !py-1.5">
                      {form.tags.map((t) => (
                        <span key={t} className="chip">#{t}<button type="button" aria-label={`Remove tag ${t}`} onClick={() => set({ tags: form.tags.filter((x) => x !== t) })}><Icon name="x" size={11} /></button></span>
                      ))}
                      <input className="min-w-[80px] flex-1 bg-transparent text-sm outline-none" placeholder="Add tag" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }} onBlur={addTag} />
                    </div>
                  </div>
                  {form.project && members.length > 0 && (
                    <div className="sm:col-span-2">
                      <span className="label">Assign to</span>
                      <div className="flex flex-wrap gap-2">
                        {members.map((m) => {
                          const on = form.assignees.includes(m._id);
                          return (
                            <button key={m._id} type="button" aria-pressed={on} onClick={() => set({ assignees: on ? form.assignees.filter((x) => x !== m._id) : [...form.assignees, m._id] })}
                              className={`flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-medium transition ${on ? 'border-primary bg-primary/10' : ''}`} style={on ? undefined : { borderColor: 'var(--border)' }}>
                              <Avatar user={m} size={22} /> {m.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'comments' && (
            <div>
              <ul className="mb-3 max-h-72 space-y-3 overflow-y-auto">
                {comments.length === 0 && <li className="muted py-6 text-center text-sm">No comments yet.</li>}
                {comments.map((c) => (
                  <li key={c._id} className="flex gap-2.5">
                    <Avatar user={c.user} size={30} />
                    <div className="flex-1 rounded-2xl rounded-tl-sm px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                      <p className="text-xs font-bold">{c.user?.name} <span className="muted font-normal">· {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span></p>
                      <p className="whitespace-pre-wrap break-words text-sm">{c.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input className="input" placeholder="Write a comment" value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendComment()} />
                <Button onClick={sendComment}>Send</Button>
              </div>
            </div>
          )}

          {tab === 'files' && (
            <div>
              <ul className="mb-3 space-y-2">
                {(task?.attachments || []).length === 0 && <li className="muted py-6 text-center text-sm">No files attached.</li>}
                {(task?.attachments || []).map((a) => (
                  <li key={a._id} className="flex items-center gap-3 rounded-xl border p-2.5" style={{ borderColor: 'var(--border)' }}>
                    <Icon name={a.mimeType?.startsWith('image/') ? 'image' : 'file'} size={18} className="muted" />
                    <a href={fileUrl(a.url)} target="_blank" rel="noreferrer" className="flex-1 truncate text-sm font-medium text-primary hover:underline">{a.name}</a>
                    <span className="muted text-xs">{Math.round((a.size || 0) / 1024)} KB</span>
                    <button className="text-secondary" aria-label={`Remove ${a.name}`} onClick={() => removeFile(a._id)}><Icon name="trash" size={15} /></button>
                  </li>
                ))}
              </ul>
              <input type="file" multiple className="input" onChange={(e) => setPendingFiles([...e.target.files].slice(0, 5))} />
              {pendingFiles.length > 0 && <p className="muted mt-2 text-xs">{pendingFiles.length} file(s) will upload when you save.</p>}
            </div>
          )}

          {tab === 'activity' && (
            <ul className="space-y-2.5">
              {activity.length === 0 && <li className="muted py-6 text-center text-sm">No activity yet.</li>}
              {activity.map((a) => (
                <li key={a._id} className="flex items-center gap-2.5 text-sm">
                  <Avatar user={a.user} size={24} />
                  <span><b>{a.user?.name}</b> {a.action}</span>
                  <span className="muted ml-auto whitespace-nowrap text-xs">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}
