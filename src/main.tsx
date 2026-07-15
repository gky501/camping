import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import './diary-additions.css';
import './amenities.css';
import './parks.css';
import './trip-ui.css';
import './campers.css';
import './data-tools.css';
import './checklists.css';
import './equipment.css';
import './stats.css';
import './map-tools.css';
import './mobile-refresh.css';
import './navigation-refresh.css';
import App from './App';
import { DataMigrationLauncher } from './components/DataMigrationLauncher';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <DataMigrationLauncher />
  </StrictMode>,
);
