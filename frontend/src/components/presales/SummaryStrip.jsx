import { ArrowRight } from 'lucide-react';
import { Icon } from '../Icon.jsx';

const FLOW = /^(raw leads|leads received|contacted|qualified|enabled|bookings)/i;

function Metric({ item, onOpen }) {
  return (
    <button type="button" className="ps-metric" onClick={() => onOpen(item)}>
      <span className="ps-metric-label">
        <Icon name={item.icon} size={15} />
        {item.label}
      </span>
      <strong>{item.value}</strong>
      <span className="ps-metric-sub">{item.subtext ?? ' '}</span>
    </button>
  );
}

// `flow` picks the metrics shown as a left-to-right pipeline; the rest sit in the context group.
export function SummaryStrip({ kpis = [], onOpen, flow: flowPattern = FLOW }) {
  const flow = kpis.filter((item) => flowPattern.test(item.label));
  const context = kpis.filter((item) => !flowPattern.test(item.label));

  return (
    <section className="ps-summary" aria-label="Lead pipeline summary">
      <ol className="ps-flow">
        {flow.map((item, index) => (
          <li key={item.label}>
            {index > 0 && <ArrowRight className="ps-flow-arrow" size={16} aria-hidden="true" />}
            <Metric item={item} onOpen={onOpen} />
          </li>
        ))}
      </ol>
      {context.length > 0 && (
        <div className="ps-context">
          {context.map((item) => (
            <Metric item={item} onOpen={onOpen} key={item.label} />
          ))}
        </div>
      )}
    </section>
  );
}
