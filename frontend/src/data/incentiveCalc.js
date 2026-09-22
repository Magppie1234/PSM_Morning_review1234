// Incentive maths that follows the written Magppie policies (see incentivePolicies.js).
// Nothing here is estimated: a stream whose inputs aren't in Zoho is returned as null ("NA").

const WON_STAGE = /closed won|order booked|\bwon\b/i;
const lakhToRupees = (text) => {
  const number = Number(String(text ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(number) ? number * 100000 : 0;
};

// Pre-Sales Incentive Policy v2: slab rate applies to all qualified leads once 25 are reached.
const PRESALES_SLABS = [
  { min: 100, rate: 250, band: '100+ leads' },
  { min: 75, rate: 200, band: '75 – 99 leads' },
  { min: 50, rate: 150, band: '50 – 74 leads' },
  { min: 25, rate: 100, band: '25 – 49 leads' }
];
const PRESALES_GATE = 25;
const CLOSURE_BONUS = 6000;

export function calculatePreSalesIncentive(row = {}) {
  const qualified = Number(row.qualified ?? 0);
  const bookings = Number(row.bookings ?? 0);
  const slab = PRESALES_SLABS.find((item) => qualified >= item.min) ?? null;
  const qualification = slab ? qualified * slab.rate : 0;
  const closures = bookings * CLOSURE_BONUS;
  return {
    qualified,
    bookings,
    eligible: qualified >= PRESALES_GATE,
    progress: Math.round((qualified / PRESALES_GATE) * 100),
    slab,
    streams: [
      {
        key: 'qualification',
        title: 'Qualified lead slab',
        amount: qualification,
        tag: slab ? `₹${slab.rate} / lead` : 'Below 25 leads',
        detail: slab
          ? `${qualified} qualified leads in the ${slab.band} band; the rate applies to all of them.`
          : `${qualified} qualified leads. The slab starts at 25 qualified leads, so this pays ₹0.`
      },
      {
        key: 'walkins',
        title: 'Walk-in client reward',
        amount: null,
        tag: '₹500 / walk-in',
        detail: 'Attended walk-ins are not recorded in Zoho, so this cannot be calculated.'
      },
      {
        key: 'closures',
        title: 'Closure bonus',
        amount: closures,
        tag: '₹6,000 / closure',
        detail: `${bookings} qualified ${bookings === 1 ? 'lead' : 'leads'} converted to a booked order.`
      }
    ],
    total: qualification + closures
  };
}

// Sales Incentive Policy v2: nothing is earned below 25% of the monthly target.
const SALES_GATE = 0.25;
const ARCHITECT_BONUS = 10000;
const OVERACHIEVEMENT_BONUS = 50000;
// The policy does not publish base commission rates; these are the tiers this dashboard assumes.
const BASE_RATE_TIERS = [
  { min: 1, rate: 0.015 },
  { min: 0.75, rate: 0.012 },
  { min: 0.5, rate: 0.01 },
  { min: 0, rate: 0.0075 }
];

export function calculateSalesIncentive({ row = {}, deals = [], personName, monthlyTarget }) {
  const mine = deals.filter((deal) => !personName || deal.owner === personName);
  const won = mine.filter((deal) => WON_STAGE.test(deal.stage ?? ''));
  const realization = won.reduce((total, deal) => total + lakhToRupees(deal.value), 0);
  const achievement = monthlyTarget ? realization / monthlyTarget : 0;
  const eligible = achievement >= SALES_GATE;
  const baseRate = BASE_RATE_TIERS.find((tier) => achievement >= tier.min).rate;
  const architectWins = won.filter((deal) => deal.architect && deal.architect !== '—').length;

  const base = eligible ? realization * baseRate : 0;
  const architect = eligible ? architectWins * ARCHITECT_BONUS : 0;
  const overachievement = achievement >= 1 ? OVERACHIEVEMENT_BONUS : 0;
  const gateNote = eligible ? '' : ' Paid only after reaching 25% of target.';

  return {
    opportunities: Number(row.deals ?? mine.length),
    wonCount: won.length,
    realization,
    achievement,
    progress: Math.round(achievement * 100),
    eligible,
    streams: [
      {
        key: 'base',
        title: 'Order realization commission',
        amount: base,
        tag: `${(baseRate * 100).toFixed(2)}% (assumed tier)`,
        detail: `${won.length} won ${won.length === 1 ? 'order' : 'orders'} worth ₹${(realization / 100000).toFixed(1)}L.${gateNote}`
      },
      {
        key: 'discount',
        title: 'Low-discount extra reward',
        amount: null,
        tag: '10% × (9% − discount)',
        detail: 'Deal discounts are not recorded in the dashboard data, so this cannot be calculated.'
      },
      {
        key: 'architect',
        title: 'Architect project bonus',
        amount: architect,
        tag: '₹10,000 / closed project',
        detail: `${architectWins} won ${architectWins === 1 ? 'order' : 'orders'} with an architect partner.${gateNote}`
      },
      {
        key: 'overachievement',
        title: 'Over-achievement bonus',
        amount: overachievement,
        tag: '₹50,000 at 100%',
        detail: achievement >= 1 ? 'Monthly target reached.' : 'Unlocks at 100% of the monthly target.'
      }
    ],
    total: base + architect + overachievement
  };
}
