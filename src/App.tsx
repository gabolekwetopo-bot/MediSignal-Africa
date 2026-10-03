import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CountryProvider } from './context/CountryContext';
import { RoleProvider } from './context/RoleContext';
import { Layout } from './components/Layout';
import { HeroPage } from './pages/HeroPage';
import { DashboardPage } from './pages/DashboardPage';
import { ShortageRadarPage } from './pages/ShortageRadarPage';
import { MedicinesPage } from './pages/MedicinesPage';
import { FacilitiesPage } from './pages/FacilitiesPage';
import { InventoryPage } from './pages/InventoryPage';
import { ConsumptionPage } from './pages/ConsumptionPage';
import { ProcurementPage } from './pages/ProcurementPage';
import { PredictionsPage } from './pages/PredictionsPage';
import { RedistributionPage } from './pages/RedistributionPage';
import { AISupplyAdvisorPage } from './pages/AISupplyAdvisorPage';
import { AlertsPage } from './pages/AlertsPage';
import { DataImportPage } from './pages/DataImportPage';
import { ReportsPage } from './pages/ReportsPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';

const APP_ROUTES = [
  { path: '/dashboard', element: <DashboardPage /> },
  { path: '/shortage-radar', element: <ShortageRadarPage /> },
  { path: '/medicines', element: <MedicinesPage /> },
  { path: '/facilities', element: <FacilitiesPage /> },
  { path: '/inventory', element: <InventoryPage /> },
  { path: '/consumption', element: <ConsumptionPage /> },
  { path: '/procurement', element: <ProcurementPage /> },
  { path: '/predictions', element: <PredictionsPage /> },
  { path: '/redistribution', element: <RedistributionPage /> },
  { path: '/ai-advisor', element: <AISupplyAdvisorPage /> },
  { path: '/alerts', element: <AlertsPage /> },
  { path: '/data-import', element: <DataImportPage /> },
  { path: '/reports', element: <ReportsPage /> },
  { path: '/users', element: <UsersPage /> },
  { path: '/settings', element: <SettingsPage /> },
];

function App() {
  return (
    <CountryProvider>
      <RoleProvider>
        <BrowserRouter>
          <Routes>
            {/* Hero is standalone — no sidebar, no header */}
            <Route path="/" element={<HeroPage />} />

            {/* All app pages wrapped in the Layout */}
            {APP_ROUTES.map(r => (
              <Route
                key={r.path}
                path={r.path}
                element={<Layout>{r.element}</Layout>}
              />
            ))}
          </Routes>
        </BrowserRouter>
      </RoleProvider>
    </CountryProvider>
  );
}

export default App;
