import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth, AUTH_STORAGE_KEY } from '@crane/features/auth';
import { AppLayout } from '@crane/widgets/layout';
import { LoginPage } from './pages/login/login-page';
import { PhillyDashboardPage } from './pages/philly-dashboard/philly-dashboard-page';

function getStoredRole(): string | null {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { role: string }).role ?? null;
  } catch {
    return null;
  }
}

function getHomeRoute(role: string) {
  return role === 'philly' ? '/philly-dashboard' : '/';
}

function ProtectedRoute() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  // React 상태보다 sessionStorage를 우선 확인 (뒤로가기 등 stale 렌더 대응)
  const role = user?.role ?? getStoredRole();
  if (!role) return <Navigate to="/login" replace />;

  if (role === 'philly' && pathname === '/') {
    return <Navigate to="/philly-dashboard" replace />;
  }
  return <Outlet />;
}

function LoginGuard() {
  const role = getStoredRole();
  if (role) return <Navigate to={getHomeRoute(role)} replace />;
  return <LoginPage />;
}

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
  import('@crane/philly-shipyard/pages/asset-management').then((m) => ({
    default: m.AssetManagementPage,
  })),
);

const AssetDetailPage = lazy(() =>
  import('@crane/philly-shipyard/pages/asset-management').then((m) => ({
    default: m.AssetDetailPage,
  })),
);

const InspectionPage = lazy(() =>
  import('@crane/philly-shipyard/pages/inspection').then((m) => ({
    default: m.InspectionPage,
  })),
);

const InspectionDetailPage = lazy(() =>
  import('@crane/philly-shipyard/pages/inspection').then((m) => ({
    default: m.InspectionDetailPage,
  })),
);

const MaintenancePage = lazy(() =>
  import('@crane/philly-shipyard/pages/maintenance').then((m) => ({
    default: m.MaintenancePage,
  })),
);

const MaintenanceDetailPage = lazy(() =>
  import('@crane/philly-shipyard/pages/maintenance').then((m) => ({
    default: m.MaintenanceDetailPage,
  })),
);

const InventoryPage = lazy(() =>
  import('@crane/philly-shipyard/pages/inventory').then((m) => ({
    default: m.InventoryPage,
  })),
);

const CompliancePage = lazy(() =>
  import('@crane/philly-shipyard/pages/compliance').then((m) => ({
    default: m.CompliancePage,
  })),
);

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="login" element={<LoginGuard />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route
                path="philly-dashboard"
                element={<PhillyDashboardPage />}
              />
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
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
