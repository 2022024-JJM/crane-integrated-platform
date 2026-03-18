import { BrowserRouter, Routes, Route } from 'react-router-dom';
import {
  DashboardPage,
  RegionOverviewPage,
  OutdoorWorkPage,
  IndoorWorkPage,
} from '@/pages';
import { AppLayout } from '@/widgets/layout';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="region-overview" element={<RegionOverviewPage />} />
          <Route
            path="outdoor-work/:regionId/*"
            element={<OutdoorWorkPage />}
          />
          <Route path="indoor-work/:regionId/*" element={<IndoorWorkPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
