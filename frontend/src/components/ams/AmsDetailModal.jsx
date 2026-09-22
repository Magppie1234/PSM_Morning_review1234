import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { show, showDate } from '../installation/shared.jsx';
import { SERIES, statusOf } from './AmsCharts.jsx';

const LABEL = Object.fromEntries(SERIES.map((series) => [series.key, series]));

// Lists the AMS services behind a clicked chart mark. Cards, not a table, so it never scrolls sideways.
export function AmsDetailModal({ detail, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows = [...detail.rows].sort((a, b) => (a.amsDate ?? '').localeCompare(b.amsDate ?? '') || (a.client ?? '').localeCompare(b.client ?? ''));

  return (
    <div className="amsm-backdrop" onClick={onClose}>
      <div className="amsm-card" role="dialog" aria-modal="true" aria-labelledby="amsm-title" onClick={(event) => event.stopPropagation()}>
        <header className="amsm-head">
          <div>
            <h2 id="amsm-title">{detail.title}</h2>
            <p>{rows.length} {rows.length === 1 ? 'service' : 'services'}{detail.subtitle ? ` · ${detail.subtitle}` : ''}</p>
          </div>
          <button type="button" className="amsm-close" onClick={onClose} ref={closeRef} aria-label="Close">
            <X size={17} />
          </button>
        </header>

        <ul className="amsm-list">
          {rows.length === 0 && <li className="amsm-empty">No services in this selection.</li>}
          {rows.map((row) => {
            const status = LABEL[statusOf(row)];
            return (
              <li key={row.id} className="amsm-item">
                <div className="amsm-item-top">
                  <strong>{show(row.client)}</strong>
                  <span className="amsm-status" style={{ '--tone': status.color }}>
                    <i aria-hidden="true" />{status.label}
                  </span>
                </div>
                <dl className="amsm-facts">
                  <div><dt>AMS date</dt><dd>{showDate(row.amsDate)}</dd></div>
                  <div><dt>City</dt><dd>{show(row.city)}</dd></div>
                  <div><dt>Reason not done</dt><dd>{show(row.remarks)}</dd></div>
                  <div><dt>Completed on</dt><dd>{showDate(row.completedOn)}</dd></div>
                  <div className="wide"><dt>Order</dt><dd>{show(row.order)}</dd></div>
                </dl>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
