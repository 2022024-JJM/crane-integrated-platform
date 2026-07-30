import { lazy, Suspense, type ReactNode } from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Routes,
  Route,
  useLocation,
  useParams,
} from 'react-router-dom';
import { AuthProvider, useAuth, AUTH_STORAGE_KEY } from '@crane/features/auth';
import { AppLayout } from '@crane/widgets/layout';
import { RouteErrorBoundary } from '@crane/core/lib/route-error-boundary';
import { getStorageJson } from '@crane/core/lib/safe-storage';
import { getRegionById } from '@crane/domain/region';
import { LoginPage } from './pages/login/login-page';
import { NotFoundPage } from './pages/not-found/not-found-page';

function LazyRoute({ children }: { children: ReactNode }) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={null}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}

function RegionGuard({ children }: { children: ReactNode }) {
  const { regionId } = useParams<{ regionId: string }>();
  if (!regionId || !getRegionById(regionId)) {
    return <NotFoundPage />;
  }
  return <>{children}</>;
}

function getStoredRole(): string | null {
  const stored = getStorageJson<{ role?: string }>(AUTH_STORAGE_KEY, 'session');
  return stored?.role ?? null;
}

const MRO_ALLOWED_EXACT = new Set([
  '/mro-dashboard',
  '/asset-management',
  '/inspection',
  '/maintenance',
  '/inventory',
  '/compliance',
  '/service-calendar',
  '/history',
  '/ticket/create',
]);
const MRO_ALLOWED_PREFIXES = [
  '/asset-management/',
  '/inspection/',
  '/maintenance/',
];

function isMroAllowed(pathname: string): boolean {
  if (MRO_ALLOWED_EXACT.has(pathname)) return true;
  return MRO_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p));
}

const HMI_ALLOWED_EXACT = new Set(['/hmi']);
const HMI_ALLOWED_PREFIXES = ['/hmi/'];

function isHmiAllowed(pathname: string): boolean {
  if (HMI_ALLOWED_EXACT.has(pathname)) return true;
  return HMI_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p));
}

const HMI2_ALLOWED_EXACT = new Set(['/hmi2']);
const HMI2_ALLOWED_PREFIXES = ['/hmi2/'];

function isHmi2Allowed(pathname: string): boolean {
  if (HMI2_ALLOWED_EXACT.has(pathname)) return true;
  return HMI2_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p));
}

function ProtectedRoute() {
  const { user } = useAuth();
  const location = useLocation();

  const role = user?.role ?? getStoredRole();
  if (!role) return <Navigate to="/login" replace />;
  if (role === 'mro' && !isMroAllowed(location.pathname)) {
    return <Navigate to="/mro-dashboard" replace />;
  }
  if (role === 'hmi' && !isHmiAllowed(location.pathname)) {
    return <Navigate to="/hmi" replace />;
  }
  if (role === 'hmi2' && !isHmi2Allowed(location.pathname)) {
    return <Navigate to="/hmi2" replace />;
  }

  return <Outlet />;
}

function LoginGuard() {
  const role = getStoredRole();
  if (role === 'mro') return <Navigate to="/mro-dashboard" replace />;
  if (role === 'hmi') return <Navigate to="/hmi" replace />;
  if (role === 'hmi2') return <Navigate to="/hmi2" replace />;
  if (role) return <Navigate to="/" replace />;
  return <LoginPage />;
}

const DashboardPage = lazy(() =>
  import('@crane/hanwha-ocean/pages/dashboard').then((m) => ({
    default: m.DashboardPage,
  })),
);

const DockStatusPage = lazy(() =>
  import('@crane/hanwha-ocean/pages/monitoring').then((m) => ({
    default: m.DockStatusPage,
  })),
);

const RegionMapPage = lazy(() =>
  import('@crane/hanwha-ocean/pages/monitoring').then((m) => ({
    default: m.RegionMapPage,
  })),
);

const RegionCmmsPage = lazy(() =>
  import('@crane/hanwha-ocean/pages/monitoring').then((m) => ({
    default: m.RegionCmmsPage,
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

const ServiceCalendarPage = lazy(() =>
  import('@crane/philly-shipyard/pages/service-calendar').then((m) => ({
    default: m.ServiceCalendarPage,
  })),
);

const CreateTicketPage = lazy(() =>
  import('@crane/philly-shipyard/pages/ticket').then((m) => ({
    default: m.CreateTicketPage,
  })),
);

const HistoryPage = lazy(() =>
  import('@crane/philly-shipyard/pages/history').then((m) => ({
    default: m.HistoryPage,
  })),
);

const PhillyDashboardPage = lazy(() =>
  import('@crane/philly-shipyard/pages/dashboard').then((m) => ({
    default: m.PhillyDashboardPage,
  })),
);

const HmiPage = lazy(() =>
  import('@crane/crane-hmi/pages/hmi').then((m) => ({
    default: m.HmiPage,
  })),
);

const HmiPhillyPage = lazy(() =>
  import('@crane/crane-hmi/pages/hmi-philly').then((m) => ({
    default: m.HmiPhillyPage,
  })),
);

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Routes>
          <Route path="login" element={<LoginGuard />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route
                path="mro-dashboard"
                element={
                  <LazyRoute>
                    <PhillyDashboardPage />
                  </LazyRoute>
                }
              />
              <Route
                path="hmi"
                element={
                  <LazyRoute>
                    <HmiPage />
                  </LazyRoute>
                }
              />
              <Route
                path="hmi2"
                element={
                  <LazyRoute>
                    <HmiPhillyPage />
                  </LazyRoute>
                }
              />
              <Route
                index
                element={
                  <LazyRoute>
                    <DashboardPage />
                  </LazyRoute>
                }
              />
              <Route
                path="region-overview"
                element={<Navigate to="/monitoring/dock-status" replace />}
              />
              <Route
                path="region-overview/*"
                element={<Navigate to="/monitoring/dock-status" replace />}
              />
              <Route
                path="monitoring"
                element={<Navigate to="/monitoring/dock-status" replace />}
              />
              <Route
                path="monitoring/dock-status"
                element={
                  <LazyRoute>
                    <DockStatusPage />
                  </LazyRoute>
                }
              />
              <Route
                path="monitoring/map"
                element={
                  <LazyRoute>
                    <RegionMapPage />
                  </LazyRoute>
                }
              />
              <Route
                path="monitoring/cmms"
                element={
                  <LazyRoute>
                    <RegionCmmsPage />
                  </LazyRoute>
                }
              />
              <Route
                path="outdoor-work/:regionId/*"
                element={
                  <LazyRoute>
                    <RegionGuard>
                      <OutdoorWorkPage />
                    </RegionGuard>
                  </LazyRoute>
                }
              />
              <Route
                path="indoor-work/:regionId/*"
                element={
                  <LazyRoute>
                    <RegionGuard>
                      <IndoorWorkPage />
                    </RegionGuard>
                  </LazyRoute>
                }
              />
              <Route
                path="goliath-work/:regionId/*"
                element={
                  <LazyRoute>
                    <RegionGuard>
                      <GoliathWorkPage />
                    </RegionGuard>
                  </LazyRoute>
                }
              />
              <Route
                path="crane-detail"
                element={
                  <LazyRoute>
                    <CraneDetailListPage />
                  </LazyRoute>
                }
              />
              <Route
                path="crane-detail/:craneId/*"
                element={
                  <LazyRoute>
                    <CraneDetailPage />
                  </LazyRoute>
                }
              />
              <Route
                path="asset-management"
                element={
                  <LazyRoute>
                    <AssetManagementPage />
                  </LazyRoute>
                }
              />
              <Route
                path="asset-management/:craneId"
                element={
                  <LazyRoute>
                    <AssetDetailPage />
                  </LazyRoute>
                }
              />
              <Route
                path="inspection"
                element={
                  <LazyRoute>
                    <InspectionPage />
                  </LazyRoute>
                }
              />
              <Route
                path="inspection/:inspectionId"
                element={
                  <LazyRoute>
                    <InspectionDetailPage />
                  </LazyRoute>
                }
              />
              <Route
                path="maintenance"
                element={
                  <LazyRoute>
                    <MaintenancePage />
                  </LazyRoute>
                }
              />
              <Route
                path="maintenance/:repairId"
                element={
                  <LazyRoute>
                    <MaintenanceDetailPage />
                  </LazyRoute>
                }
              />
              <Route
                path="inventory"
                element={
                  <LazyRoute>
                    <InventoryPage />
                  </LazyRoute>
                }
              />
              <Route
                path="compliance"
                element={
                  <LazyRoute>
                    <CompliancePage />
                  </LazyRoute>
                }
              />
              <Route
                path="service-calendar"
                element={
                  <LazyRoute>
                    <ServiceCalendarPage />
                  </LazyRoute>
                }
              />
              <Route
                path="history"
                element={
                  <LazyRoute>
                    <HistoryPage />
                  </LazyRoute>
                }
              />
              <Route
                path="ticket/create"
                element={
                  <LazyRoute>
                    <CreateTicketPage />
                  </LazyRoute>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
