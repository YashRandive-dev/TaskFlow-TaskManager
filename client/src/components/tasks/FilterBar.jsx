import { forwardRef, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { errMsg } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { EMPTY_FILTERS, useTasks } from '../../context/TaskContext';
import { useUI } from '../../context/UIContext';
import { useDebounce } from '../../hooks/hooks';
import { DEFAULT_CATEGORIES, PRIORITIES, STATUSES } from '../../utils/constants';
import { downloadBlob } from '../../utils/helpers';
import Icon from '../ui/Icon';

const Toggle = ({ on, onClick, children }) => (
  <button type="button" aria-pressed={on} onClick={onClick}
    className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${on ? 'border-primary bg-primary text-white' : 'hover:border-primary'}`}
    style={on ? undefined : { borderColor: 'var(--border)' }}>{children}</button>
);

const FilterBar = forwardRef(function FilterBar({ hideProject = false }, searchRef) {
  const { user, setUser } = useAuth();
  const { filters, setFilters } = useTasks();
  const { projects } = useUI();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(filters.search);
  const dq = useDebounce(q, 300);
  const categories = user?.categories?.length ? user.categories : DEFAULT_CATEGORIES;

  useEffect(() => { setFilters((f) => (f.search === dq ? f : { ...f, search: dq })); }, [dq, setFilters]);
  useEffect(() => { if (filters.search === '' && q !== '') setQ(''); }, [filters.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key, val) => setFilters((f) => ({ ...f, [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val] }));
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const active = ['priority', 'status', 'category'].reduce((n, k) => n + filters[k].length, 0)
    + ['project', 'due', 'from', 'to'].filter((k) => filters[k] && !(hideProject && k === 'project')).length;

  const saveFilter = async () => {
    const name = window.prompt('Name this filter');
    if (!name?.trim()) return;
    const { search, sort, order, ...rest } = filters;
    const next = [...(user.savedFilters || []).filter((s) => s.name !== name.trim()), { name: name.trim(), filters: { ...rest, search, sort, order } }];
    try {
      const r = await api.put('/users/me', { savedFilters: JSON.stringify(next) });
      setUser(r.data.data);
      toast.success('Filter saved');
    } catch (e) { toast.error(errMsg(e)); }
  };
  const deleteSaved = async (name) => {
    try {
      const r = await api.put('/users/me', { savedFilters: JSON.stringify(user.savedFilters.filter((s) => s.name !== name)) });
      setUser(r.data.data);
    } catch (e) { toast.error(errMsg(e)); }
  };
  const exportTasks = async (format) => {
    try {
      const r = await api.get('/tasks/export', { params: { format }, responseType: 'blob' });
      downloadBlob(r.data, `taskflow-tasks.${format}`);
      toast.success(`Exported ${format.toUpperCase()}`);
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" aria-hidden><Icon name="search" size={15} className="muted" /></span>
          <input ref={searchRef} className="input !pl-9" placeholder="Search tasks…  ( / )" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tasks" />
        </div>
        <select className="input !w-auto" value={`${filters.sort}:${filters.order}`} aria-label="Sort tasks"
          onChange={(e) => { const [sort, order] = e.target.value.split(':'); set({ sort, order }); }}>
          <option value="position:asc">Manual order</option>
          <option value="dueDate:asc">Due date ↑</option>
          <option value="dueDate:desc">Due date ↓</option>
          <option value="priority:desc">Priority high→low</option>
          <option value="priority:asc">Priority low→high</option>
          <option value="createdAt:desc">Newest</option>
          <option value="createdAt:asc">Oldest</option>
          <option value="title:asc">Title A→Z</option>
        </select>
        <button className="btn-outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>Filters{active ? ` (${active})` : ''}</button>
        <div className="relative">
          <details className="group">
            <summary className="btn-outline cursor-pointer list-none">Saved</summary>
            <div className="card absolute right-0 z-20 mt-1 w-56 p-2">
              {(user.savedFilters || []).map((s) => (
                <div key={s.name} className="flex items-center justify-between rounded-lg px-2 py-1 hover:bg-primary/10">
                  <button className="flex-1 text-left text-sm" onClick={() => setFilters({ ...EMPTY_FILTERS, ...s.filters })}>{s.name}</button>
                  <button className="text-xs text-secondary" aria-label={`Delete saved filter ${s.name}`} onClick={() => deleteSaved(s.name)}><Icon name="x" size={13} /></button>
                </div>
              ))}
              {!(user.savedFilters || []).length && <p className="muted p-2 text-xs">No saved filters yet.</p>}
              <button className="btn-primary mt-1 w-full !py-1.5 text-xs" onClick={saveFilter}>Save current filters</button>
            </div>
          </details>
        </div>
        <div className="relative">
          <details>
            <summary className="btn-outline cursor-pointer list-none" aria-label="Export tasks">Export</summary>
            <div className="card absolute right-0 z-20 mt-1 w-36 p-1.5">
              <button className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-primary/10" onClick={() => exportTasks('csv')}>CSV</button>
              <button className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-primary/10" onClick={() => exportTasks('json')}>JSON</button>
            </div>
          </details>
        </div>
      </div>

      {open && (
        <div className="card space-y-3 p-3.5">
          <div className="flex flex-wrap items-center gap-1.5"><span className="label !mb-0 w-20">Priority</span>
            {Object.entries(PRIORITIES).map(([k, p]) => <Toggle key={k} on={filters.priority.includes(k)} onClick={() => toggle('priority', k)}>{p.label}</Toggle>)}</div>
          <div className="flex flex-wrap items-center gap-1.5"><span className="label !mb-0 w-20">Status</span>
            {STATUSES.map((s) => <Toggle key={s.id} on={filters.status.includes(s.id)} onClick={() => toggle('status', s.id)}>{s.label}</Toggle>)}</div>
          <div className="flex flex-wrap items-center gap-1.5"><span className="label !mb-0 w-20">Category</span>
            {categories.map((c) => <Toggle key={c.name} on={filters.category.includes(c.name)} onClick={() => toggle('category', c.name)}>{c.name}</Toggle>)}</div>
          <div className="grid gap-3 sm:grid-cols-4">
            {!hideProject && (
              <label><span className="label">Project</span>
                <select className="input" value={filters.project} onChange={(e) => set({ project: e.target.value })}>
                  <option value="">All</option><option value="none">Personal</option>
                  {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select></label>
            )}
            <label><span className="label">Due</span>
              <select className="input" value={filters.due} onChange={(e) => set({ due: e.target.value, from: '', to: '' })}>
                <option value="">Any time</option><option value="today">Today</option><option value="overdue">Overdue</option>
              </select></label>
            <label><span className="label">Due from</span><input type="date" className="input" value={filters.from} onChange={(e) => set({ from: e.target.value, due: '' })} /></label>
            <label><span className="label">Due to</span><input type="date" className="input" value={filters.to} onChange={(e) => set({ to: e.target.value ? `${e.target.value}T23:59:59` : '', due: '' })} /></label>
          </div>
          <button className="btn-ghost text-xs" onClick={() => setFilters((f) => ({ ...EMPTY_FILTERS, project: hideProject ? f.project : '', sort: f.sort, order: f.order }))}>Clear filters</button>
        </div>
      )}
    </div>
  );
});

export default FilterBar;
