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

const GoliathWorkPage = lazy(() =>
  import('@crane/goliath-crane/pages/goliath-crane').then((m) => ({
    default: m.GoliathWorkPage,
  })),
);

const CraneDetailListPage = lazy(() =>
  import('@crane/hanwha-ocean/pages/crane-detail').then((m) => ({
    default: m.CraneDetailListPage,
  })),
);

const CraneDetailPage = lazy(() =>
  import('@crane/hanwha-ocean/pages/crane-detail').then((m) => ({
    default: m.CraneDetailPage,
  })),
);

const AssetManagementPage = lazy(() =>
  import('@crane/hanwha-ocean/pages/asset-management').then((m) => ({
    default: m.AssetManagementPage,
  })),
);

const AssetDetailPage = lazy(() =>
  import('@crane/hanwha-ocean/pages/asset-management').then((m) => ({
    default: m.AssetDetailPage,
  })),
);

const InspectionPage = lazy(() =>
  import('@crane/hanwha-ocean/pages/inspection').then((m) => ({
    default: m.InspectionPage,
  })),
);

const InspectionDetailPage = lazy(() =>
  import('@crane/hanwha-ocean/pages/inspection').then((m) => ({
    default: m.InspectionDetailPage,
  })),
);

const MaintenancePage = lazy(() =>
  import('@crane/hanwha-ocean/pages/maintenance').then((m) => ({
    default: m.MaintenancePage,
  })),
);

const MaintenanceDetailPage = lazy(() =>
  import('@crane/hanwha-ocean/pages/maintenance').then((m) => ({
    default: m.MaintenanceDetailPage,
  })),
);

const InventoryPage = lazy(() =>
  import('@crane/hanwha-ocean/pages/inventory').then((m) => ({
    default: m.InventoryPage,
  })),
);

const CompliancePage = lazy(() =>
  import('@crane/hanwha-ocean/pages/compliance').then((m) => ({
    default: m.CompliancePage,
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
          <Route
            path="goliath-work/:regionId/*"
            element={
              <Suspense fallback={null}>
                <GoliathWorkPage />
              </Suspense>
            }
          />
          <Route
            path="crane-detail"
            element={
              <Suspense fallback={null}>
                <CraneDetailListPage />
              </Suspense>
            }
          />
          <Route
            path="crane-detail/:craneId/*"
            element={
              <Suspense fallback={null}>
                <CraneDetailPage />
              </Suspense>
            }
          />
          <Route
            path="asset-management"
            element={
              <Suspense fallback={null}>
                <AssetManagementPage />
              </Suspense>
            }
          />
          <Route
            path="asset-management/:craneId"
            element={
              <Suspense fallback={null}>
                <AssetDetailPage />
              </Suspense>
            }
          />
          <Route
            path="inspection"
            element={
              <Suspense fallback={null}>
                <InspectionPage />
              </Suspense>
            }
          />
          <Route
            path="inspection/:inspectionId"
            element={
              <Suspense fallback={null}>
                <InspectionDetailPage />
              </Suspense>
            }
          />
          <Route
            path="maintenance"
            element={
              <Suspense fallback={null}>
                <MaintenancePage />
              </Suspense>
            }
          />
          <Route
            path="maintenance/:repairId"
            element={
              <Suspense fallback={null}>
                <MaintenanceDetailPage />
              </Suspense>
            }
          />
          <Route
            path="inventory"
            element={
              <Suspense fallback={null}>
                <InventoryPage />
              </Suspense>
            }
          />
          <Route
            path="compliance"
            element={
              <Suspense fallback={null}>
                <CompliancePage />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
