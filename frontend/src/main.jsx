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
import './styles/formula.css';
import './styles/period-filter.css';

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
