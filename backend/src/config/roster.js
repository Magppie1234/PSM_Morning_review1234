// Who is a PSM and who is on the sales side, by Zoho owner name.
// Mirrors frontend/src/data/incentivePolicies.js (ROSTER_POLICY_MAP) — keep the two in step.

// The current PSM team, as in the Executive Command Centre (lib/summary-filters.ts → "PSM Team").
export const PSM_NAMES = new Set(['Deepak', 'Sparshan', 'Ishita', 'Sowmya']);

export const SALES_NAMES = new Set([
  'Tavneet', 'Harshita', 'Harshita Magppie', 'Pratyush',
  'Lang Takhel', 'Himanshu Thakur', 'Sakshi', 'Ashish', 'Abhinav Tomar', 'Arjun', 'Rananjay',
  'Rahul Mahajan', 'Siddharth', 'Shrestha', 'Rajkumar'
]);

export const ownerName = (lead) => lead.Owner?.name ?? 'Unassigned';

// PSMs take alternate Mondays off, in two pairs. MONDAY_ROTA_ANCHOR is a Monday on which the first pair
// works; every other Monday the pairs swap. Change the pairs or the anchor here if the rota changes.
const MONDAY_ROTA_ANCHOR = '2026-09-21';
const MONDAY_ROTA = [
  { working: ['Deepak', 'Sparshan'], off: ['Ishita', 'Sowmya'] },
  { working: ['Ishita', 'Sowmya'], off: ['Deepak', 'Sparshan'] }
];

// Who works and who is off on a given date (YYYY-MM-DD); null when the date is not a Monday.
export function mondayRota(iso) {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.getUTCDay() !== 1) return null;
  const weeks = Math.round((date - new Date(`${MONDAY_ROTA_ANCHOR}T00:00:00Z`)) / (7 * 86_400_000));
  return MONDAY_ROTA[((weeks % 2) + 2) % 2];
}
