import { CalendarCheck } from 'lucide-react';

// PSMs take alternate Mondays off, in two pairs. ANCHOR is a Monday on which ROTATION[0] works;
// every other Monday the pairs swap. Change the pairs or the anchor here if the rota changes.
const ANCHOR = '2026-09-21';
const ROTATION = [
  { working: ['Deepak', 'Sparshan'], off: ['Ishita', 'Sowmya'] },
  { working: ['Ishita', 'Sowmya'], off: ['Deepak', 'Sparshan'] }
];

const istToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const join = (names) => names.join(' and ');

export function mondayRota(iso = istToday()) {
  const date = new Date(`${iso}T00:00:00Z`);
  if (date.getUTCDay() !== 1) return null;
  const weeks = Math.round((date - new Date(`${ANCHOR}T00:00:00Z`)) / (7 * 86_400_000));
  return ROTATION[((weeks % 2) + 2) % 2];
}

// Shown only on Mondays, at the top of the Pre Sales board.
export function MondayRoster() {
  const rota = mondayRota();
  if (!rota) return null;
  return (
    <div className="ps-rota" role="status" title={`${join(rota.off)} are on their alternate-Monday off.`}>
      <CalendarCheck size={16} aria-hidden="true" />
      <p>
        <strong>Monday roster: {join(rota.working)} working</strong>
        <span>{join(rota.off)} off today</span>
      </p>
    </div>
  );
}
