import { Lock } from 'lucide-react';
import { Icon } from '../Icon.jsx';

export function PreSalesFunnel({ stages = [], periodName = '', onOpen, title = 'Conversion funnel', detailLabel = 'Conversion Funnel details' }) {
  const hasPending = stages.some((stage) => typeof stage.value !== 'number');
  let mappedIndex = 0;

  return (
    <section className="ps-panel ps-funnel">
      <header className="ps-panel-head">
        <div>
          <h2>{title}</h2>
          {periodName && <p>{periodName}</p>}
        </div>
        <button type="button" className="ps-link" onClick={() => onOpen(detailLabel)}>View funnel details</button>
      </header>

      <ol className="ps-chevrons">
        {stages.map((stage, index) => {
          const mapped = typeof stage.value === 'number';
          const shade = mapped ? mappedIndex++ : 0;
          return (
            <li key={stage.label} style={{ '--i': index, '--shade': shade }}>
              <button
                type="button"
                className={`ps-chevron${mapped ? '' : ' pending'}${mapped && shade >= 4 ? ' deep' : ''}`}
                title={mapped && index > 0 ? `${stage.conversion} ${stage.basis ?? 'of the previous stage'}` : undefined}
                onClick={() => onOpen(stage.label)}
              >
                <span className="ps-chevron-icon">
                  {mapped ? <Icon name={stage.icon} size={20} /> : <Lock size={17} aria-hidden="true" />}
                </span>
                <span className="ps-chevron-copy">
                  <span className="ps-chevron-label">{stage.label}</span>
                  <strong>{mapped ? stage.value.toLocaleString('en-IN') : '—'}</strong>
                  <span className="ps-chevron-rate">
                    {!mapped ? 'Not mapped yet' : stage.conversion}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {hasPending && (
        <p className="ps-pending ps-funnel-note">
          <Lock size={14} aria-hidden="true" />
          <span>Grey stages will fill in once their CRM fields are mapped.</span>
        </p>
      )}
    </section>
  );
}
