import { Info, Truck } from 'lucide-react';

const shortDate = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso ?? '') ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : iso);
const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function TransportCard({ transport }) {
  const planned = transport.days.reduce((sum, day) => sum + day.planned, 0);
  return (
    <section className="ps-panel dp-transport" aria-labelledby="dp-transport-title">
      <header className="ps-panel-head">
        <div>
          <h2 id="dp-transport-title"><Truck size={15} aria-hidden="true" /> Transport</h2>
          <p>{planned} dispatches planned in the next 7 days{transport.freightTotal ? ` · freight ₹${inr.format(transport.freightTotal)}` : ''}</p>
        </div>
      </header>

      <div className="dp-transport-body">
        <ol className="dp-days">
          {transport.days.map((day) => (
            <li key={day.date} className={day.planned ? 'has' : ''}>
              <span>{day.label}</span>
              <strong>{day.planned}</strong>
              <em>{day.planned ? `${day.ready} ready` : 'none'}</em>
            </li>
          ))}
        </ol>

        <div className="dp-holds">
          <h3>Vehicles held · {transport.holds.length}</h3>
          {transport.holds.length === 0 && <p className="ps-empty">No vehicles held at the factory gate.</p>}
          <ul>
            {transport.holds.map((hold) => (
              <li key={hold.id} title={hold.reason}>
                <strong>{hold.location}</strong>
                <span>{hold.client} · MRP {hold.mrpNo} · planned {shortDate(hold.plannedDate)}</span>
                <span className={/^\d{4}/.test(hold.actualDate) ? '' : 'ps-danger-text'}>
                  {/^\d{4}/.test(hold.actualDate) ? `Left ${shortDate(hold.actualDate)}` : 'Still held'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {!transport.vehiclesInZoho && (
        <p className="dp-gap">
          <Info size={14} aria-hidden="true" />
          Vehicle number and transporter aren't recorded in Zoho yet; held vehicles come from the dispatch sheet.
        </p>
      )}
    </section>
  );
}
