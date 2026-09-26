import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { count, formatMetric, inr, metricUnit, money, ranked, unavailable } from './format.js';
import { MiniBars } from './MetricCard.jsx';
import { TrendChart } from './TrendChart.jsx';

function BreakdownTable({ headers, rows }) {
  return <div className="em-detail-table"><table><thead><tr>{headers.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map(([id, name, ...cells]) => <tr key={id}><th scope="row">{name}</th>{cells.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}</tbody></table>{!rows.length && <p>No records for this period.</p>}</div>;
}

function MetricDetails({ metric, meta }) {
  if (!metric) return <p>This metric is no longer available. Close this detail and select another card.</p>;
  const unit = metricUnit(metric);
  const rows = [{ key: 'now', name: 'Selected period', value: unavailable(metric) ? null : metric.value }, { key: 'previous', name: meta.comparison?.label ?? 'Previous period', value: meta.comparison?.available === false ? null : metric.previous }];
  return <>
    <p className="em-detail-number">{unavailable(metric) ? 'Not recorded' : metric.valueLabel ?? formatMetric(metric)} <small>{unavailable(metric) ? '' : unit}</small></p>
    <p>{metric.reason ?? metric.sample?.label ?? 'No sample description supplied.'}</p>
    <MiniBars rows={rows.filter((r) => Number.isFinite(r.value))} format={(v) => `${formatMetric(metric, v)} ${unit}`} label={`${metric.label} comparison`} />
    <BreakdownTable headers={['Period', 'Value', 'Records']} rows={rows.map((r) => [r.key, r.name, Number.isFinite(r.value) ? `${formatMetric(metric, r.value)} ${unit}` : 'Not available', r.key === 'now' ? count(metric.total ?? metric.sample?.count) : count(metric.previousTotal)])} />
    {metric.unit === 'per-working-day' && <p className="em-detail-note">Rate = period total ÷ {count(meta.workingDays)} working days. The current rule uses Monday–Saturday. Intake, qualification and closures can contain different contacts; these rates are not a conversion funnel.</p>}
    {metric.unit === 'days' && <p className="em-detail-note">Uses Contact creation date to actual closure date. Records with negative intervals or missing dates are excluded. This measures the CRM record interval, not necessarily the full customer journey.</p>}
    {metric.key === 'averageOrderValue' && <p className="em-detail-note">Calculated from closed Contacts with recorded value. A Contact can have multiple orders, so this should be read as average closed-contact value until the business definition is confirmed.</p>}
    {metric.key === 'averageRevisions' && <p className="em-detail-note">Uses recorded revision counts on orders created in the selected period. The sample above identifies field coverage.</p>}
  </>;
}

function CategoryDetails({ type, data, view }) {
  const products = type === 'products';
  const rows = products ? data.products?.rows ?? [] : data.regions?.byCity ?? [];
  const chart = ranked(rows, products ? 'label' : 'city', 8);
  return <>
    <p className="em-detail-note">{products ? 'Recorded value of orders created in the selected period, across all stages. Sunroof orders are excluded by the current mapping.' : 'Recorded value of Contacts closed in the selected period. Intake counts use Contact creation dates.'}</p>
    {view === 'chart' ? <MiniBars rows={chart} format={inr} label={products ? 'Order value by product' : 'Closed-contact value by city'} /> : <BreakdownTable headers={products ? ['Product', 'Order value', 'Share', 'Orders'] : ['City', 'Closed value', 'Closed contacts', 'Intake']} rows={rows.map((r) => products ? [r.key ?? r.label, r.label, money(r), Number.isFinite(r.share) ? `${r.share}%` : '—', count(r.count)] : [r.key ?? r.city, r.city, money(r), count(r.closures), count(r.leads)])} />}
    {view === 'chart' && <p className="em-detail-note">{rows.length > 9 ? 'Smaller categories are combined. ' : ''}Open Table for every category, including zero values.</p>}
  </>;
}

function MonthlyDetails({ data, view }) {
  const [measure, setMeasure] = useState('leads');
  const months = data.series?.months ?? [];
  const measures = { leads: 'Contact intake', qualified: 'Qualified contacts', closed: 'Closed contacts', closedValue: 'Closed value (₹)' };
  return <>
    <p className="em-detail-note">Calendar-month activity. Creation, qualification and closure measures can represent different populations. Unusual spikes may include imported history; a spike alone does not prove an import.</p>
    {view === 'chart' ? <><div className="em-measure-control"><label htmlFor="em-month-measure">Measure</label><select id="em-month-measure" value={measure} onChange={(e) => setMeasure(e.target.value)}>{Object.entries(measures).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><TrendChart rows={months.map((m) => ({ key: m.month, name: m.label ?? m.month, value: m[measure] }))} format={measure === 'closedValue' ? inr : count} label={measures[measure]} /></> : <BreakdownTable headers={['Month', 'Intake', 'Qualified', 'Closed', 'Closed value']} rows={months.map((m) => [m.month, m.label ?? m.month, count(m.leads), count(m.qualified), count(m.closed), m.closedValueLabel ?? inr(m.closedValue)])} />}
  </>;
}

export default function EfficiencyDetails({ selection, data, returnFocus, onClose }) {
  const dialog = useRef(null);
  const titleId = useId();
  const [view, setView] = useState('chart');
  const metric = data.metrics?.find((m) => m.key === selection.key);
  const title = selection.type === 'metric' ? metric?.label ?? 'Metric details' : { products: 'Orders created · product mix', regions: 'Closed value · by city', months: 'Twelve-month activity' }[selection.type];
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => { node.close(); if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }); };
  }, [returnFocus]);
  return <dialog ref={dialog} className="em-detail-dialog em" aria-labelledby={titleId} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <header className="em-detail-header"><div><h2 id={titleId}>{title}</h2><p>{data.meta?.reportLabel}</p></div><button type="button" onClick={onClose} aria-label="Close efficiency details" autoFocus><X size={20} /></button></header>
    <div className="em-detail-body">
      {selection.type !== 'metric' && <div className="em-detail-toggle" role="group" aria-label="Detail view"><button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')}>Chart</button><button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button></div>}
      {selection.type === 'metric' ? <MetricDetails metric={metric} meta={data.meta ?? {}} /> : selection.type === 'months' ? <MonthlyDetails data={data} view={view} /> : <CategoryDetails type={selection.type} data={data} view={view} />}
    </div>
  </dialog>;
}

