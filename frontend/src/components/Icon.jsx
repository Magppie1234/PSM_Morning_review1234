import { AlertCircle, CalendarDays, ChevronRight, Clock3, FileText, Flame, Phone, Target, UsersRound, IndianRupee, PencilRuler, Briefcase, Compass, Layers, CheckCircle2 } from 'lucide-react';

const icons = {
  users: UsersRound,
  phone: Phone,
  target: Target,
  file: FileText,
  calendar: CalendarDays,
  rupee: IndianRupee,
  alert: AlertCircle,
  clock: Clock3,
  flame: Flame,
  drawing: PencilRuler,
  ruler: PencilRuler,
  briefcase: Briefcase,
  compass: Compass,
  layers: Layers,
  check: CheckCircle2
};

export function Icon({ name, size = 20 }) {
  const Component = icons[name] ?? ChevronRight;
  return <Component aria-hidden="true" size={size} strokeWidth={2.2} />;
}

