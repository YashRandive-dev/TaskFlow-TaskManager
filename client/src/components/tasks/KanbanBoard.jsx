import { useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TaskCard from './TaskCard';
import { EmptyState } from '../ui';
import { STATUSES } from '../../utils/constants';
import Icon from '../ui/Icon';

function SortableCard({ task, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task._id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1, touchAction: 'manipulation' }}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} {...props} />
    </div>
  );
}

function Column({ status, ids, byId, cardProps, onAdd }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  return (
    <section
      aria-label={`${status.label} column`}
      className={`flex w-[290px] shrink-0 flex-col rounded-2xl border p-2.5 transition-colors sm:w-auto sm:min-w-0 sm:flex-1 ${isOver ? 'animate-pulseRing' : ''}`}
      style={{ background: isOver ? 'color-mix(in srgb, var(--primary) 10%, var(--surface-2))' : 'var(--surface-2)', borderColor: isOver ? 'var(--primary)' : 'var(--border)' }}
    >
      <header className="mb-2.5 flex items-center justify-between px-1.5">
        <h2 className="flex items-center gap-1.5 text-sm font-bold">
          <Icon name={status.icon} size={15} style={{ color: status.color }} /> {status.label}
          <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: status.color }}>{ids.length}</span>
        </h2>
        <button className="btn-ghost !p-1.5 text-xs" onClick={() => onAdd(status.id)} aria-label={`Add task to ${status.label}`}><Icon name="plus" size={16} /></button>
      </header>
      <div ref={setNodeRef} className="flex min-h-[120px] flex-1 flex-col gap-2.5">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id, i) => <SortableCard key={id} task={byId[id]} index={i} {...cardProps} />)}
        </SortableContext>
        {ids.length === 0 && <div className="muted rounded-xl border-2 border-dashed py-8 text-center text-xs" style={{ borderColor: 'var(--border)' }}>Drop tasks here</div>}
      </div>
    </section>
  );
}

const findContainer = (cols, id) => (id in cols ? id : Object.keys(cols).find((k) => cols[k].includes(id)));

export default function KanbanBoard({ tasks, onOpen, onToggle, onMove, onReorder, onAdd, categories }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const byId = useMemo(() => Object.fromEntries(tasks.map((t) => [t._id, t])), [tasks]);
  const derived = useMemo(() => {
    const cols = Object.fromEntries(STATUSES.map((s) => [s.id, []]));
    [...tasks].sort((a, b) => a.position - b.position).forEach((t) => cols[t.status]?.push(t._id));
    return cols;
  }, [tasks]);
  const [dragCols, setDragCols] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const cols = dragCols || derived;

  const onDragOver = ({ active, over }) => {
    if (!over) return;
    const base = dragCols || derived;
    const from = findContainer(base, active.id);
    const to = findContainer(base, over.id);
    if (!from || !to || from === to) return;
    const overIndex = over.id in base ? base[to].length : base[to].indexOf(over.id);
    setDragCols({
      ...base,
      [from]: base[from].filter((i) => i !== active.id),
      [to]: [...base[to].slice(0, overIndex), active.id, ...base[to].slice(overIndex)],
    });
  };

  const onDragEnd = ({ active, over }) => {
    const base = dragCols || derived;
    setActiveId(null);
    setDragCols(null);
    if (!over) return;
    const from = byId[active.id].status;
    const to = findContainer(base, active.id);
    let list = base[to];
    if (to === from) {
      const oldI = list.indexOf(active.id);
      const newI = over.id in base ? list.length - 1 : list.indexOf(over.id);
      if (oldI === newI) return;
      list = [...list];
      list.splice(oldI, 1);
      list.splice(newI, 0, active.id);
    }
    const idx = list.indexOf(active.id);
    const prev = byId[list[idx - 1]]?.position;
    const next = byId[list[idx + 1]]?.position;
    let position;
    if (prev !== undefined && next !== undefined) position = (prev + next) / 2;
    else if (prev !== undefined) position = prev + 1024;
    else if (next !== undefined) position = next / 2;
    else position = 1024;
    if (to === from) onReorder([{ id: active.id, position }]);
    else onMove(active.id, to, position);
  };

  const active = activeId ? byId[activeId] : null;
  const cardProps = { onOpen, onToggle, categories };

  if (!tasks.length) {
    return <EmptyState icon="checklist" title="No tasks here" hint="Use the New task button, or press N." />;
  }

  return (
    <DndContext
      sensors={sensors} collisionDetection={closestCorners}
      onDragStart={({ active: a }) => setActiveId(a.id)} onDragOver={onDragOver} onDragEnd={onDragEnd}
      onDragCancel={() => { setActiveId(null); setDragCols(null); }}
    >
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        {STATUSES.map((s) => <Column key={s.id} status={s} ids={cols[s.id]} byId={byId} cardProps={cardProps} onAdd={onAdd} />)}
      </div>
      <DragOverlay dropAnimation={{ duration: 220 }}>
        {active ? <TaskCard task={active} {...cardProps} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
