import { CheckCircle2, ChevronRight } from 'lucide-react';
import { Icon } from '../Icon.jsx';

const count = (value) => Number(String(value).replace(/[^\d.]/g, '')) || 0;

export function ActionRow({ risks = [], onOpen }) {
  const open = risks.filter((item) => count(item.value) > 0);
  const clear = risks.filter((item) => count(item.value) === 0);

  return (
    <section className="ps-actions" aria-labelledby="ps-actions-title">
      <div className="ps-section-head">
        <h2 id="ps-actions-title">Needs action today</h2>
        {clear.length > 0 && (
          <div className="ps-clear">
            {clear.map((item) => (
              <button type="button" className="ps-clear-chip" onClick={() => onOpen(item)} key={item.label}>
                <CheckCircle2 size={14} aria-hidden="true" />
                {item.label}: none
              </button>
            ))}
          </div>
        )}
      </div>

      {open.length > 0 ? (
        <div className="ps-action-list">
          {open.map((item) => (
            <button type="button" className={`ps-action ${item.tone}`} onClick={() => onOpen(item)} key={item.label}>
              <span className="ps-action-icon"><Icon name={item.icon} size={17} /></span>
              <strong>{item.value}</strong>
              <span className="ps-action-label">{item.label}</span>
              <ChevronRight className="ps-action-go" size={17} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <p className="ps-empty">Nothing needs escalation for this period.</p>
      )}
    </section>
  );
}
