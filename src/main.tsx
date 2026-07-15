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
import './equipment-age.css';
import './checklist-dialogs.css';
import './equipment-dialogs.css';
import './stats.css';
import './map-tools.css';
import './map-markers.css';
import './trip-dashboard.css';
import './auth.css';
import './account-launcher.css';
import './admin-accounts.css';
import './passport.css';
import './navigation-v2.css';
import './mobile-refresh.css';
import './navigation-refresh.css';
import './header-utilities.css';
import './photo-coming-soon.css';
import './header-cleanup.css';
import App from './App';
import { AuthGate } from './components/AuthGate';
import { HeaderUtilities } from './components/HeaderUtilities';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <App />
      <HeaderUtilities />
    </AuthGate>
  </StrictMode>,
);
