import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CountryProvider } from './context/CountryContext';
import { Layout } from './components/Layout';
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

function App() {
  return (
    <CountryProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/shortage-radar" element={<ShortageRadarPage />} />
            <Route path="/medicines" element={<MedicinesPage />} />
            <Route path="/facilities" element={<FacilitiesPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/consumption" element={<ConsumptionPage />} />
            <Route path="/procurement" element={<ProcurementPage />} />
            <Route path="/predictions" element={<PredictionsPage />} />
            <Route path="/redistribution" element={<RedistributionPage />} />
            <Route path="/ai-advisor" element={<AISupplyAdvisorPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/data-import" element={<DataImportPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </CountryProvider>
  );
}

export default App;

