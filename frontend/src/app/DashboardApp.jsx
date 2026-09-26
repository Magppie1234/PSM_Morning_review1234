import { lazy, Suspense, useState } from 'react';
const AmsBoard = lazy(() => import('../components/ams/AmsBoard.jsx').then(module => ({ default: module.AmsBoard })));
const DecisionQueueBoard = lazy(() => import('../components/decision/DecisionQueueBoard.jsx').then(module => ({ default: module.DecisionQueueBoard })));
const PostDesignBoard = lazy(() => import('../components/design/PostDesignBoard.jsx').then(module => ({ default: module.PostDesignBoard })));
const DispatchBoard = lazy(() => import('../components/dispatch/DispatchBoard.jsx').then(module => ({ default: module.DispatchBoard })));
const FactoryStandup = lazy(() => import('../components/factory/FactoryStandup.jsx').then(module => ({ default: module.FactoryStandup })));
const InstallationBoard = lazy(() => import('../components/installation/InstallationBoard.jsx').then(module => ({ default: module.InstallationBoard })));
const MetricDetailModal = lazy(() => import('../components/MetricDetailModal.jsx').then(module => ({ default: module.MetricDetailModal })));
const PdiDashboard = lazy(() => import('../components/PdiDashboard.jsx').then(module => ({ default: module.PdiDashboard })));
const PreDesignFlow = lazy(() => import('../components/design/PreDesignFlow.jsx').then(module => ({ default: module.PreDesignFlow })));
const SalesRecordsPopup = lazy(() => import('../components/sales/SalesRecordsPopup.jsx').then(module => ({ default: module.SalesRecordsPopup })));
const PreSalesBoard = lazy(() => import('../components/presales/PreSalesBoard.jsx').then(module => ({ default: module.PreSalesBoard })));
const SalesBoard = lazy(() => import('../components/sales/SalesBoard.jsx').then(module => ({ default: module.SalesBoard })));
import { Sidebar } from '../components/Sidebar.jsx';
import { useDashboard } from '../hooks/useDashboard.js';
import { PeriodFilter } from '../components/PeriodFilter.jsx';

function BoardHeader({ title, subtitle, timeframe, onTimeframe }) {
  return (
    <header className="ps-head">
      <div>
        <h1>{title}</h1>
        <p className="ps-sub">
          <span>{subtitle}</span>
          <span className="ps-source">Zoho CRM · 30-minute refresh</span>
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
  // The pre-design funnel opens its records in the same popup the Sales board uses.
  const [designCard, setDesignCard] = useState(null);
  const [designSection, setDesignSection] = useState('pre');

  // Only the tabs on screen fetch. The Sales board reads its own endpoint, so the deal dashboard is now
  // needed only by the decision queue, which pairs it with the lead data.
  const needsPreSales = currentTab === 'pre-sales' || currentTab === 'decision-queue';
  const preSalesState = useDashboard({ timeframe, psm }, '/api/dashboard', needsPreSales);
  const salesState = useDashboard({ timeframe, owner: salesOwner }, '/api/sales-dashboard', currentTab === 'decision-queue');
  // The pre-design funnel reads the Deals module on its own terms, so it only fetches on that board.
  const preDesignState = useDashboard({ timeframe }, '/api/pre-design-funnel', currentTab === 'design' && designSection === 'pre');
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
      <div className="ps">
        <BoardHeader title="Design Monitoring Review" subtitle="Orders in design, from brief to handover" timeframe={timeframe} onTimeframe={setTimeframe} />
        <nav className="design-sections" aria-label="Design subcategories">
          <button aria-pressed={designSection === 'pre'} onClick={() => { setDesignSection('pre'); setDesignCard(null); }}>Pre Design</button>
          <button aria-pressed={designSection === 'post'} onClick={() => { setDesignSection('post'); setDesignCard(null); }}>Post Design</button>
        </nav>
        {designSection === 'post' ? <PostDesignBoard timeframe={timeframe} /> : <PreDesignFlow
          data={preDesignState.data?.preDesign}
          loading={preDesignState.loading}
          onOpen={(card) => setDesignCard(card)}
        />}
        {designCard && (
          <SalesRecordsPopup card={designCard} records={preDesignState.data?.records ?? []} onClose={() => setDesignCard(null)} />
        )}
      </div>
    ),
    pdi: () => (
      <div className="ps lt">
        <BoardHeader title="PDI & Site Review" subtitle="PDI verification, payment and dispatch readiness" timeframe={timeframe} onTimeframe={setTimeframe} />
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
          <Suspense fallback={<p className="screen-message" role="status">Opening dashboard…</p>}>{(boards[currentTab] ?? boards['pre-sales'])()}</Suspense>

          {/* Deep-dive pop-up when any card, queue item or funnel stage is clicked */}
          <Suspense fallback={<p role="status">Opening details…</p>}>{modalItem && (
            <MetricDetailModal
              item={modalItem}
              onClose={() => setModalItem(null)}
              leads={data?.leads ?? []}
              deals={data?.deals ?? []}
              projects={modalProjects}
              mode={currentTab}
            />
          )}</Suspense>
        </div>
      </main>
    </div>
  );
}

