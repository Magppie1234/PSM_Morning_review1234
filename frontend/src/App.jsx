import { useState } from 'react';
import { AmsBoard } from './components/ams/AmsBoard.jsx';
import { DecisionQueueBoard } from './components/decision/DecisionQueueBoard.jsx';
import { DesignDashboard } from './components/DesignDashboard.jsx';
import { DispatchBoard } from './components/dispatch/DispatchBoard.jsx';
import { FactoryStandup } from './components/factory/FactoryStandup.jsx';
import { InstallationBoard } from './components/installation/InstallationBoard.jsx';
import { MetricDetailModal } from './components/MetricDetailModal.jsx';
import { PdiDashboard } from './components/PdiDashboard.jsx';
import { PreSalesBoard } from './components/presales/PreSalesBoard.jsx';
import { SalesBoard } from './components/sales/SalesBoard.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { useDashboard } from './hooks/useDashboard.js';
import { PeriodFilter } from './components/PeriodFilter.jsx';

function BoardHeader({ title, subtitle, timeframe, onTimeframe }) {
  return (
    <header className="ps-head">
      <div>
        <h1>{title}</h1>
        <p className="ps-sub">
          <span>{subtitle}</span>
          <span className="ps-source live"><i aria-hidden="true" />Live from Zoho CRM</span>
        </p>
      </div>
      <div className="ps-controls">
        <PeriodFilter value={timeframe} onChange={onTimeframe} />
      </div>
    </header>
  );
}

export default function App() {
  const [currentTab, setCurrentTab] = useState('pre-sales');
  // One reporting period shared by every tab: daily, monthly, quarterly or a custom range.
  const [timeframe, setTimeframe] = useState('daily');
  const [psm, setPsm] = useState('All PSM');
  // The decision queue reads every sales rep's deals; only that board uses this now.
  const salesOwner = 'All Sales Reps';
  const [selectedDetail, setSelectedDetail] = useState('');
  const [modalItem, setModalItem] = useState(null);
  const [modalProjects, setModalProjects] = useState([]);

  // Only the tabs on screen fetch. The Sales board reads its own endpoint, so the deal dashboard is now
  // needed only by the decision queue, which pairs it with the lead data.
  const isSales = currentTab === 'sales';
  const preSalesState = useDashboard({ timeframe, psm }, '/api/dashboard', !isSales);
  const salesState = useDashboard({ timeframe, owner: salesOwner }, '/api/sales-dashboard', currentTab === 'decision-queue');
  const data = preSalesState.data;

  const handleTabChange = (tabId) => {
    setCurrentTab(tabId);
    setSelectedDetail('');
    setModalItem(null);
    setModalProjects([]);
  };

  const handleCardClick = (item, projects = []) => {
    setModalItem(item);
    setModalProjects(projects || []);
  };

  const boards = {
    'pre-sales': () => (
      <PreSalesBoard
        state={preSalesState}
        timeframe={timeframe}
        onTimeframe={setTimeframe}
        psm={psm}
        onPsm={setPsm}
        selectedDetail={selectedDetail}
        onDetail={setSelectedDetail}
        onOpen={handleCardClick}
      />
    ),
    sales: () => <SalesBoard />,
    design: () => (
      <div className="ps lt">
        <BoardHeader title="Design Monitoring Review" subtitle="Pre-design concepts and post-design production drawings" timeframe={timeframe} onTimeframe={setTimeframe} />
        <DesignDashboard onSelectDetail={handleCardClick} timeframe={timeframe} />
      </div>
    ),
    pdi: () => (
      <div className="ps lt">
        <BoardHeader title="Site PDI and Measurement Review" subtitle="Laser measurement, appliance cutouts and site handover readiness" timeframe={timeframe} onTimeframe={setTimeframe} />
        <PdiDashboard onSelectDetail={handleCardClick} timeframe={timeframe} />
      </div>
    ),
    factory: () => <FactoryStandup timeframe={timeframe} onTimeframe={setTimeframe} />,
    dispatch: () => <DispatchBoard />,
    installation: () => <InstallationBoard timeframe={timeframe} onTimeframe={setTimeframe} />,
    ams: () => <AmsBoard timeframe={timeframe} onTimeframe={setTimeframe} />,
    'decision-queue': () => <DecisionQueueBoard preSales={preSalesState} sales={salesState} onOpen={handleCardClick} />
  };

  return (
    <div className="app-shell ps-theme">
      <Sidebar currentTab={currentTab} onTabChange={handleTabChange} />

      <main className="main-content">
        <div className="workspace">
          {(boards[currentTab] ?? boards['pre-sales'])()}

          {/* Deep-dive pop-up when any card, queue item or funnel stage is clicked */}
          {modalItem && (
            <MetricDetailModal
              item={modalItem}
              onClose={() => setModalItem(null)}
              leads={data?.leads ?? []}
              deals={data?.deals ?? []}
              projects={modalProjects}
              mode={currentTab}
            />
          )}
        </div>
      </main>
    </div>
  );
}
