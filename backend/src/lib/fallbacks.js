// Demo-data fallbacks used when Zoho can't be reached: narrow the bundled sample data to one PSM /
// sales rep so the filters still behave. Live data never passes through here.
export function applyPsmFilterFallback(data, psm) {
  if (!psm || psm === 'All PSM') return data;
  const performance = (data.performance ?? []).filter((row) => row.psm === psm);
  const decisions = (data.decisions ?? []).filter((row) => row.psm === psm);
  const leads = (data.leads ?? []).filter((row) => row.psm === psm);
  const row = performance[0];
  if (row) {
    const kpis = [
      { label: 'Leads received', value: String(row.leads), tone: 'blue', icon: 'users' },
      { label: 'Leads by Architect', value: String(row.architectLeads ?? 0), subtext: row.leads ? `${(((row.architectLeads ?? 0) / row.leads) * 100).toFixed(1)}% of received` : '0%', tone: 'blue', icon: 'ruler' },
      { label: 'Contacted', value: String(row.contacted), subtext: row.leads ? `${((row.contacted / row.leads) * 100).toFixed(1)}% of leads` : '—', tone: 'blue', icon: 'phone' },
      { label: 'Qualified', value: String(row.qualified), subtext: row.contacted ? `${((row.qualified / row.contacted) * 100).toFixed(1)}% of contacted` : '—', tone: 'blue', icon: 'target' },
      { label: 'Enabled', value: String(row.enabled), subtext: row.qualified ? `${((row.enabled / row.qualified) * 100).toFixed(1)}% of qualified` : '—', tone: 'blue', icon: 'file' },
      { label: 'Bookings', value: String(row.bookings), tone: 'blue', icon: 'calendar' },
      { label: 'Business value', value: row.value, tone: 'blue', icon: 'rupee' }
    ];
    const risks = [
      { label: 'Missed leads', value: String(row.missed), tone: 'danger', icon: 'alert' },
      { label: 'Overdue follow-ups', value: '0', tone: 'warning', icon: 'clock' },
      { label: 'Hot leads pending', value: String(row.hot ?? 0), tone: 'danger', icon: 'flame' },
      { label: 'Qualified 7+ days', value: '0', tone: 'warning', icon: 'clock' },
      { label: 'Drawings delayed', value: '0', tone: 'warning', icon: 'file' }
    ];
    const funnel = [
      { label: 'Total Leads', value: row.leads, conversion: '100%', icon: 'users' },
      { label: 'Contacted', value: row.contacted, conversion: row.leads ? `${((row.contacted / row.leads) * 100).toFixed(1)}%` : '—', icon: 'phone' },
      { label: 'Qualified', value: row.qualified, conversion: row.contacted ? `${((row.qualified / row.contacted) * 100).toFixed(1)}%` : '—', icon: 'target' },
      { label: 'Enabled', value: row.enabled, conversion: row.qualified ? `${((row.enabled / row.qualified) * 100).toFixed(1)}%` : '—', icon: 'file' },
      { label: 'Drawing Complete', value: row.enabled, conversion: '100%', icon: 'drawing' },
      { label: 'Booked', value: row.bookings, conversion: row.enabled ? `${((row.bookings / row.enabled) * 100).toFixed(1)}%` : '—', icon: 'calendar' }
    ];
    return { ...data, kpis, risks, funnel, performance, decisions, leads };
  }
  return { ...data, performance, decisions, leads };
}

export function applyOwnerFilterFallback(data, owner) {
  if (!owner || owner === 'All Sales Reps') return data;
  const performance = (data.performance ?? []).filter((row) => row.owner === owner);
  const decisions = (data.decisions ?? []).filter((row) => row.psm === owner);
  const deals = (data.deals ?? []).filter((row) => row.owner === owner);
  const row = performance[0];
  if (row) {
    const kpis = [
      { label: 'Active Opportunities', value: String(row.deals), tone: 'blue', icon: 'briefcase' },
      { label: 'Deals by Architect', value: String(row.architectDeals ?? 0), subtext: row.deals ? `${(((row.architectDeals ?? 0) / row.deals) * 100).toFixed(1)}% of pipeline` : '0%', tone: 'blue', icon: 'ruler' },
      { label: 'In Design / Layout', value: String(row.design), subtext: row.deals ? `${((row.design / row.deals) * 100).toFixed(1)}% of active` : '—', tone: 'blue', icon: 'drawing' },
      { label: 'Sent for Approval', value: String(row.approval), subtext: 'Awaiting SM review', tone: 'blue', icon: 'file' },
      { label: 'Price Discussion', value: String(row.price), subtext: 'Negotiation stage', tone: 'blue', icon: 'target' },
      { label: 'Active Pipeline Value', value: row.value, tone: 'blue', icon: 'rupee' }
    ];
    const risks = [
      { label: 'Overdue Follow-ups', value: String(row.overdue), tone: 'danger', icon: 'alert' },
      { label: 'Approval Stuck 5+ Days', value: String(row.approval > 0 ? 1 : 0), tone: 'danger', icon: 'clock' },
      { label: 'Design Delayed 7+ Days', value: String(row.design > 0 ? 1 : 0), tone: 'warning', icon: 'file' },
      { label: 'High Value at Risk (₹20L+)', value: '0', tone: 'danger', icon: 'flame' },
      { label: 'Stale Deals (No Touch)', value: '0', tone: 'warning', icon: 'clock' }
    ];
    const funnel = [
      { label: 'Total Opportunities', value: row.deals, conversion: '100%', icon: 'briefcase' },
      { label: 'Designer Assigned', value: row.design, conversion: row.deals ? `${((row.design / row.deals) * 100).toFixed(1)}%` : '—', icon: 'drawing' },
      { label: 'Sent for Approval', value: row.approval, conversion: row.deals ? `${((row.approval / row.deals) * 100).toFixed(1)}%` : '—', icon: 'file' },
      { label: 'Price Discussion', value: row.price, conversion: row.deals ? `${((row.price / row.deals) * 100).toFixed(1)}%` : '—', icon: 'target' },
      { label: 'Closed / Won', value: row.won, conversion: row.deals ? `${((row.won / row.deals) * 100).toFixed(1)}%` : '—', icon: 'calendar' }
    ];
    return { ...data, kpis, risks, funnel, performance, decisions, deals };
  }
  return { ...data, performance, decisions, deals };
}
