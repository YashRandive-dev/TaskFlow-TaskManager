import {
  AlertTriangle, Archive, ArrowRight, Bell, BellRing, BookOpen, Briefcase, Calendar, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight,
  CircleDashed, Clock, Download, Eye, FileText, Flag, FolderKanban, GraduationCap, HeartPulse, Home, Image, Inbox, Info, KanbanSquare, Keyboard,
  LayoutDashboard, ListChecks, ListTodo, Loader, Lock, LogOut, Menu, MessageSquare, Moon, MoreHorizontal, Paperclip, Pencil, Play, Pause, Plus, Repeat,
  RotateCcw, Search, Settings, ShoppingCart, SkipForward, Sparkles, Sun, Tag, Target, Timer, Trash2, User, Users, X, Zap, Flame, Trophy, Mail, MapPin,
  Phone, Globe, Monitor, Smartphone, Tablet, KeyRound, Camera, Shield, SlidersHorizontal, Star, Layers, Activity, TrendingUp, Rocket, Coffee, Dumbbell, Wallet, Smile,
} from 'lucide-react';

export const ICONS = {
  alert: AlertTriangle, archive: Archive, arrow: ArrowRight, bell: Bell, bellring: BellRing, book: BookOpen, briefcase: Briefcase, calendar: Calendar,
  calendardays: CalendarDays, check: Check, checkcircle: CheckCircle2, left: ChevronLeft, right: ChevronRight, dashed: CircleDashed, clock: Clock,
  download: Download, eye: Eye, file: FileText, flag: Flag, kanban: KanbanSquare, projects: FolderKanban, grad: GraduationCap, heart: HeartPulse,
  home: Home, image: Image, inbox: Inbox, info: Info, keyboard: Keyboard, dashboard: LayoutDashboard, checklist: ListChecks, todo: ListTodo,
  progress: Loader, lock: Lock, logout: LogOut, menu: Menu, comment: MessageSquare, moon: Moon, more: MoreHorizontal, clip: Paperclip, edit: Pencil,
  play: Play, pause: Pause, plus: Plus, repeat: Repeat, reset: RotateCcw, search: Search, settings: Settings, cart: ShoppingCart, skip: SkipForward,
  sparkles: Sparkles, sun: Sun, tag: Tag, target: Target, timer: Timer, trash: Trash2, user: User, users: Users, x: X, zap: Zap, flame: Flame,
  trophy: Trophy, mail: Mail, pin: MapPin, phone: Phone, globe: Globe, camera: Camera, shield: Shield, sliders: SlidersHorizontal, star: Star,
  monitor: Monitor, smartphone: Smartphone, tablet: Tablet, key: KeyRound,
  layers: Layers, activity: Activity, trend: TrendingUp, rocket: Rocket, coffee: Coffee, dumbbell: Dumbbell, wallet: Wallet, smile: Smile, list: ListChecks,
};

/** <Icon name="trash" size={16} /> — consistent stroke icons used instead of emojis. */
export default function Icon({ name, size = 16, className = '', ...rest }) {
  const C = ICONS[name] || Tag;
  return <C width={size} height={size} strokeWidth={2} className={`shrink-0 ${className}`} aria-hidden="true" {...rest} />;
}

export const CategoryIcon = ({ icon, ...p }) => <Icon name={icon || 'tag'} {...p} />;
