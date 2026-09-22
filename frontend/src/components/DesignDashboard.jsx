import { useState, useMemo } from 'react';
import { PencilRuler, Layers } from 'lucide-react';
import { KpiCard } from './KpiCard.jsx';
import { Funnel } from './Funnel.jsx';
import { useDashboard } from '../hooks/useDashboard.js';

export const MAGPPIE_DESIGNERS = [
  'All Designers',
  'Jyoti',
  'Rishabh Butar',
  'Rupa',
  'Mehul',
  'Vishal Dubey',
  'Atif Hussain',
  'Gunjan',
  'Sudha',
  'Mansi',
  'Nidhi',
  'Ankita',
  'Shruti',
  'Pravallika',
  'Rashi',
  'Deepanksha',
  'Soma',
  'Shaily'
];

const inrFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
const formatMoney = (val) => typeof val === 'number' ? `₹${inrFormat.format(val / 100000)}L` : String(val ?? '—');

export function DesignDashboard({ onSelectDetail, timeframe = '7d' }) {
  const [activeSubTab, setActiveSubTab] = useState('pre-design');
  const [designerFilter, setDesignerFilter] = useState('All Designers');

  const { data, loading, error } = useDashboard(
    { designer: designerFilter !== 'All Designers' ? designerFilter : '', timeframe },
    '/api/design-dashboard'
  );

  const designers = data?.meta?.designers?.length ? data.meta.designers : MAGPPIE_DESIGNERS;

  const preDesign = data?.preDesign ?? {
    kpis: [],
    risks: [],
    projects: [],
    funnel: []
  };

  const postDesign = data?.postDesign ?? {
    kpis: [],
    risks: [],
    projects: [],
    funnel: []
  };

  const currentProjects = activeSubTab === 'pre-design' ? preDesign.projects : postDesign.projects;

  const handleCardClick = (item) => {
    if (onSelectDetail) {
      onSelectDetail(item, currentProjects);
    }
  };

  return (
    <div className="design-dashboard-container">
      {/* Sub-Tabs: Pre-Design vs Post-Design */}
      <div className="design-subtabs-bar">
        <div className="subtabs-group">
          <button
            type="button"
            className={`subtab-btn ${activeSubTab === 'pre-design' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('pre-design')}
          >
            <PencilRuler size={16} />
            <span>Pre-Design Review</span>
            <span className="subtab-badge">{preDesign.projects?.length ?? 0}</span>
          </button>
          <button
            type="button"
            className={`subtab-btn ${activeSubTab === 'post-design' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('post-design')}
          >
            <Layers size={16} />
            <span>Post-Design & Production</span>
            <span className="subtab-badge">{postDesign.projects?.length ?? 0}</span>
          </button>
        </div>

        <div className="design-filters">
          <label className="filter">
            <span className="sr-only">Designer</span>
            <select
              aria-label="Filter by designer"
              value={designerFilter}
              onChange={(e) => setDesignerFilter(e.target.value)}
            >
              {designers.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading && <div className="screen-message">Loading live Zoho CRM design pipeline…</div>}

      {error && !data && (
        <div className="screen-message error">
          {error}
          <span>Ensure the Express API is running on port 4010.</span>
        </div>
      )}

      {/* Selected Designer Scope Notice */}
      {designerFilter !== 'All Designers' && (
        <div className="detail-notice" role="status" style={{ marginBottom: '14px' }}>
          <strong>Showing Live Design Projects for {designerFilter}</strong>
          <span>All metrics, cards, table rows, and conversion funnels are filtered to this designer.</span>
          <button
            type="button"
            onClick={() => setDesignerFilter('All Designers')}
            aria-label="Reset designer filter"
          >
            ×
          </button>
        </div>
      )}

      {activeSubTab === 'pre-design' && (
        <>
          <section className="metric-grid" aria-label="Pre-design metrics">
            {preDesign.kpis?.map((item) => (
              <KpiCard item={item} onSelect={handleCardClick} key={item.label} />
            ))}
          </section>

          <section className="risk-grid" aria-label="Pre-design risks">
            {preDesign.risks?.map((item) => (
              <KpiCard item={item} risk onSelect={handleCardClick} key={item.label} />
            ))}
          </section>

          <section className="panel" style={{ marginTop: '16px' }}>
            <header className="panel-header">
              <div>
                <h2>Pre-Design Stage Queue {designerFilter !== 'All Designers' ? `(${designerFilter})` : ''}</h2>
                <p>Initial briefs, site measurement visits, 2D floor plans & 3D client concepts</p>
              </div>
              {designerFilter !== 'All Designers' && (
                <button type="button" onClick={() => setDesignerFilter('All Designers')}>
                  View all designers
                </button>
              )}
            </header>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Project / Client</th>
                    <th>Space</th>
                    <th>Area (Sq Ft)</th>
                    <th>Lead Designer</th>
                    <th>Architect Partner</th>
                    <th>Stage</th>
                    <th>Ageing</th>
                    <th>Priority</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preDesign.projects?.length ? (
                    preDesign.projects.map((row) => (
                      <tr key={row.id} onClick={() => handleCardClick({ label: `${row.client} Details`, value: row.sqFt, subtext: row.space })}>
                        <th scope="row">
                          <strong>{row.client}</strong>
                          <span>{row.id}</span>
                        </th>
                        <td>{row.space}</td>
                        <td><strong>{row.sqFt}</strong></td>
                        <td>
                          <button
                            type="button"
                            className="psm-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDesignerFilter(row.designer);
                            }}
                          >
                            {row.designer}
                          </button>
                        </td>
                        <td>{row.architect}</td>
                        <td><span className="priority medium">{row.stage}</span></td>
                        <td>{row.ageing} days</td>
                        <td><span className={`priority ${(row.priority || 'Normal').toLowerCase()}`}>{row.priority}</span></td>
                        <td>
                          <span className={`status ${row.tone}`}>
                            <i />
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9" className="empty-leads">
                        No pre-design projects found for {designerFilter}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Pre-Design Funnel: Transferred -> Executed -> Closed */}
          <Funnel
            stages={preDesign.funnel ?? []}
            onSelect={handleCardClick}
            title={designerFilter !== 'All Designers' ? `${designerFilter}'s Pre-Design Funnel` : "Pre-Design Conversion Funnel"}
            reportLabel="Transferred → Executed → Closed"
          />
        </>
      )}

      {activeSubTab === 'post-design' && (
        <>
          {/* Post-Design KPI Cards: Designs Started, Sq Ft, Designs Completed, Under Revision, Orders Closed, Total Value */}
          <section className="metric-grid" aria-label="Post-design metrics">
            {postDesign.kpis?.map((item) => (
              <KpiCard item={item} onSelect={handleCardClick} key={item.label} />
            ))}
          </section>

          <section className="risk-grid" aria-label="Post-design risks">
            {postDesign.risks?.map((item) => (
              <KpiCard item={item} risk onSelect={handleCardClick} key={item.label} />
            ))}
          </section>

          <section className="panel" style={{ marginTop: '16px' }}>
            <header className="panel-header">
              <div>
                <h2>Post-Design Approvals & Production Pipeline {designerFilter !== 'All Designers' ? `(${designerFilter})` : ''}</h2>
                <p>Drawings sent for approval, revision tracking, BOM confirmation & factory handover</p>
              </div>
              {designerFilter !== 'All Designers' && (
                <button type="button" onClick={() => setDesignerFilter('All Designers')}>
                  View all designers
                </button>
              )}
            </header>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Project / Client</th>
                    <th>Space</th>
                    <th>Area (Sq Ft)</th>
                    <th>Designer</th>
                    <th>Approver / Authority</th>
                    <th>Stage</th>
                    <th>Payment Status</th>
                    <th>Revision Status</th>
                    <th>Target Factory Dispatch</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {postDesign.projects?.length ? (
                    postDesign.projects.map((row) => (
                      <tr key={row.id} onClick={() => handleCardClick({ label: `${row.client} Production Status`, value: formatMoney(row.value), subtext: row.stage })}>
                        <th scope="row">
                          <strong>{row.client}</strong>
                          <span>{row.id}</span>
                        </th>
                        <td>{row.space}</td>
                        <td><strong>{row.sqFt}</strong></td>
                        <td>
                          <button
                            type="button"
                            className="psm-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDesignerFilter(row.designer);
                            }}
                          >
                            {row.designer}
                          </button>
                        </td>
                        <td>{row.approver}</td>
                        <td><span className="priority high">{row.stage}</span></td>
                        <td><strong>{row.paymentStatus}</strong></td>
                        <td><span className={row.revisions?.includes('Revision') ? 'danger-text' : ''}>{row.revisions}</span></td>
                        <td>{row.targetDispatch}</td>
                        <td>
                          <span className={`status ${row.tone}`}>
                            <i />
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="10" className="empty-leads">
                        No post-design projects found for {designerFilter}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Post-Design Funnel: Dispatched -> Payments Done -> Payments Received -> Closed */}
          <Funnel
            stages={postDesign.funnel ?? []}
            onSelect={handleCardClick}
            title={designerFilter !== 'All Designers' ? `${designerFilter}'s Post-Design Funnel` : "Post-Design Conversion Funnel"}
            reportLabel="Dispatched → Payments Done → Payments Received → Closed"
          />
        </>
      )}
    </div>
  );
}
