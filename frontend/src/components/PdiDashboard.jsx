import { useState } from 'react';
import { Ruler, CheckCircle2, Clock, AlertTriangle, Building, Flame, Compass, Calendar, ShieldAlert, Sparkles, Filter, Check } from 'lucide-react';
import { KpiCard } from './KpiCard.jsx';
import { Funnel } from './Funnel.jsx';
import { useDashboard } from '../hooks/useDashboard.js';

export function PdiDashboard({ onSelectDetail, timeframe = '7d' }) {
  const [measurementFilter, setMeasurementFilter] = useState('All Measurements');
  const [applianceFilter, setApplianceFilter] = useState('All Appliances');
  const [criticalityFilter, setCriticalityFilter] = useState('All Criticality');
  const [ownerFilter, setOwnerFilter] = useState('All Owners');
  const [selectedProject, setSelectedProject] = useState(null);

  const { data, loading, error } = useDashboard(
    {
      measurement: measurementFilter !== 'All Measurements' ? measurementFilter : '',
      appliance: applianceFilter !== 'All Appliances' ? applianceFilter : '',
      criticality: criticalityFilter !== 'All Criticality' ? criticalityFilter : '',
      owner: ownerFilter !== 'All Owners' ? ownerFilter : '',
      timeframe
    },
    '/api/pdi-dashboard'
  );

  const kpis = data?.kpis ?? [];
  const risks = data?.risks ?? [];
  const funnel = data?.funnel ?? [];
  const criticalCases = data?.criticalCases ?? [];
  const projects = data?.projects ?? [];
  const filters = data?.filters ?? {
    measurementFilters: ['All Measurements', 'Done', 'Pending'],
    applianceFilters: ['All Appliances', 'Confirmed', 'Specs Missing'],
    criticalityFilters: ['All Criticality', 'Critical Only', 'High & Critical'],
    owners: ['All Owners']
  };

  const handleCardClick = (item) => {
    if (onSelectDetail) {
      onSelectDetail(item, projects);
    }
  };

  return (
    <div className="pdi-dashboard-container">
      {/* Top Filter Bar */}
      <div className="design-subtabs-bar" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div className="subtabs-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px', fontWeight: 600, color: 'var(--navy-900, #10224c)' }}>
            <Ruler size={18} />
            <span>Site Measurement & PDI Review</span>
          </div>
        </div>

        <div className="design-filters" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <label className="filter">
            <span className="sr-only">Measurement Status</span>
            <select
              aria-label="Filter by measurement status"
              value={measurementFilter}
              onChange={(e) => setMeasurementFilter(e.target.value)}
            >
              {filters.measurementFilters.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>

          <label className="filter">
            <span className="sr-only">Appliance Specs</span>
            <select
              aria-label="Filter by appliance specs"
              value={applianceFilter}
              onChange={(e) => setApplianceFilter(e.target.value)}
            >
              {filters.applianceFilters.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>

          <label className="filter">
            <span className="sr-only">Criticality</span>
            <select
              aria-label="Filter by criticality"
              value={criticalityFilter}
              onChange={(e) => setCriticalityFilter(e.target.value)}
            >
              {filters.criticalityFilters.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="filter">
            <span className="sr-only">Owner</span>
            <select
              aria-label="Filter by site owner"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
            >
              {filters.owners.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading && <div className="screen-message">Loading live Zoho CRM Site PDI & Measurement data…</div>}

      {error && !data && (
        <div className="screen-message error">
          {error}
          <span>Ensure the Express API is running on port 4010.</span>
        </div>
      )}

      {/* Core KPIs */}
      <section className="metric-grid" aria-label="PDI Core metrics">
        {kpis.map((item) => (
          <KpiCard item={item} onSelect={handleCardClick} key={item.label} />
        ))}
      </section>

      {/* Risk Indicators */}
      <section className="risk-grid" aria-label="PDI Risk indicators">
        {risks.map((item) => (
          <KpiCard item={item} risk onSelect={handleCardClick} key={item.label} />
        ))}
      </section>

      {/* Critical Cases Spotlight Box */}
      {criticalCases.length > 0 && (
        <section className="panel lt-critical">
          <header className="panel-header">
            <div>
              <h2 className="lt-critical-title">
                <ShieldAlert size={18} />
                Critical Cases & Site Red Flags ({criticalCases.length})
              </h2>
              <p>Immediate senior management intervention required — delayed measurements, missing appliance specs & overdue site completions</p>
            </div>
          </header>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Client / Project</th>
                  <th>Value</th>
                  <th>Measurement Status</th>
                  <th>Appliance Specs</th>
                  <th>Site Completion Target</th>
                  <th>Critical Issue</th>
                  <th>Action Required</th>
                </tr>
              </thead>
              <tbody>
                {criticalCases.map((proj) => (
                  <tr
                    key={`crit-${proj.id}`}
                    onClick={() => handleCardClick({ label: `${proj.client} Critical PDI Case`, value: proj.valueFormatted, subtext: proj.criticalReason })}
                  >
                    <th scope="row">
                      <strong>{proj.client}</strong>
                      <span>{proj.owner} · {proj.floor}</span>
                    </th>
                    <td><strong>{proj.valueFormatted}</strong></td>
                    <td>
                      <span className={`status ${proj.isMeasurementDone ? 'success' : 'danger'}`}>
                        <i />
                        {proj.measurementStatus} {proj.isMeasurementDone ? `(${proj.totalSqft})` : `(Ageing ${proj.ageing}d)`}
                      </span>
                    </td>
                    <td>
                      <span className={`priority ${proj.applianceStatus === 'Specs Missing' ? 'high' : 'normal'}`}>
                        {proj.applianceStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`status ${proj.completionTone}`}>
                        <i />
                        {proj.siteCompletionDate}
                        {proj.completionStatus !== 'On Track' ? ` · ${proj.completionStatus}` : ''}
                      </span>
                    </td>
                    <td style={{ color: proj.criticality === 'Critical' ? '#d93025' : '#b06000', fontWeight: 600 }}>
                      {proj.criticalReason}
                    </td>
                    <td>
                      <span className="badge-action" style={{ background: '#fef3f2', color: '#b42318', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                        {proj.actionRequired}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Main Measurements & Appliance Inspection Table */}
      <section className="panel" style={{ marginTop: '16px' }}>
        <header className="panel-header">
          <div>
            <h2>Site Measurement & Appliance Inspection Queue</h2>
            <p>Tracking laser surveys, ceiling heights, appliance cutouts (Hob, Chimney, Oven, Microwave, Fridge) & site delivery readiness</p>
          </div>
        </header>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Project / Client</th>
                <th>Product & Space</th>
                <th>Measurement Status</th>
                <th>Ceiling Height & Area</th>
                <th>Appliance Specs Done</th>
                <th>Site Completion Date</th>
                <th>Site Surveyor</th>
                <th>Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {projects.length ? (
                projects.map((proj) => (
                  <tr
                    key={proj.id}
                    onClick={() => handleCardClick({ label: `${proj.client} PDI Details`, value: proj.totalSqft, subtext: proj.siteCompletionDate })}
                  >
                    <th scope="row">
                      <strong>{proj.client}</strong>
                      <span>{proj.id}</span>
                    </th>
                    <td>
                      <div>{proj.productType}</div>
                      <span style={{ fontSize: '0.75rem', color: '#667085' }}>{proj.kitchenType} · {proj.floor}</span>
                    </td>
                    <td>
                      <span className={`status ${proj.isMeasurementDone ? 'success' : 'danger'}`}>
                        <i />
                        {proj.isMeasurementDone ? 'Done' : `Pending (${proj.ageing}d)`}
                      </span>
                    </td>
                    <td>
                      <div><strong>{proj.totalSqft}</strong></div>
                      <span style={{ fontSize: '0.75rem', color: '#667085' }}>Height: {proj.ceilingHeight}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span className={`priority ${proj.applianceStatus === 'Specs Missing' ? 'high' : 'normal'}`} style={{ display: 'inline-block', width: 'fit-content' }}>
                          {proj.applianceStatus}
                        </span>
                        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '2px' }}>
                          {proj.appliancesList.slice(0, 4).map((app) => (
                            <span
                              key={app.name}
                              style={{
                                fontSize: '0.7rem',
                                padding: '1px 5px',
                                borderRadius: '3px',
                                background: app.measured ? '#ecfdf3' : '#fef3f2',
                                color: app.measured ? '#027a48' : '#b42318',
                                border: `1px solid ${app.measured ? '#abefc6' : '#fecdca'}`
                              }}
                            >
                              {app.name.split('/')[0].trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div><strong>{proj.siteCompletionDate}</strong></div>
                      <span className={`status ${proj.completionTone}`} style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                        <i />
                        {proj.completionStatus}
                      </span>
                    </td>
                    <td>
                      <div>{proj.siteSurveyor}</div>
                      <span style={{ fontSize: '0.75rem', color: '#667085' }}>{proj.owner}</span>
                    </td>
                    <td>
                      <span className={`priority ${proj.criticality.toLowerCase()}`}>
                        {proj.criticality}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="empty-leads">
                    No site projects match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Conversion Funnel */}
      <Funnel
        stages={funnel}
        onSelect={handleCardClick}
        title="Site PDI & Execution Conversion Funnel"
        reportLabel="Total Sites → Measurements Done → Appliance Specs Confirmed → Ready for Delivery"
      />
    </div>
  );
}
