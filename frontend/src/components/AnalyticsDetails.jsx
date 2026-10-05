import { useEffect, useRef, useState } from 'react';
import { SortTh, TableSearch, useTableTools } from './tableTools.jsx';
import { crmRecordUrl } from '../config/crm.js';
import { TatCell } from './presales/leadTiming.jsx';

const stamp = (value) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Not recorded';
export function AnalyticsDetails({ selection, onClose }) {
  const dialog = useRef(null);
  const [limit, setLimit] = useState(50);
  const tools = useTableTools(selection.rows ?? [], {
    fields: { name: (row) => row.name, owner: (row) => row.owner, created: (row) => Date.parse(row.created), status: (row) => row.status, detail: (row) => row.detail, tat: (row) => row.tat?.hours },
    search: (row) => [row.name, row.id, row.owner, row.status, row.detail].filter(Boolean).join(' ')
  });
  useEffect(() => setLimit(50), [tools.query]);
  const hasTat = (selection.rows ?? []).some((row) => row.tat);
  useEffect(() => {
    const trigger = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector('button')?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const nodes = [...dialog.current.querySelectorAll('button, input, a[href], select')].filter((node) => !node.disabled);
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); trigger?.focus(); };
  }, [onClose]);
  return <div className="lf-modal" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section ref={dialog} className="lf-detail tone-blue" role="dialog" aria-modal="true" aria-label={selection.label}>
      <header className="lf-detail-head"><div><h3>{selection.label}</h3><p>{selection.detail}</p></div>
        <button type="button" className="lf-detail-close" onClick={onClose} aria-label="Close details">×</button>
      </header>
      <div className="an-evidence-tools"><TableSearch tools={tools} label="Search records" /><span>{tools.shown} of {tools.total} records</span></div>
      <div className="ps-scroll"><table className="ps-table"><thead><tr>
        <SortTh tools={tools} field="name">Record</SortTh><SortTh tools={tools} field="owner">PSM / owner</SortTh>
        <SortTh tools={tools} field="created">Created / activity time (IST)</SortTh><SortTh tools={tools} field="status">Status</SortTh>
        <SortTh tools={tools} field="detail">Calculation evidence</SortTh>{hasTat && <SortTh tools={tools} field="tat">TAT<small className="tat-sub">contacted within 12 hours</small></SortTh>}
      </tr></thead><tbody>{tools.rows.slice(0, limit).map((row, index) => <tr key={`${row.module}-${row.id}-${index}`}>
        <td>{row.id ? <a href={crmRecordUrl(row.module || 'Leads', row.id)} target="_blank" rel="noopener noreferrer">{row.name}</a> : row.name}<small className="tat-sub">{row.module} · {row.id}</small></td>
        <td>{row.owner || 'Not recorded'}</td><td>{stamp(row.created)}</td><td>{row.status}</td><td>{row.detail || '—'}</td>
        {hasTat && <td>{row.tat ? <TatCell tat={row.tat} /> : '—'}</td>}
      </tr>)}</tbody></table>{tools.rows.length > limit && <button type="button" className="ps-link" onClick={() => setLimit((value) => value + 50)}>Show more records ({limit} of {tools.rows.length})</button>}{!tools.total && <p className="an-note">{selection.unavailable ? 'Source data is unavailable; this metric cannot be verified.' : 'No matching records in this selection.'}</p>}</div>
    </section>
  </div>;
}
