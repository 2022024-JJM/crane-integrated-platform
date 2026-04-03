import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@crane/widgets/layout';

const DashboardPage = lazy(() =>
  import('@crane/hanwha-ocean/pages/dashboard').then((m) => ({
    default: m.DashboardPage,
  })),
);

const RegionOverviewPage = lazy(() =>
  import('@crane/hanwha-ocean/pages/region-overview').then((m) => ({
    default: m.RegionOverviewPage,
  })),
);

const OutdoorWorkPage = lazy(() =>
  import('@crane/hanwha-ocean/pages/outdoor-work').then((m) => ({
    default: m.OutdoorWorkPage,
  })),
);

const IndoorWorkPage = lazy(() =>
  import('@crane/hanwha-ocean/pages/indoor-work').then((m) => ({
    default: m.IndoorWorkPage,
  })),
);

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route
            index
            element={
              <Suspense fallback={null}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="region-overview"
            element={
              <Suspense fallback={null}>
                <RegionOverviewPage />
              </Suspense>
            }
          />
          <Route
            path="outdoor-work/:regionId/*"
            element={
              <Suspense fallback={null}>
                <OutdoorWorkPage />
              </Suspense>
            }
          />
          <Route
            path="indoor-work/:regionId/*"
            element={
              <Suspense fallback={null}>
                <IndoorWorkPage />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
