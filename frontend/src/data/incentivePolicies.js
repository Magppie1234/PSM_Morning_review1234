/**
 * MAGPPIE Official Incentive Policies (Pre-Sales v2 & Sales v2)
 * Mapped to individual team members per shared roster configuration.
 */

export const ROSTER_POLICY_MAP = {
  // Pre-Sales Team (PSM)
  'Sowmya': { role: 'PSM', type: 'presales', title: 'Pre-Sales Manager', targetText: '25+ Qualified Leads / Month' },
  'Ishita': { role: 'PSM', type: 'presales', title: 'Pre-Sales Manager', targetText: '25+ Qualified Leads / Month' },
  'Sparshan': { role: 'PSM', type: 'presales', title: 'Pre-Sales Manager', targetText: '25+ Qualified Leads / Month' },
  'Deepak': { role: 'PSM', type: 'presales', title: 'Pre-Sales Manager', targetText: '25+ Qualified Leads / Month' },
  'Vaishnavi': { role: 'PSM', type: 'presales', title: 'Pre-Sales Manager', targetText: '25+ Qualified Leads / Month' },
  'Anushka': { role: 'PSM', type: 'presales', title: 'Pre-Sales Manager', targetText: '25+ Qualified Leads / Month' },
  'Himanshu': { role: 'PSM', type: 'presales', title: 'Pre-Sales Manager', targetText: '25+ Qualified Leads / Month' },
  'Rahul': { role: 'PSM', type: 'presales', title: 'Pre-Sales Manager', targetText: '25+ Qualified Leads / Month' },

  // Sales Team (AVP, SM, ASM)
  'Tavneet': { role: 'AVP', type: 'sales', title: 'AVP Sales (Retail)', target: 90000000, targetText: '₹9.0 Cr / Month' },
  'Harshita': { role: 'AVP', type: 'sales', title: 'AVP Sales (Retail)', target: 90000000, targetText: '₹9.0 Cr / Month' },
  'Harshita Magppie': { role: 'AVP', type: 'sales', title: 'AVP Sales (Retail)', target: 90000000, targetText: '₹9.0 Cr / Month' },
  'Pratyush': { role: 'AVP', type: 'sales', title: 'AVP Sales (Projects)', target: 90000000, targetText: '₹9.0 Cr / Month' },

  'Lang Takhel': { role: 'SM', type: 'sales', title: 'Sales Manager (Retail)', target: 30000000, targetText: '₹3.0 Cr / Month' },
  'Himanshu Thakur': { role: 'SM', type: 'sales', title: 'Sales Manager (Retail)', target: 30000000, targetText: '₹3.0 Cr / Month' },
  'Sakshi': { role: 'SM', type: 'sales', title: 'Sales Manager (Retail)', target: 30000000, targetText: '₹3.0 Cr / Month' },
  'Ashish': { role: 'SM', type: 'sales', title: 'Sales Manager (Retail)', target: 30000000, targetText: '₹3.0 Cr / Month' },
  'Abhinav Tomar': { role: 'SM', type: 'sales', title: 'Sales Manager (Retail)', target: 30000000, targetText: '₹3.0 Cr / Month' },
  'Arjun': { role: 'SM', type: 'sales', title: 'Sales Manager (Retail)', target: 30000000, targetText: '₹3.0 Cr / Month' },
  'Rananjay': { role: 'SM', type: 'sales', title: 'Sales Manager (Projects)', target: 30000000, targetText: '₹3.0 Cr / Month' },

  'Rahul Mahajan': { role: 'ASM', type: 'sales', title: 'SM (ASM Policy)', target: 15000000, targetText: '₹1.5 Cr / Month' },
  'Siddharth': { role: 'ASM', type: 'sales', title: 'SM (ASM Policy)', target: 15000000, targetText: '₹1.5 Cr / Month' },
  'Shrestha': { role: 'ASM', type: 'sales', title: 'Assistant Sales Manager', target: 15000000, targetText: '₹1.5 Cr / Month' },
  'Rajkumar': { role: 'ASM', type: 'sales', title: 'Assistant Sales Manager', target: 15000000, targetText: '₹1.5 Cr / Month' }
};

export const PRESALES_POLICY_DETAILS = {
  policyName: 'Magppie Pre-Sales Incentive Policy v2',
  scope: 'Applicable to Pre-Sales Managers (PSM)',
  qualificationCriteria: [
    { title: 'Timeline Requirement', rule: 'Customer must require a kitchen within 3 months.' },
    { title: 'Budget Threshold', rule: 'Client budget must be ₹4 Lakhs or above.' },
    { title: 'CRM Logging', rule: 'Must be properly documented and logged in Zoho CRM.' }
  ],
  earningStreams: [
    {
      name: '1. Qualified Lead Slabs',
      description: 'The rate for the band reached applies to ALL qualified leads for that month (no tiered split).',
      slabs: [
        { range: '< 25 Leads', rate: '₹0 (Below eligibility)', notes: 'Minimum eligibility is 25 qualified leads' },
        { range: '25 – 49 Leads', rate: '₹100 per lead', notes: 'e.g. 40 leads = ₹4,000' },
        { range: '50 – 74 Leads', rate: '₹150 per lead', notes: 'e.g. 60 leads = ₹9,000' },
        { range: '75 – 99 Leads', rate: '₹200 per lead', notes: 'e.g. 80 leads = ₹16,000' },
        { range: '100+ Leads', rate: '₹250 per lead', notes: 'e.g. 110 leads = ₹27,500' }
      ]
    },
    {
      name: '2. Walk-in Client Reward',
      description: 'Flat ₹500 reward for each walk-in client brought in and attended by the Sales team.',
      rate: '₹500 / attended walk-in'
    },
    {
      name: '3. Closure Bonus',
      description: 'Flat ₹6,000 bonus for every qualified lead that converts into a booked closure (cross-month closures eligible).',
      rate: '₹6,000 / closure'
    }
  ],
  governance: [
    'Quarterly payout released subject to Accounts & Sales verification.',
    'Closure bonus credited upon receipt of 50% client booking payment.',
    'Cancellations/returns adjusted against subsequent month incentive.',
    'Incentive withheld if CRM activity or meeting notes are non-compliant.'
  ]
};

export const SALES_POLICY_DETAILS = {
  policyName: 'Magppie Sales Incentive Policy v2',
  scope: 'Applicable to Closers & Sales Leadership (AVP, SM, ASM)',
  targetsByRole: {
    'AVP': { target: '₹9.0 Cr / Month', territory: 'Regional / Division Territory' },
    'SM': { target: '₹3.0 Cr / Month', territory: 'Sales Manager Territory' },
    'ASM': { target: '₹1.5 Cr / Month', territory: 'Assistant Sales Manager Territory' }
  },
  coreRules: [
    {
      title: 'Minimum Eligibility Gate',
      detail: 'Must achieve at least 25% of monthly target. Below 25%, zero incentive is earned across all streams.'
    },
    {
      title: 'Net Realization Base',
      detail: 'Incentive is calculated strictly on Net Realization (excludes GST, discounts, appliances, and architect regard).'
    },
    {
      title: 'Discount Disqualification Cap (9%)',
      detail: 'Maximum allowable discount is 9%. Any deal closed above 9% discount is completely disqualified from incentive.'
    },
    {
      title: 'Low-Discount Extra Reward (< 5%)',
      detail: 'Deals closed at < 5% discount earn an extra reward = 10% × (9% - actual discount) applied to order value.'
    },
    {
      title: 'Over-Achievement Bonus (100%+)',
      detail: 'Crossing 100% of monthly target awards a flat bonus of ₹50,000 on top of the slab earnings.'
    },
    {
      title: 'Accrual & Payment Split',
      detail: 'Calculated incentive is credited upon receipt of 50% booking payment and disbursed with salary.'
    },
    {
      title: 'Performance Management (PIP)',
      detail: 'Under 50% target achievement in 2 out of 3 consecutive months triggers a formal Performance Improvement Plan.'
    }
  ]
};

export function getPersonPolicy(personName, mode = 'pre-sales') {
  const match = ROSTER_POLICY_MAP[personName] || {
    role: mode === 'sales' ? 'SM' : 'PSM',
    type: mode,
    title: mode === 'sales' ? 'Sales Manager' : 'Pre-Sales Manager',
    targetText: mode === 'sales' ? '₹3.0 Cr / Month' : '25+ Qualified Leads / Month'
  };

  const isSales = match.type === 'sales' || mode === 'sales';
  return {
    personName,
    ...match,
    isSales,
    details: isSales ? SALES_POLICY_DETAILS : PRESALES_POLICY_DETAILS
  };
}
