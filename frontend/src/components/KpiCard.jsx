import { Icon } from './Icon.jsx';

export function KpiCard({ item, risk = false, onSelect }) {
  return (
    <button
      className={`metric-card ${risk ? `risk-card ${item.tone}` : ''}`}
      type="button"
      onClick={() => onSelect(item)}
      aria-label={`View ${item.label} details`}
    >
      <span className="metric-icon">
        <Icon name={item.icon} size={20} />
      </span>
      <span className="metric-copy">
        <span className="metric-label">{item.label}</span>
        <strong>{item.value}</strong>
        {item.subtext && <span className="metric-subtext">{item.subtext}</span>}
      </span>
      {risk && <span className="metric-arrow">›</span>}
      {item.trend && (
        <span className={`metric-trend ${risk ? 'negative' : ''}`}>
          ↑ {item.trend} <small>{item.comparison}</small>
        </span>
      )}
    </button>
  );
}

