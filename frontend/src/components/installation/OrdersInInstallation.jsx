import { Hammer } from 'lucide-react';
import { useState } from 'react';
import { show, showDate } from './shared.jsx';

const PAGE = 25;

export function OrdersInInstallation({ orders }) {
  const [stage, setStage] = useState(null);
  const [shown, setShown] = useState(PAGE);
  const rows = stage ? orders.rows.filter((order) => order.stage === stage) : orders.rows;

  return (
    <section className="ps-panel" aria-labelledby="in-orders-title">
      <header className="ps-panel-head">
        <div>
          <h2 id="in-orders-title"><Hammer size={15} aria-hidden="true" /> Orders in installation right now</h2>
          <p>{orders.rows.length} orders between dispatch and final handover · {orders.startedInPeriod} started installation in this period</p>
        </div>
      </header>

      <div className="in-stages" role="group" aria-label="Filter by stage">
        <button type="button" aria-pressed={!stage} onClick={() => { setStage(null); setShown(PAGE); }}>All · {orders.rows.length}</button>
        {orders.byStage.map((item) => (
          <button
            type="button"
            key={item.name}
            aria-pressed={stage === item.name}
            disabled={!item.count}
            onClick={() => { setStage(item.name); setShown(PAGE); }}
          >
            {item.name} · {item.count}
          </button>
        ))}
      </div>

      <div className="ps-scroll">
        <table className="ps-table in-table">
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Stage</th>
              <th scope="col">Installation manager</th>
              <th scope="col">Installation started</th>
              <th scope="col">1st installation ended</th>
              <th scope="col">2nd installation ended</th>
              <th scope="col">Handover</th>
              <th scope="col">House warming (est.)</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map((order) => (
              <tr key={order.id} className="in-static">
                <th scope="row" className="in-wrap">
                  <span className="dp-order">
                    <strong>{order.name}</strong>
                    {order.client && <span>{order.client}</span>}
                  </span>
                </th>
                <td className="in-wrap">
                  {order.stage}
                  {order.awaitingInstallation && <span className="in-flag">Not installed</span>}
                </td>
                <td>{show(order.manager)}</td>
                <td>{showDate(order.startedOn)}</td>
                <td>{showDate(order.firstEndedOn)}</td>
                <td>{showDate(order.secondEndedOn)}</td>
                <td>{showDate(order.handoverOn)}</td>
                <td>{showDate(order.houseWarming)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown && (
        <button type="button" className="dp-more" onClick={() => setShown((count) => count + PAGE)}>
          Show {Math.min(PAGE, rows.length - shown)} more of {rows.length - shown}
        </button>
      )}
    </section>
  );
}
