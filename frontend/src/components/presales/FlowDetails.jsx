import { PieChart, Table2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { LeadPies, focusLabel, matchesFocus } from './LeadPies.jsx';
import { AttemptsCell, CreatedCell, LastContactCell, ModifiedCell, TimeInStatus, statusAge } from './leadTiming.jsx';
import { ReassignedCell, useReassignments } from './leadReassign.jsx';
import { Formula, useShowFormula } from '../formula/FormulaPanel.jsx';
import { columnFormulas } from '../formula/formulas.js';
import { crmRecordUrl } from '../../config/crm.js';
import { SortSelect, SortTh, TableSearch, amountOf, timeOf, useTableTools } from '../tableTools.jsx';

// Records behind the funnel card that was clicked, in a popup. The table never scrolls sideways: columns
// share a fixed layout and wrap, and on narrow screens each row becomes a stacked card.
const PAGE = 20;
const NA = <span className="lf-na">NA</span>;
const show = (value) => (value === null || value === undefined || value === '' || value === '—' ? NA : value);

// Each name opens its record in Zoho CRM: leads in Raw Leads, opportunities in Qualified Leads.
function RecordLink({ row }) {
  const tab = row.kind === 'opportunity' ? 'Contacts' : 'Leads';
  return (
    <a className="lf-record-link" href={crmRecordUrl(tab, row.id)} target="_blank" rel="noopener noreferrer" title="Open this record in Zoho CRM">
      {row.name}
    </a>
  );
}

const ALL = '';
const NO_SOURCE = 'Source not recorded';
const sourceOf = (lead) => lead.source || NO_SOURCE;

// Every funnel card uses the same columns: who has the lead, how long it has sat in its status, when it was
// last called, when it came in, when it last changed, and whether it was reassigned. Source is a filter.
// Dropped / dead is an end state, so its time in status is never flagged red.
// A column is [heading, cell, hint, value to sort by]; a column with no fourth entry cannot be sorted.
const NO_FLAG = new Set(['dropped']);
const columnsFor = (cardId) => [
  ['Lead', (lead) => <RecordLink row={lead} />, undefined, (lead) => lead.name],
  ['PSM', (lead) => show(lead.psm), 'Zoho lead owner (the PSM field)', (lead) => lead.psm],
  ['Time in status', (lead) => <TimeInStatus lead={lead} flagLate={!NO_FLAG.has(cardId)} />, 'How long the lead has been in its current Zoho status; red after 24 hours', (lead) => statusAge(lead)],
  ['Last contacted', (lead) => <LastContactCell lead={lead} />, 'Latest call logged in Zoho (made, received or missed); scheduled calls are not counted', (lead) => timeOf(lead.lastContact?.at)],
  ['Attempts', (lead) => <AttemptsCell lead={lead} />, 'Outgoing calls placed on the lead, out of the 15 allowed', (lead) => lead.lastContact?.attempts ?? 0],
  ['Created', (lead) => <CreatedCell lead={lead} />, 'When the lead was created in Zoho (IST)', (lead) => timeOf(lead.createdAt)],
  ['Modified', (lead) => <ModifiedCell lead={lead} />, 'Last change to the lead in Zoho, its current status and who made it', (lead) => timeOf(lead.modifiedAt)],
  // Reassignments arrive one lead at a time from the Zoho timeline, so that column is not sortable.
  ['Reassigned to (by)', (lead, extra) => <ReassignedCell entry={extra.reassign.data?.[lead.id]} loading={extra.reassign.loading} />, 'Latest owner change from the Zoho timeline, and who made it']
];

// Dropped / dead only needs who, how long ago, and why: the reason comes from Zoho's
// "Reason for Cold" (or "Dead Reason" when that is empty), with the drop status beneath.
const droppedColumns = [
  ['Lead', (lead) => <RecordLink row={lead} />, undefined, (lead) => lead.name],
  ['PSM', (lead) => show(lead.psm), 'Zoho lead owner (the PSM field)', (lead) => lead.psm],
  ['Time in status', (lead) => <TimeInStatus lead={lead} flagLate={false} />, 'How long the lead has been dropped', (lead) => statusAge(lead)],
  ['Reason for dropping', (lead) => (
    <span className="lt-stack">
      <span>{lead.reason ?? <span className="lf-na">No reason recorded in Zoho</span>}</span>
      <small>{lead.status}</small>
    </span>
  ), 'Reason for Cold in Zoho (or Dead Reason when that is empty)', (lead) => lead.reason]
];

// Sales qualified and Closed list opportunities (Zoho Contacts): validation stage and value replace the
// lead-only columns (time in status, reassignment).
const OPPORTUNITY_CARDS = new Set(['toSm', 'closed']);
const opportunityColumns = (cardId) => [
  ['Client', (row) => <RecordLink row={row} />, undefined, (row) => row.name],
  ['PSM', (row) => show(row.psm), 'Sales Manager field on the opportunity (the PSM who qualified it)', (row) => row.psm],
  ['Validation', (row) => row.status, 'Client Status in Zoho: blank or Not Yet Validated means the SM has not validated it', (row) => row.status],
  ['Value', (row) => show(row.value), 'Total Opportunity Value in Zoho', (row) => amountOf(row.value)],
  cardId === 'closed'
    ? ['Closed on', (row) => show(row.closedOn), 'Actual Closure Date in Zoho', (row) => timeOf(row.closedOn)]
    : ['Last contacted', (row) => <LastContactCell lead={row} />, 'Latest call logged in Zoho', (row) => timeOf(row.lastContact?.at)],
  ['Created', (row) => <CreatedCell lead={row} />, 'When the opportunity was created in Zoho (IST)', (row) => timeOf(row.createdAt)],
  ['Modified', (row) => <ModifiedCell lead={row} />, 'Last change to the opportunity in Zoho and who made it', (row) => timeOf(row.modifiedAt)]
];

// Sortable columns, keyed by their heading, and the text a row is searched on.
const sortFieldsOf = (columns) =>
  Object.fromEntries(columns.filter((column) => column[3]).map((column) => [column[0], column[3]]));
const searchText = (row) =>
  [row.name, row.id, row.psm, row.status, row.source, row.reason, row.value, row.modifiedBy].filter(Boolean).join(' ');

export function FlowDetails({ card, node, leads, onClose, formula }) {
  const [shown, setShown] = useState(PAGE);
  const [source, setSource] = useState(ALL);
  // Every card opens on the chart; the table is one click away (and a clicked slice opens it filtered).
  const [view, setView] = useState('chart');
  const [focus, setFocus] = useState(null);
  const closeRef = useRef(null);
  const showFormula = useShowFormula();
  useEffect(() => {
    setShown(PAGE);
    setSource(ALL);
    setView('chart');
    setFocus(null);
  }, [card.id]);
  // Popup behaviour: Escape closes, the page behind doesn't scroll, focus starts on the close button.
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const ids = new Set(node.ids);
  const inCard = leads.filter((lead) => ids.has(String(lead.id)));
  // Source options with counts, built from this card's leads so every source can be picked.
  const sources = [...inCard.reduce((counts, lead) => counts.set(sourceOf(lead), (counts.get(sourceOf(lead)) ?? 0) + 1), new Map())]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const bySource = source === ALL ? inCard : inCard.filter((lead) => sourceOf(lead) === source);
  const isOpportunity = OPPORTUNITY_CARDS.has(card.id);
  const isDropped = card.id === 'dropped';
  const columns = isOpportunity ? opportunityColumns(card.id) : isDropped ? droppedColumns : columnsFor(card.id);
  // Search and sort work on the records already loaded; the chart shows whatever the search left.
  const tools = useTableTools(bySource, { fields: sortFieldsOf(columns), search: searchText });
  const sortOptions = columns.filter((column) => column[3]).map((column) => [column[0], column[0]]);
  // Longest wait first until a column is picked, so the most overdue leads lead the table.
  const ordered = tools.sort ? tools.rows : [...tools.rows].sort((a, b) => (statusAge(b) ?? 0) - (statusAge(a) ?? 0));
  const records = ordered.filter((lead) => matchesFocus(lead, focus));
  const searching = tools.query.trim().length > 0;
  const { setQuery } = tools;
  // A new card starts with an empty search, and a new search starts back at the first page of rows.
  useEffect(() => setQuery(''), [card.id, setQuery]);
  useEffect(() => setShown(PAGE), [tools.query]);
  // Timelines are read for the rows on screen only, since Zoho needs one request per lead.
  const reassign = useReassignments(view === 'table' ? records.slice(0, shown).map((lead) => String(lead.id)) : [], view === 'table' && !isOpportunity && !isDropped);
  const pickFocus = (next) => {
    setFocus(next);
    setShown(PAGE);
    if (next) setView('table');
  };

  return (
    <div className="lf-modal" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={`lf-detail tone-${card.tone}`} role="dialog" aria-modal="true" aria-label={`${card.label} records`}>
      <header className="lf-detail-head">
        <div>
          <h3><i aria-hidden="true" />{card.label} <span>{source === ALL && !focus && !searching ? node.count : `${records.length} of ${node.count}`}</span></h3>
          {card.hint && <p>{card.hint}</p>}
        </div>
        <div className="lf-detail-actions">
          <TableSearch tools={tools} label={`Search ${card.label} records`} placeholder="Search name, PSM, status…" className="lf-detail-search" />
          <SortSelect tools={tools} options={sortOptions} className="lf-detail-sort" />
          {sources.length > 0 && (
            <label className="ps-select lf-detail-filter">
              <select aria-label="Filter by lead source" value={source} onChange={(event) => { setSource(event.target.value); setShown(PAGE); }}>
                <option value={ALL}>All sources ({inCard.length})</option>
                {sources.map(([name, count]) => <option key={name} value={name}>{name} ({count})</option>)}
              </select>
            </label>
          )}
          <div className="fs-switch" role="group" aria-label="View">
            <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}><Table2 size={13} aria-hidden="true" /> Table</button>
            <button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')}><PieChart size={13} aria-hidden="true" /> Pie chart</button>
          </div>
          <button type="button" ref={closeRef} className="lf-detail-close" onClick={onClose} aria-label="Close details"><X size={16} aria-hidden="true" /></button>
        </div>
      </header>

      {showFormula && (
        <div className="fx-panel fx-in-popup">
          <Formula entry={formula} compact />
          <Formula entry={columnFormulas} compact />
        </div>
      )}

      {focus && (
        <p className="lp-focus">
          Showing {focusLabel(focus)} only
          <button type="button" className="ps-link" onClick={() => pickFocus(null)}>Show all</button>
        </p>
      )}

      {view === 'chart' ? (
        <LeadPies leads={tools.rows} focus={focus} onFocus={pickFocus} />
      ) : records.length === 0 ? (
        <p className="lf-detail-empty">
          {searching
            ? `No records match “${tools.query.trim()}”.`
            : source === ALL ? 'No leads in this group for the selected period.' : `No ${source} leads in this group.`}
        </p>
      ) : (
        <div className="lf-detail-body">
          <table className="ps-table lf-detail-table ams-stack-table">
            <colgroup>{columns.map(([label]) => <col key={label} className={`lf-col-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`} />)}</colgroup>
            <thead>
              <tr>
                {columns.map(([label, , title, sortValue]) => (sortValue
                  ? <SortTh tools={tools} field={label} key={label} title={title}>{label}</SortTh>
                  : <th scope="col" key={label} title={title}>{label}</th>))}
              </tr>
            </thead>
            <tbody>
              {records.slice(0, shown).map((lead) => (
                <tr key={lead.id} className="in-static">
                  {columns.map(([label, render]) => <td key={label} data-label={label}>{render(lead, { reassign })}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {view === 'table' && records.length > shown && (
        <button type="button" className="dp-more" onClick={() => setShown((count) => count + PAGE)}>
          Show {Math.min(PAGE, records.length - shown)} more of {records.length - shown}
        </button>
      )}
    </section>
    </div>
  );
}
