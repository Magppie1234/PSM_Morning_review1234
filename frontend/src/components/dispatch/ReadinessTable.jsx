import { useState } from 'react';

const PAGE = 25;
const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function Light({ gate }) {
  return (
    <span className={`dp-light ${gate.state}`} title={gate.basis}>
      <i aria-hidden="true" />
      {gate.label}
    </span>
  );
}

function When({ order }) {
  if (!order.planned) return <span className="ps-na">No date</span>;
  const days = order.daysToGo;
  const note = days < 0 ? `${-days} days late` : days === 0 ? 'Today' : `in ${days} days`;
  return (
    <span className="dp-when">
      <strong>{shortDate(order.planned)}</strong>
      <span className={days < 0 ? 'ps-danger-text' : ''}>{note}</span>
    </span>
  );
}

export function ReadinessTable({ orders, emptyText }) {
  const [shown, setShown] = useState(PAGE);
  const visible = orders.slice(0, shown);

  return (
    <>
      <div className="ps-scroll">
        <table className="ps-table dp-table">
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Stage</th>
              <th scope="col">Planned dispatch</th>
              <th scope="col">Site ready</th>
              <th scope="col">Payment</th>
              <th scope="col">Production</th>
              <th scope="col">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr className="dp-static"><td colSpan={7} className="ps-empty dp-empty">{emptyText}</td></tr>
            )}
            {visible.map((order) => (
              <tr key={order.id} className="dp-static">
                <th scope="row">
                  <span className="dp-order">
                    <strong>{order.name}</strong>
                    {order.client !== '—' && <span>{order.client}</span>}
                  </span>
                </th>
                <td>
                  <span className="dp-stage">
                    <span className="dp-phase">{order.phase === 1 ? '1st' : '2nd'}</span>
                    {order.stage}
                  </span>
                </td>
                <td><When order={order} /></td>
                <td><Light gate={order.gates.site} /></td>
                <td><Light gate={order.gates.finance} /></td>
                <td><Light gate={order.gates.production} /></td>
                <td><span className={`ps-status ${order.verdict.tone}`}><i aria-hidden="true" />{order.verdict.text}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {orders.length > shown && (
        <button type="button" className="dp-more" onClick={() => setShown((count) => count + PAGE)}>
          Show {Math.min(PAGE, orders.length - shown)} more of {orders.length - shown}
        </button>
      )}
    </>
  );
}
