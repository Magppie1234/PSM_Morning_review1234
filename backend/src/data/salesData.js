export const salesData = {
  meta: {
    isDemo: false,
    reportLabel: 'Active Pipeline · Live CRM',
    mappingNotice: 'Deals synced from Zoho CRM Orders/Opportunities.'
  },
  filters: {
    owners: ['All Sales Reps', 'Abhinav Tomar', 'Arjun', 'Ashish', 'Harshita Magppie', 'Himanshu Thakur', 'Lang Takhel', 'Rahul Mahajan', 'Sakshi', 'Siddharth', 'Tavneet'],
    stages: ['All Stages', 'Designer Assigned', 'Sent for Approval', 'Query to SM', 'Price Discussion', 'Closed Won'],
    products: ['All Product', 'Kitchen', 'Wardrobe', 'Pantry', 'Complete Interior'],
    sources: ['All Lead source', 'Architect', 'Direct Client', 'Referral', 'Walk-in']
  },
  kpis: [
    { label: 'Active Opportunities', value: '24', tone: 'blue', icon: 'briefcase' },
    { label: 'Deals by Architect', value: '8', subtext: '33.3% of pipeline', tone: 'blue', icon: 'ruler' },
    { label: 'In Design / Layout', value: '11', subtext: '45.8% of active', tone: 'blue', icon: 'drawing' },
    { label: 'Sent for Approval', value: '5', subtext: 'Awaiting SM review', tone: 'blue', icon: 'file' },
    { label: 'Price Discussion', value: '4', subtext: 'Negotiation stage', tone: 'blue', icon: 'target' },
    { label: 'Active Pipeline Value', value: '₹148.5L', tone: 'blue', icon: 'rupee' }
  ],
  risks: [
    { label: 'Overdue Follow-ups', value: '3', tone: 'danger', icon: 'alert' },
    { label: 'Approval Stuck 5+ Days', value: '2', tone: 'danger', icon: 'clock' },
    { label: 'Design Delayed 7+ Days', value: '4', tone: 'warning', icon: 'file' },
    { label: 'High Value at Risk (₹20L+)', value: '3', tone: 'danger', icon: 'flame' },
    { label: 'Stale Deals (No Touch)', value: '5', tone: 'warning', icon: 'clock' }
  ],
  performance: [
    { owner: 'Lang Takhel', deals: 6, architectDeals: 2, design: 3, approval: 1, price: 1, won: 1, value: '₹42.8L', overdue: 1, status: 'Watch', tone: 'warning' },
    { owner: 'Sakshi', deals: 5, architectDeals: 2, design: 2, approval: 1, price: 1, won: 1, value: '₹34.5L', overdue: 0, status: 'On track', tone: 'success' },
    { owner: 'Ashish', deals: 4, architectDeals: 1, design: 2, approval: 1, price: 1, won: 0, value: '₹29.5L', overdue: 1, status: 'Watch', tone: 'warning' },
    { owner: 'Tavneet', deals: 4, architectDeals: 1, design: 1, approval: 1, price: 0, won: 2, value: '₹47.2L', overdue: 0, status: 'On track', tone: 'success' },
    { owner: 'Harshita Magppie', deals: 3, architectDeals: 1, design: 2, approval: 0, price: 1, won: 0, value: '₹17.7L', overdue: 0, status: 'On track', tone: 'success' },
    { owner: 'Rahul Mahajan', deals: 2, architectDeals: 1, design: 1, approval: 1, price: 0, won: 0, value: '₹12.0L', overdue: 1, status: 'Watch', tone: 'warning' }
  ],
  deals: [
    { id: '1032257000027463022', name: 'Mr. Rajeev Agarwal - Kitchen - Ground floor', owner: 'Lang Takhel', stage: 'Designer Assigned', product: 'Kitchen', architect: 'Ar. Sharma Studio', created: '2026-09-17', followUp: '2026-09-19', value: '₹23.6L' },
    { id: '1032257000027455008', name: 'Mrs. Jaskiran Ji - Kitchen - Ground floor', owner: 'Sakshi', stage: 'Sent for Approval', product: 'Kitchen', architect: '—', created: '2026-09-17', followUp: '2026-09-18', value: '₹11.8L' },
    { id: '1032257000027453063', name: 'Mr. Adharsh - Luxury Kitchen', owner: 'Tavneet', stage: 'Price Discussion', product: 'Kitchen', architect: 'Ar. Manish Kumwat', created: '2026-09-18', followUp: '2026-09-20', value: '₹47.2L' },
    { id: '1032257000027453020', name: 'Arafath Abdul Majeed - Kitchen & Wardrobe', owner: 'Harshita Magppie', stage: 'Designer Assigned', product: 'Kitchen', architect: 'Ar. Arafath Abdul Majeed', created: '2026-09-17', followUp: '2026-09-19', value: '₹17.7L' },
    { id: '1032257000027446015', name: 'Rashmi - Complete Interior', owner: 'Ashish', stage: 'Query to SM', product: 'Complete Interior', architect: '—', created: '2026-09-17', followUp: '2026-09-18', value: '₹29.5L' }
  ],
  decisions: [
    { lead: 'Mr. Adharsh - Luxury Kitchen', id: '1032257000027453063 · Kitchen', psm: 'Tavneet', priority: 'High', ageing: '4 days', risk: 'High value (₹47.2L) in final price discussion', action: 'Finalize commercial offer & close' },
    { lead: 'Rashmi - Complete Interior', id: '1032257000027446015 · Complete Interior', psm: 'Ashish', priority: 'High', ageing: '5 days', risk: 'SM query pending for drawing approval', action: 'Expedite SM / management approval' },
    { lead: 'Mrs. Jaskiran Ji - Kitchen', id: '1032257000027455008 · Kitchen', psm: 'Sakshi', priority: 'High', ageing: '6 days', risk: 'Follow-up date has passed', action: 'Follow up with client immediately' },
    { lead: 'Arafath Abdul Majeed - Kitchen', id: '1032257000027453020 · Kitchen', psm: 'Harshita Magppie', priority: 'Medium', ageing: '7 days', risk: 'Design / drawings pending > 7 days', action: 'Review drawing progress with designer' }
  ],
  funnel: [
    { label: 'Total Opportunities', value: 24, conversion: '100%', icon: 'briefcase' },
    { label: 'Designer Assigned', value: 11, conversion: '45.8%', icon: 'drawing' },
    { label: 'Sent for Approval', value: 5, conversion: '45.5%', icon: 'file' },
    { label: 'Price Discussion', value: 4, conversion: '80.0%', icon: 'target' },
    { label: 'Closed / Won', value: 3, conversion: '75.0%', icon: 'calendar' }
  ]
};
