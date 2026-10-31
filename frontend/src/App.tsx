import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { OverviewPage } from '@/pages/OverviewPage';
import { LiveInspectionPage } from '@/pages/LiveInspectionPage';
import { InspectionsPage } from '@/pages/InspectionsPage';
import { DefectRecordsPage } from '@/pages/DefectRecordsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="live-inspection" element={<LiveInspectionPage />} />
          <Route path="inspections" element={<InspectionsPage />} />
          <Route path="defects" element={<DefectRecordsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
