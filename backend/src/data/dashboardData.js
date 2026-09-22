export const dashboardData = {
  meta: { isDemo: true, reportLabel: 'Yesterday · 17 Sep 2026' },
  filters: {
    psms: ['All PSM', 'Vaishnavi', 'Anushka', 'Sakshi', 'Himanshu', 'Rahul'],
    cities: ['All City', 'Delhi', 'Mumbai', 'Bengaluru', 'Pune'],
    products: ['All Product', 'Modular Kitchen', 'Wardrobes', 'Interiors'],
    leadSources: ['All Lead source', 'Walk-in', 'Website', 'Referral', 'Campaign']
  },
  kpis: [
    { label: 'Leads received', value: '126', trend: '+14%', comparison: 'vs 110 (16 Sep)', tone: 'blue', icon: 'users' },
    { label: 'Leads by Architect', value: '42', subtext: '33.3% of received', trend: '+18%', comparison: 'vs 35 (16 Sep)', tone: 'blue', icon: 'ruler' },
    { label: 'Contacted', value: '104', subtext: '82.5% of leads', trend: '+6%', comparison: 'vs 98 (16 Sep)', tone: 'blue', icon: 'phone' },
    { label: 'Qualified', value: '48', subtext: '46.2% of contacted', trend: '+11%', comparison: 'vs 43 (16 Sep)', tone: 'blue', icon: 'target' },
    { label: 'Enabled', value: '31', subtext: '64.6% of qualified', trend: '+3%', comparison: 'vs 30 (16 Sep)', tone: 'blue', icon: 'file' },
    { label: 'Bookings', value: '12', trend: '+33%', comparison: 'vs 9 (16 Sep)', tone: 'blue', icon: 'calendar' },
    { label: 'Business value', value: '₹42.8L', trend: '+27%', comparison: 'vs ₹33.7L (16 Sep)', tone: 'blue', icon: 'rupee' }
  ],
  risks: [
    { label: 'Missed leads', value: '8', trend: '+3', comparison: 'vs 5 (16 Sep)', tone: 'danger', icon: 'alert' },
    { label: 'Overdue follow-ups', value: '14', trend: '+6', comparison: 'vs 8 (16 Sep)', tone: 'warning', icon: 'clock' },
    { label: 'Hot leads pending', value: '6', trend: '+2', comparison: 'vs 4 (16 Sep)', tone: 'danger', icon: 'flame' },
    { label: 'Qualified 7+ days', value: '11', trend: '+4', comparison: 'vs 7 (16 Sep)', tone: 'warning', icon: 'clock' },
    { label: 'Drawings delayed', value: '8', trend: '+3', comparison: 'vs 5 (16 Sep)', tone: 'warning', icon: 'file' }
  ],
  performance: [
    { psm: 'Vaishnavi', leads: 28, contacted: 24, qualified: 12, enabled: 8, bookings: 4, value: '₹13.4L', missed: 2, hot: 1, status: 'On track', tone: 'success' },
    { psm: 'Anushka', leads: 26, contacted: 22, qualified: 11, enabled: 7, bookings: 3, value: '₹11.2L', missed: 1, hot: 2, status: 'On track', tone: 'success' },
    { psm: 'Sakshi', leads: 24, contacted: 20, qualified: 9, enabled: 6, bookings: 2, value: '₹8.1L', missed: 3, hot: 2, status: 'Watch', tone: 'warning' },
    { psm: 'Himanshu', leads: 18, contacted: 15, qualified: 8, enabled: 5, bookings: 2, value: '₹6.7L', missed: 1, hot: 1, status: 'On track', tone: 'success' },
    { psm: 'Rahul', leads: 30, contacted: 23, qualified: 8, enabled: 5, bookings: 1, value: '₹3.4L', missed: 1, hot: 0, status: 'At risk', tone: 'danger' }
  ],
  decisions: [
    { lead: 'Sharma Builders', id: 'L-98234 · Delhi', psm: 'Rahul', priority: 'High', ageing: '8 days', risk: 'Qualified, no drawing progress', action: 'Expedite drawing & confirm site visit' },
    { lead: 'Apex Realty', id: 'L-77621 · Mumbai', psm: 'Sakshi', priority: 'High', ageing: '6 days', risk: 'Hot lead pending for follow-up', action: 'PSM to contact today' },
    { lead: 'Mehta Constructions', id: 'L-55433 · Bengaluru', psm: 'Anushka', priority: 'Medium', ageing: '9 days', risk: 'Drawing delayed due to client inputs', action: 'Get client sign-off on drawings' },
    { lead: 'Krishna Infra', id: 'L-90112 · Pune', psm: 'Vaishnavi', priority: 'Medium', ageing: '7 days', risk: 'Qualified, no commercials shared', action: 'Share pricing & close next steps' }
  ],
  funnel: [
    { label: 'Total Leads', value: 126, conversion: '100%', icon: 'users' },
    { label: 'Contacted', value: 104, conversion: '82.5%', icon: 'phone' },
    { label: 'Qualified', value: 48, conversion: '46.2%', icon: 'target' },
    { label: 'Enabled', value: 31, conversion: '64.6%', icon: 'file' },
    { label: 'Drawing Complete', value: 22, conversion: '71.0%', icon: 'drawing' },
    { label: 'Booked', value: 12, conversion: '54.5%', icon: 'calendar' }
  ]
};
