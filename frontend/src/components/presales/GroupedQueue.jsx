import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

const PRIORITY = { High: 0, Medium: 1, Low: 2 };
const NO_CITY = 'City not recorded';

function splitId(id = '') {
  const [crmId, city] = id.split(' · ');
  return { crmId, city };
}

function groupRows(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    if (!groups.has(row.risk)) {
      groups.set(row.risk, { risk: row.risk, rows: [], actions: new Set(), psms: new Map(), priority: row.priority });
    }
    const group = groups.get(row.risk);
    group.rows.push(row);
    group.actions.add(row.action);
    group.psms.set(row.psm, (group.psms.get(row.psm) ?? 0) + 1);
    if ((PRIORITY[row.priority] ?? 9) < (PRIORITY[group.priority] ?? 9)) group.priority = row.priority;
  });
  return [...groups.values()].sort(
    (a, b) => (PRIORITY[a.priority] ?? 9) - (PRIORITY[b.priority] ?? 9) || b.rows.length - a.rows.length
  );
}

export function GroupedQueue({ rows = [], onOpen, title = 'Senior decision queue', viewAllLabel = 'Senior Decision Queue' }) {
  const groups = groupRows(rows);
  const idPrefix = useId();
  const [open, setOpen] = useState(() => new Set(groups.filter((group) => group.rows.length <= 3).map((group) => group.risk)));

  const toggle = (risk) => setOpen((current) => {
    const next = new Set(current);
    if (next.has(risk)) next.delete(risk);
    else next.add(risk);
    return next;
  });

  return (
    <section className="ps-panel ps-queue">
      <header className="ps-panel-head">
        <div>
          <h2>{title}</h2>
          <p>{rows.length} leads across {groups.length} {groups.length === 1 ? 'issue' : 'issues'}</p>
        </div>
        <button type="button" className="ps-link" onClick={() => onOpen(viewAllLabel)}>View all</button>
      </header>

      {groups.length === 0 ? (
        <p className="ps-empty ps-pad">No leads need a senior decision right now.</p>
      ) : (
        <ul className="ps-groups">
          {groups.map((group, index) => {
            const isOpen = open.has(group.risk);
            const sharedAction = group.actions.size === 1 ? [...group.actions][0] : null;
            const bodyId = `${idPrefix}-group-${index}`;
            const byPsm = [...group.psms].sort((a, b) => b[1] - a[1]).map(([name, total]) => `${name} ${total}`).join(' · ');

            return (
              <li className={`ps-group${isOpen ? ' open' : ''}`} key={group.risk}>
                <div className="ps-group-head">
                  <button type="button" className="ps-group-toggle" aria-expanded={isOpen} aria-controls={bodyId} onClick={() => toggle(group.risk)}>
                    <ChevronDown className="ps-chev" size={16} aria-hidden="true" />
                    <span className={`ps-group-count ${group.priority.toLowerCase()}`}>{group.rows.length}</span>
                    <span className="ps-group-text">
                      <strong>{group.risk}</strong>
                      <span>{byPsm}</span>
                    </span>
                    <span className={`ps-priority ${group.priority.toLowerCase()}`}>{group.priority}</span>
                  </button>
                  {sharedAction && (
                    <button type="button" className="ps-group-action" onClick={() => onOpen(`${group.risk}: ${sharedAction}`)}>
                      {sharedAction}
                    </button>
                  )}
                </div>

                <div className="ps-group-body" id={bodyId} inert={!isOpen}>
                  <ul className="ps-leads">
                    {group.rows.map((row) => {
                      const { crmId, city } = splitId(row.id);
                      return (
                        <li key={row.id}>
                          <button type="button" className="ps-lead" onClick={() => onOpen(`${row.lead}: ${row.action}`)} title={`CRM ID ${crmId}`}>
                            <span className="ps-lead-name">{row.lead}</span>
                            <span className={`ps-city${city === NO_CITY || !city ? ' none' : ''}`}>{city && city !== NO_CITY ? city : 'No city'}</span>
                            <span className="ps-lead-meta">{row.psm}</span>
                            <span className="ps-lead-meta num">{row.ageing}</span>
                            {!sharedAction && <span className="ps-lead-action">{row.action}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
