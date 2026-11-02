import { useEffect, useRef } from 'react';
import { TaskSkeletons } from '../ui';
import Icon from '../ui/Icon';
import KanbanBoard from './KanbanBoard';
import ListView from './ListView';
import CalendarView from './CalendarView';
import FilterBar from './FilterBar';
import QuickAdd from './QuickAdd';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { useUI } from '../../context/UIContext';
import { DEFAULT_CATEGORIES } from '../../utils/constants';
import { toLocalInput } from '../../utils/helpers';

const VIEWS = [['kanban', 'kanban', 'Board'], ['list', 'list', 'List'], ['calendar', 'calendardays', 'Calendar']];

/** Kanban / List / Calendar with search, filters and quick-add. Optionally scoped to a project. */
export default function TaskWorkspace({ projectId }) {
  const { user } = useAuth();
  const { tasks, loading, filters, setFilters, changeStatus, reorder, updateTask, deleteTask, focusMode, setFocusMode } = useTasks();
  const { view, setView, openTask, newTask } = useUI();
  const searchRef = useRef(null);
  const categories = user.categories?.length ? user.categories : DEFAULT_CATEGORIES;
  const base = projectId ? { project: projectId } : {};

  useEffect(() => {
    const h = () => searchRef.current?.focus();
    window.addEventListener('tf:focus-search', h);
    return () => window.removeEventListener('tf:focus-search', h);
  }, []);

  // scope to a project while mounted
  useEffect(() => {
    if (!projectId) return undefined;
    setFilters((f) => ({ ...f, project: projectId }));
    return () => setFilters((f) => ({ ...f, project: '' }));
  }, [projectId, setFilters]);

  const toggle = (t) => changeStatus(t._id, t.status === 'done' ? 'todo' : 'done');
  const sortBy = (key) => setFilters((f) => ({ ...f, sort: key, order: f.sort === key && f.order === 'asc' ? 'desc' : 'asc' }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-2xl border p-1" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} role="tablist" aria-label="Task view">
          {VIEWS.map(([id, icon, label]) => (
            <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}
              className={`rounded-xl px-3.5 py-1.5 text-sm font-semibold transition ${view === id ? 'bg-primary text-white shadow-glow' : 'hover:bg-primary/10'}`}>
              <span className="inline-flex items-center gap-1.5"><Icon name={icon} size={15} /> {label}</span>
            </button>
          ))}
        </div>
      </div>

      {focusMode && (
        <div className="flex items-center justify-between rounded-2xl border border-accent/50 bg-accent/10 px-4 py-2.5 text-sm font-medium">
          <span><b>Today only</b> — showing tasks due today.</span>
          <button className="font-semibold text-primary hover:underline" onClick={() => setFocusMode(false)}>Turn off</button>
        </div>
      )}

      <QuickAdd defaults={base} />
      <FilterBar ref={searchRef} hideProject={!!projectId} />

      {loading && !tasks.length ? (
        <TaskSkeletons count={5} />
      ) : view === 'kanban' ? (
        <KanbanBoard tasks={tasks} categories={categories} onOpen={openTask} onToggle={toggle} onMove={changeStatus} onReorder={reorder} onAdd={(status) => newTask({ ...base, status })} />
      ) : view === 'list' ? (
        <ListView tasks={tasks} categories={categories} sort={filters.sort} order={filters.order} onSort={sortBy} onOpen={openTask} onToggle={toggle} onUpdate={updateTask} onDelete={deleteTask} />
      ) : (
        <CalendarView tasks={tasks} onOpen={openTask} onCreate={(d) => { const x = new Date(d); x.setHours(9, 0, 0, 0); newTask({ ...base, dueDate: toLocalInput(x) }); }} />
      )}
    </div>
  );
}
