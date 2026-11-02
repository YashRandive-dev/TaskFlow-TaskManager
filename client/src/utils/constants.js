export const PRIORITIES = {
  high: { label: 'High', icon: 'flag', color: '#C8553D', rank: 3 },
  medium: { label: 'Medium', icon: 'flag', color: '#C98A1B', rank: 2 },
  low: { label: 'Low', icon: 'flag', color: '#3E9B73', rank: 1 },
};

export const STATUSES = [
  { id: 'todo', label: 'To Do', icon: 'todo', color: '#7B8BA0' },
  { id: 'inprogress', label: 'In Progress', icon: 'progress', color: '#3B6EA8' },
  { id: 'review', label: 'Review', icon: 'eye', color: '#C98A1B' },
  { id: 'done', label: 'Done', icon: 'checkcircle', color: '#3E9B73' },
];
export const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.id, s]));

export const PURPOSES = [
  { id: 'work', name: 'Work', icon: 'briefcase', desc: 'Projects, deadlines and team collaboration' },
  { id: 'study', name: 'Study', icon: 'book', desc: 'Assignments, exams and focused study sessions' },
  { id: 'health', name: 'Health', icon: 'heart', desc: 'Workouts, habits and daily wellness routines' },
  { id: 'shopping', name: 'Shopping', icon: 'cart', desc: 'Grocery lists and things to buy' },
  { id: 'personal', name: 'Personal', icon: 'home', desc: 'Errands, home and everyday life' },
];

export const DEFAULT_CATEGORIES = [{ name: 'Personal', icon: 'home' }];

/** Ready-made task ideas per purpose for the quick composer. */
export const SUGGESTIONS = {
  work: [
    { title: 'Team stand-up', type: 'daily' },
    { title: 'Review pending emails', type: 'daily' },
    { title: 'Weekly status report', type: 'weekly' },
  ],
  study: [
    { title: 'Revise notes', type: 'daily' },
    { title: 'Complete assignment', type: 'scheduled' },
    { title: 'Practice problems', type: 'daily' },
  ],
  health: [
    { title: 'Workout', type: 'daily' },
    { title: 'Drink 2L of water', type: 'daily' },
    { title: 'Take vitamins', type: 'daily' },
  ],
  shopping: [
    { title: 'Weekly groceries', type: 'weekly' },
    { title: 'Pick up essentials', type: 'today' },
  ],
  personal: [
    { title: 'Pay monthly bills', type: 'monthly' },
    { title: 'Call family', type: 'weekly' },
    { title: 'Tidy up home', type: 'weekly' },
  ],
};

/** What kind of task is it? Drives due date + repeat in the composer. */
export const TASK_TYPES = [
  { id: 'today', label: 'Today', hint: 'Due today' },
  { id: 'daily', label: 'Daily', hint: 'Repeats every day' },
  { id: 'weekly', label: 'Weekly', hint: 'Repeats every week' },
  { id: 'monthly', label: 'Monthly', hint: 'Repeats every month' },
  { id: 'scheduled', label: 'Scheduled', hint: 'Pick a date and time' },
  { id: 'anytime', label: 'No date', hint: 'Whenever you get to it' },
];

export const RECURRING = [
  { id: 'none', label: 'Does not repeat' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

export const PROJECT_COLORS = ['#3B6EA8', '#C8553D', '#3E9B73', '#C98A1B', '#6B5B95', '#2A8C9B', '#7B8BA0'];
