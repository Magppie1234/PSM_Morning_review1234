// When a lead came in (Zoho Created Time, IST). Shared by every lead table.
// Leads arriving outside office hours (9:30 am – 6:30 pm) are marked, since they wait overnight.

export function arrivalDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso ?? '')) return <span className="lf-na">NA</span>;
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
}

export function ArrivalTime({ lead }) {
  if (!lead.arrivedAt) return <span className="lf-na">NA</span>;
  return (
    <span className={lead.afterHours ? 'ps-after-hours' : undefined} title={lead.afterHours ? 'Arrived outside office hours (9:30 am – 6:30 pm)' : 'Arrived during office hours'}>
      {lead.arrivedAt}
      {lead.afterHours && <em>After hours</em>}
    </span>
  );
}
