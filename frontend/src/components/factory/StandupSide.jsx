import { Copy, Lightbulb, Truck } from 'lucide-react';
import { useState } from 'react';

const shortDate = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso ?? '') ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : iso);

export function DispatchHolds({ holds = [] }) {
  return (
    <section className="ps-panel fs-side-panel">
      <header className="ps-panel-head">
        <div>
          <h2><Truck size={15} aria-hidden="true" /> Vehicles held · {holds.length}</h2>
          <p>Stopped at the factory gate after site approval</p>
        </div>
      </header>
      <ul className="fs-holds">
        {holds.map((hold) => (
          <li key={hold.id} title={hold.reason}>
            <div className="fs-hold-top">
              <strong>{hold.location}</strong>
              <span className={`ps-status ${hold.stillHeld ? 'danger' : 'success'}`}>
                <i aria-hidden="true" />
                {hold.stillHeld ? 'Still held' : `Left ${shortDate(hold.actualDate)}`}
              </span>
            </div>
            <span>{hold.client} · MRP {hold.mrp} · planned {shortDate(hold.plannedDate)}</span>
            <span className="fs-held-by">Held by: {hold.heldBy}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TeamPattern({ pattern }) {
  if (!pattern) return null;
  return (
    <section className="ps-panel fs-side-panel fs-tip">
      <h2><Lightbulb size={15} aria-hidden="true" /> Team pattern</h2>
      <p><strong>{pattern.label}: {pattern.count} open queries across {pattern.designers} designers.</strong> {pattern.tip}</p>
    </section>
  );
}

function buildSummary(data) {
  const lines = [
    `Designer stand-up · ${shortDate(data.meta.today)}`,
    `Open factory queries: ${data.summary.open} · Vehicles held: ${data.summary.vehiclesHeld}`,
    ''
  ];
  data.designers.forEach((designer) => {
    const due = data.queries
      .filter((query) => query.designer === designer.name && query.status !== 'done' && query.dueDate)
      .map((query) => `MPP ${query.mpp} by ${shortDate(query.dueDate)}`);
    lines.push(`${designer.name}: ${designer.open} open (${designer.critical} critical)${due.length ? ` · Due: ${due.join(', ')}` : ' · No due dates set'}`);
  });
  return lines.join('\n');
}

export function ShareSummary({ data }) {
  const [state, setState] = useState('idle');
  const text = buildSummary(data);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('manual');
    }
  };

  return (
    <section className="ps-panel fs-side-panel">
      <button type="button" className="fs-share" onClick={copy}>
        <Copy size={14} aria-hidden="true" />
        {state === 'copied' ? 'Summary copied' : 'Copy meeting summary'}
      </button>
      {state === 'manual' && (
        <textarea className="fs-summary-text" readOnly value={text} rows={8} aria-label="Meeting summary" onFocus={(event) => event.target.select()} />
      )}
    </section>
  );
}
