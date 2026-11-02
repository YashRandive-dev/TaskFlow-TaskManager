import TaskWorkspace from '../components/tasks/TaskWorkspace';

export default function Tasks() {
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="mb-4 text-2xl font-extrabold sm:text-3xl">Tasks</h1>
      <TaskWorkspace />
    </div>
  );
}
