// Approved monthly PSM qualification targets (₹ of qualified-opportunity sales value), keyed 'YYYY-MM'.
//   2026-08  from the Executive Command Centre (components/features/BDTab → AUGUST_BD_TARGETS)
//   2026-09  from the PSM Leaderboard shared on 21 Sept 2026
//   2026-10  ₹55 crore total requested on 3 Oct 2026; September's allocation carried forward
// Add next month's figures here when they are approved; a month without an entry shows as NA.
const CRORE = 1e7;

export const PSM_MONTHLY_TARGETS = {
  '2026-08': { Deepak: 5 * CRORE, Sparshan: 5 * CRORE, Sowmya: 20 * CRORE, Ishita: 14 * CRORE },
  '2026-09': { Deepak: 10 * CRORE, Ishita: 15 * CRORE, Sowmya: 20 * CRORE, Sparshan: 10 * CRORE },
  '2026-10': { Deepak: 10 * CRORE, Ishita: 15 * CRORE, Sowmya: 20 * CRORE, Sparshan: 10 * CRORE }
};
