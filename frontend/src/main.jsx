import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';
import './styles/presales.css';
import './styles/presales-panels.css';
import './styles/factory.css';
import './styles/dispatch.css';
import './styles/installation.css';
import './styles/legacy-light.css';
import './styles/incentive.css';
import './styles/ams.css';
import './styles/leadflow.css';
import './styles/pre-design.css';
// The Pre Design / Post Design sub-tabs live in here. It used to arrive with PostDesignBoard,
// which no longer renders, so it is loaded globally rather than by whichever board happens to
// import it — without it those two buttons fall back to raw browser chrome.
import './styles/post-design.css';
import './styles/post-design-queue.css';
import './styles/pre-efficiency.css';
import './styles/dispatch-review.css';
import './styles/formula.css';
import './styles/period-filter.css';
import './styles/table-tools.css';
import './styles/sales-records.css';
import './styles/sales-weekly.css';
import './styles/sales-efficiency.css';
import './styles/analytics.css';
import './styles/india-map.css';
import './styles/sales-sections.css';
import './styles/sales-leadgen.css';
import './styles/sales-performance.css';
import './styles/mobile.css';

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
