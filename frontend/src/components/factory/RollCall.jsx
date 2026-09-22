import { CheckCircle2 } from 'lucide-react';

function SinceYesterday({ designer, hasHistory }) {
  if (!hasHistory) return <span className="ps-na">—</span>;
  if (!designer.newToday && !designer.closedYesterday) return <span className="ps-na">No change</span>;
  return (
    <span>
      {designer.newToday > 0 && <span className="fs-up">+{designer.newToday}</span>}
      {designer.newToday > 0 && designer.closedYesterday > 0 && ' / '}
      {designer.closedYesterday > 0 && <span className="fs-down">−{designer.closedYesterday}</span>}
    </span>
  );
}

function DueCell({ designer }) {
  if (designer.missed) return <span className="ps-status danger"><i aria-hidden="true" />{designer.missed} missed</span>;
  if (designer.dueToday) return <span className="ps-status warning"><i aria-hidden="true" />{designer.dueToday} today</span>;
  return <span className="ps-na">—</span>;
}

export function RollCall({ designers, focus, onFocus, hasHistory, frozen }) {
  return (
    <section className="ps-panel">
      <header className="ps-panel-head">
        <div>
          <h2>Roll call</h2>
          <p>{frozen ? 'Order fixed for this meeting' : 'Meeting order: missed promises, then critical, then open queries'}</p>
        </div>
      </header>
      <div className="ps-scroll">
        <table className="ps-table fs-roll">
          <thead>
            <tr>
              <th scope="col">Designer</th>
              <th scope="col" className="num">Open</th>
              <th scope="col" className="num">Critical</th>
              <th scope="col" className="num">Oldest</th>
              <th scope="col">Since yesterday</th>
              <th scope="col">Due</th>
              <th scope="col">Most common issue</th>
            </tr>
          </thead>
          <tbody>
            {designers.map((designer, index) => (
              <tr key={designer.name} className={designer.name === focus ? 'is-focus' : ''} onClick={() => onFocus(designer.name)}>
                <th scope="row">
                  <button
                    type="button"
                    className="ps-name fs-roll-name"
                    aria-current={designer.name === focus ? 'true' : undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      onFocus(designer.name);
                    }}
                  >
                    <span className="fs-order">{index + 1}</span>
                    {designer.name}
                    {designer.discussedToday && <CheckCircle2 size={14} className="fs-discussed" aria-label="Discussed today" />}
                  </button>
                </th>
                <td className="num">{designer.open}</td>
                <td className={`num${designer.critical ? ' ps-danger-text' : ''}`}>{designer.critical}</td>
                <td className="num">{designer.oldestDays === null ? '—' : `${designer.oldestDays} d`}</td>
                <td><SinceYesterday designer={designer} hasHistory={hasHistory} /></td>
                <td><DueCell designer={designer} /></td>
                <td className="fs-pattern">
                  {designer.pattern ? `${designer.pattern.label} · ${designer.pattern.count} of ${designer.open}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
