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

function isMro2Allowed(pathname: string): boolean {
  return pathname === '/mro2' || pathname.startsWith('/mro2/');
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

/*
 * 내업은 계정이 둘로 갈린다.
 *
 * - Indoorshop.IT  (`indoorshop`)    : 데이터 게더링 화면만
 * - Indoorshop.OT  (`indoorshop-ot`) : 통합 대시보드 (게더링 제외)
 *
 * 두 역할 모두 `/indoorshop` 아래를 쓰므로 prefix 하나로는 나눌 수 없다.
 * 각자 **자기 착지 경로**를 갖고, 상대 화면으로는 넘어가지 않는다.
 */
const INDOORSHOP_IT_LANDING = '/indoorshop/gathering';
const INDOORSHOP_OT_LANDING = '/indoorshop';

function isIndoorshopItAllowed(pathname: string): boolean {
  return (
    pathname === INDOORSHOP_IT_LANDING ||
    pathname.startsWith(`${INDOORSHOP_IT_LANDING}/`)
  );
}

function isIndoorshopOtAllowed(pathname: string): boolean {
  // 게더링은 IT 전용이므로 OT 의 허용 범위에서 뺀다
  if (isIndoorshopItAllowed(pathname)) return false;
  return pathname === '/indoorshop' || pathname.startsWith('/indoorshop/');
}

function isKeyinAllowed(pathname: string): boolean {
  return pathname === '/keyin' || pathname.startsWith('/keyin/');
}

function ProtectedRoute() {
  const { user } = useAuth();
  const location = useLocation();

  const role = user?.role ?? getStoredRole();
  if (!role) return <Navigate to="/login" replace />;
  if (role === 'mro' && !isMroAllowed(location.pathname)) {
    return <Navigate to="/mro-dashboard" replace />;
  }
  if (role === 'mro2' && !isMro2Allowed(location.pathname)) {
    return <Navigate to="/mro2" replace />;
  }
  if (role === 'hmi' && !isHmiAllowed(location.pathname)) {
    return <Navigate to="/hmi" replace />;
  }
  if (role === 'hmi2' && !isHmi2Allowed(location.pathname)) {
    return <Navigate to="/hmi2" replace />;
  }
  if (role === 'indoorshop' && !isIndoorshopItAllowed(location.pathname)) {
    return <Navigate to={INDOORSHOP_IT_LANDING} replace />;
  }
  if (role === 'indoorshop-ot' && !isIndoorshopOtAllowed(location.pathname)) {
    return <Navigate to={INDOORSHOP_OT_LANDING} replace />;
  }
  if (role === 'keyin' && !isKeyinAllowed(location.pathname)) {
    return <Navigate to="/keyin" replace />;
  }

  return <Outlet />;
}

function LoginGuard() {
  const role = getStoredRole();
  if (role === 'mro') return <Navigate to="/mro-dashboard" replace />;
  if (role === 'mro2') return <Navigate to="/mro2" replace />;
  if (role === 'hmi') return <Navigate to="/hmi" replace />;
  if (role === 'hmi2') return <Navigate to="/hmi2" replace />;
  if (role === 'indoorshop')
    return <Navigate to={INDOORSHOP_IT_LANDING} replace />;
  if (role === 'indoorshop-ot')
    return <Navigate to={INDOORSHOP_OT_LANDING} replace />;
  if (role === 'keyin') return <Navigate to="/keyin" replace />;
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

const Mro2Layout = lazy(() =>
  import('@crane/mro2/layout').then((m) => ({ default: m.Mro2Layout })),
);
const Mro2OverviewPage = lazy(() =>
  import('@crane/mro2/pages/overview').then((m) => ({
    default: m.Mro2OverviewPage,
  })),
);
const Mro2AssetsPage = lazy(() =>
  import('@crane/mro2/pages/assets').then((m) => ({
    default: m.Mro2AssetsPage,
  })),
);
const Mro2AssetDetailPage = lazy(() =>
  import('@crane/mro2/pages/assets').then((m) => ({
    default: m.Mro2AssetDetailPage,
  })),
);
const Mro2CalendarPage = lazy(() =>
  import('@crane/mro2/pages/calendar').then((m) => ({
    default: m.Mro2CalendarPage,
  })),
);
const Mro2ServicePlanPage = lazy(() =>
  import('@crane/mro2/pages/service-plan').then((m) => ({
    default: m.Mro2ServicePlanPage,
  })),
);
const Mro2ServiceRequestsPage = lazy(() =>
  import('@crane/mro2/pages/service-request').then((m) => ({
    default: m.Mro2ServiceRequestsPage,
  })),
);
const Mro2ServiceRequestDetailPage = lazy(() =>
  import('@crane/mro2/pages/service-request').then((m) => ({
    default: m.Mro2ServiceRequestDetailPage,
  })),
);
const Mro2InventoryPage = lazy(() =>
  import('@crane/mro2/pages/inventory').then((m) => ({
    default: m.Mro2InventoryPage,
  })),
);
const Mro2SpendPage = lazy(() =>
  import('@crane/mro2/pages/spend').then((m) => ({
    default: m.Mro2SpendPage,
  })),
);
const Mro2DocumentsPage = lazy(() =>
  import('@crane/mro2/pages/documents').then((m) => ({
    default: m.Mro2DocumentsPage,
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

const IndoorshopGatheringPage = lazy(() =>
  import('@crane/indoorshop/pages/gathering').then((m) => ({
    default: m.GatheringPage,
  })),
);

const IndoorshopKeyinPage = lazy(() =>
  import('@crane/indoorshop/pages/keyin').then((m) => ({
    default: m.KeyinPage,
  })),
);

/* 내업 통합 대시보드 (ocean-inshop-process/web-dashboard 이식) */
const InshopRoot = lazy(() =>
  import('@crane/indoorshop/shell').then((m) => ({ default: m.InshopRoot })),
);
const InshopDashboardPage = lazy(() =>
  import('@crane/indoorshop/pages/inshop-dashboard').then((m) => ({
    default: m.InshopDashboardPage,
  })),
);
const InshopZoneDetailPage = lazy(() =>
  import('@crane/indoorshop/pages/inshop-zone-detail').then((m) => ({
    default: m.InshopZoneDetailPage,
  })),
);
const InshopFactoryListPage = lazy(() =>
  import('@crane/indoorshop/pages/inshop-assembly').then((m) => ({
    default: m.InshopFactoryListPage,
  })),
);
const InshopAssemblyWorkspace = lazy(() =>
  import('@crane/indoorshop/pages/inshop-assembly').then((m) => ({
    default: m.InshopAssemblyWorkspace,
  })),
);
const InshopProductionCountPage = lazy(() =>
  import('@crane/indoorshop/pages/inshop-assembly').then((m) => ({
    default: m.InshopProductionCountPage,
  })),
);
const InshopYardWorkspace = lazy(() =>
  import('@crane/indoorshop/pages/inshop-yard').then((m) => ({
    default: m.InshopYardWorkspace,
  })),
);
const InshopSettingsPage = lazy(() =>
  import('@crane/indoorshop/pages/inshop-settings').then((m) => ({
    default: m.InshopSettingsPage,
  })),
);
const InshopDocsPage = lazy(() =>
  import('@crane/indoorshop/pages/inshop-docs').then((m) => ({
    default: m.InshopDocsPage,
  })),
);
const InshopDocViewerPage = lazy(() =>
  import('@crane/indoorshop/pages/inshop-docs').then((m) => ({
    default: m.InshopDocViewerPage,
  })),
);
const InshopNotFoundPage = lazy(() =>
  import('@crane/indoorshop/pages/inshop-not-found').then((m) => ({
    default: m.InshopNotFoundPage,
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
              {/* MRO2 — 헤더/사이드바는 기존 MRO와 동일한 AppLayout 공용 */}
              <Route
                path="mro2"
                element={
                  <LazyRoute>
                    <Mro2Layout />
                  </LazyRoute>
                }
              >
                <Route
                  index
                  element={
                    <LazyRoute>
                      <Mro2OverviewPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="assets"
                  element={
                    <LazyRoute>
                      <Mro2AssetsPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="assets/:craneId"
                  element={
                    <LazyRoute>
                      <Mro2AssetDetailPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="calendar"
                  element={
                    <LazyRoute>
                      <Mro2CalendarPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="service-plan"
                  element={
                    <LazyRoute>
                      <Mro2ServicePlanPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="service-requests"
                  element={
                    <LazyRoute>
                      <Mro2ServiceRequestsPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="service-requests/:kind/:id"
                  element={
                    <LazyRoute>
                      <Mro2ServiceRequestDetailPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="inventory"
                  element={
                    <LazyRoute>
                      <Mro2InventoryPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="spend"
                  element={
                    <LazyRoute>
                      <Mro2SpendPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="documents"
                  element={
                    <LazyRoute>
                      <Mro2DocumentsPage />
                    </LazyRoute>
                  }
                />
              </Route>
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
              {/*
                데이터 게더링 (Indoorshop.IT 전용).

                통합 대시보드(InshopRoot) 바깥의 형제 라우트다 — 다른 계정의
                화면이고, 이식된 대시보드의 팔레트 래퍼·provider 를 거칠 이유가
                없다.
              */}
              <Route
                path="indoorshop/gathering"
                element={
                  <LazyRoute>
                    <IndoorshopGatheringPage />
                  </LazyRoute>
                }
              />
              {/*
                내업 통합 대시보드. 원본(web-dashboard)의 라우트를 그대로 옮기되
                `/indoorshop` 아래로 한 단계 내렸다 — 원본의 `/`·`/docs`·`/settings`
                는 셸에서 이미 다른 모듈이 쓰고 있는 경로다.
                기존 데이터게더링 화면은 `gathering` 으로 유지한다.
              */}
              <Route
                path="indoorshop"
                element={
                  <LazyRoute>
                    <InshopRoot />
                  </LazyRoute>
                }
              >
                <Route
                  index
                  element={
                    <LazyRoute>
                      <InshopDashboardPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="zones/assembly"
                  element={
                    <LazyRoute>
                      <InshopFactoryListPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="zones/assembly/:factoryId"
                  element={
                    <LazyRoute>
                      <InshopAssemblyWorkspace />
                    </LazyRoute>
                  }
                />
                <Route
                  path="zones/assembly/:factoryId/production"
                  element={
                    <LazyRoute>
                      <InshopProductionCountPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="zones/assembly/:factoryId/:locationId"
                  element={
                    <LazyRoute>
                      <InshopAssemblyWorkspace />
                    </LazyRoute>
                  }
                />
                <Route
                  path="zones/:zoneId"
                  element={
                    <LazyRoute>
                      <InshopZoneDetailPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="logistics/yard"
                  element={
                    <LazyRoute>
                      <InshopYardWorkspace />
                    </LazyRoute>
                  }
                />
                <Route
                  path="docs"
                  element={
                    <LazyRoute>
                      <InshopDocsPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="docs/:docId"
                  element={
                    <LazyRoute>
                      <InshopDocViewerPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <LazyRoute>
                      <InshopSettingsPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="*"
                  element={
                    <LazyRoute>
                      <InshopNotFoundPage />
                    </LazyRoute>
                  }
                />
              </Route>
              <Route
                path="keyin"
                element={
                  <LazyRoute>
                    <IndoorshopKeyinPage />
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
