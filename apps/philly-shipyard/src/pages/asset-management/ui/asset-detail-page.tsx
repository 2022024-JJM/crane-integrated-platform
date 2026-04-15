import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAssetDetail } from '@crane/features/asset';
import type { ComponentStatus, CraneComponent } from '@crane/domain/asset';
import type { InspectionStatus } from '@crane/domain/inspection';
import type { RepairPriority } from '@crane/domain/maintenance';
import { Badge } from '@crane/ui/atoms/badge';

function formatRelativeDate(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'D-Day';
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

const COMPONENT_STATUS_VARIANT: Record<ComponentStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  normal: 'success',
  caution: 'warning',
  warning: 'warning',
  critical: 'destructive',
  replace: 'destructive',
};

const INSP_STATUS_VARIANT: Record<InspectionStatus, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  scheduled: 'secondary',
  in_progress: 'warning',
  completed: 'success',
  overdue: 'destructive',
  cancelled: 'secondary',
};

const INSP_RESULT_VARIANT: Record<string, 'success' | 'destructive' | 'warning'> = {
  pass: 'success',
  fail: 'destructive',
  conditional: 'warning',
};

const REPAIR_PRIORITY_VARIANT: Record<RepairPriority, 'destructive' | 'warning' | 'secondary'> = {
  emergency: 'destructive',
  high: 'warning',
  normal: 'secondary',
  low: 'secondary',
};

const REPAIR_STATUS_VARIANT: Record<string, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  received: 'secondary',
  waiting_parts: 'destructive',
  in_progress: 'warning',
  re_inspection: 'warning',
  completed: 'success',
};

const HEALTH_COLOR: Partial<Record<ComponentStatus, string>> = {
  caution: 'text-amber-500',
  warning: 'text-amber-500',
  critical: 'text-red-500',
  replace: 'text-red-500',
};

function lifePercent(component: CraneComponent) {
  if (component.expectedLifeHours === 0) return 0;
  return Math.min(100, Math.round((component.currentHours / component.expectedLifeHours) * 100));
}

function ComponentRow({ component }: { component: CraneComponent }) {
  const { t } = useTranslation('asset-management');
  const pct = lifePercent(component);
  const barColor =
    pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="flex flex-col gap-2 rounded border border-border/90 bg-card/70 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{component.componentName}</span>
        <Badge variant={COMPONENT_STATUS_VARIANT[component.status]} className="shrink-0">
          {t(`detail.component.status.${component.status}`)}
        </Badge>
      </div>
      {component.partNumber && (
        <p className="text-xs text-muted-foreground">P/N: {component.partNumber}</p>
      )}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{t('detail.component.operatingHours')}</span>
          <span className="tabular-nums font-medium">
            {component.currentHours.toLocaleString()} / {component.expectedLifeHours.toLocaleString()} {t('units.hours')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <span className={`text-xs font-semibold tabular-nums shrink-0 w-9 text-right ${pct >= 90 ? 'text-red-500' : pct >= 70 ? 'text-amber-500' : 'text-emerald-500'}`}>
            {pct}%
          </span>
        </div>
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>{t('detail.component.lastInspection')}: {component.lastInspectionDate}</span>
        <span>{t('detail.component.nextInspection')}: {component.nextInspectionDate}</span>
      </div>
    </div>
  );
}

export function AssetDetailPage() {
  const { craneId } = useParams<{ craneId: string }>();
  const { asset, components, inspections, repairs } = useAssetDetail(craneId ?? '');
  const { t } = useTranslation('asset-management');
  const { t: tInspection } = useTranslation('inspection');
  const { t: tMaintenance } = useTranslation('maintenance');
  const [activeTab, setActiveTab] = useState<'info' | 'inspection' | 'maintenance'>('info');

  if (!asset) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <p className="text-muted-foreground">{t('detail.notFound')}</p>
      </div>
    );
  }

  const rootComponents = components.filter((c) => c.parentId === null);
  const getChildren = (parentId: string) => components.filter((c) => c.parentId === parentId);

  // 비정상 구성품 상태 집계
  const nonNormalStatuses: ComponentStatus[] = ['caution', 'warning', 'critical', 'replace'];
  const healthCounts = components.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<ComponentStatus, number>,
  );
  const hasNonNormal = nonNormalStatuses.some((s) => (healthCounts[s] ?? 0) > 0);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link
          to="/asset-management"
          className="cursor-pointer flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('title')}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 좌: 기본 정보 */}
        <div className="rounded border border-border/90 bg-card/60 p-5 shadow-sm backdrop-blur-sm space-y-4">
          <h2 className="text-base font-bold">{asset.name} — {t('detail.title')}</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            {[
              { label: t('detail.fields.craneType'), value: asset.craneType.toUpperCase() },
              { label: t('detail.fields.manufacturer'), value: asset.manufacturer },
              { label: t('detail.fields.model'), value: asset.model },
              { label: t('detail.fields.capacity'), value: `${asset.capacityTon} ${t('units.ton')}` },
              { label: t('detail.fields.span'), value: asset.spanM ? `${asset.spanM} ${t('units.meter')}` : '—' },
              { label: t('detail.fields.liftHeight'), value: asset.liftHeightM ? `${asset.liftHeightM} ${t('units.meter')}` : '—' },
              { label: t('detail.fields.serialNo'), value: asset.serialNumber },
              { label: t('detail.fields.site'), value: asset.siteName },
              { label: t('detail.fields.location'), value: asset.locationZone },
              { label: t('detail.fields.indoorOutdoor'), value: asset.indoorOutdoor },
              { label: t('detail.fields.installDate'), value: asset.installationDate },
              { label: t('detail.fields.manufactureDate'), value: asset.manufactureDate },
              { label: t('detail.fields.warrantyStart'), value: asset.warrantyStart },
              { label: t('detail.fields.warrantyEnd'), value: asset.warrantyEnd },
              { label: t('detail.fields.oshaClass'), value: asset.oshaClassification },
              { label: t('detail.fields.status'), value: asset.status.toUpperCase() },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-sm font-medium mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* 우: 탭 패널 */}
        <div className="rounded border border-border/90 bg-card/60 p-5 shadow-sm backdrop-blur-sm flex flex-col gap-4">
          {/* 탭 버튼 */}
          <div className="flex gap-1 rounded border border-border p-1 w-fit">
            {(['info', 'inspection', 'maintenance'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(`detail.tabs.${tab}`)}
              </button>
            ))}
          </div>

          {/* 탭: 기본 정보 (BOM) */}
          {activeTab === 'info' && (
            <div className="flex flex-col gap-4">
              {/* 구성품 헬스 롤업 */}
              {hasNonNormal && (
                <div className="flex items-center gap-2 flex-wrap px-1">
                  <span className="text-xs text-muted-foreground">{t('detail.componentHealth.title')}:</span>
                  {nonNormalStatuses.map((s, i, arr) => {
                    const count = healthCounts[s] ?? 0;
                    if (count === 0) return null;
                    return (
                      <span key={s} className="flex items-center gap-1">
                        <span className={`text-xs font-semibold tabular-nums ${HEALTH_COLOR[s]}`}>
                          {t(`detail.componentHealth.${s}`)} {count}
                        </span>
                        {i < arr.length - 1 && (healthCounts[arr[i + 1]] ?? 0) > 0 && (
                          <span className="text-muted-foreground text-xs">·</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}

              <h3 className="text-sm font-bold">{t('detail.bomTitle')}</h3>
              {rootComponents.length === 0 ? (
                <div className="rounded border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                  {t('detail.noBomData')}
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto max-h-120 pr-1">
                  {rootComponents.map((root) => {
                    const children = getChildren(root.id);
                    return (
                      <div key={root.id} className="space-y-2">
                        <ComponentRow component={root} />
                        {children.length > 0 && (
                          <div className="pl-5 space-y-2">
                            {children.map((child) => (
                              <ComponentRow key={child.id} component={child} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 탭: 점검 이력 */}
          {activeTab === 'inspection' && (
            <div className="flex flex-col gap-2">
              {inspections.length === 0 ? (
                <div className="rounded border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                  {t('detail.noInspectionHistory')}
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-120 pr-1">
                  {inspections.map((wo) => (
                    <Link
                      key={wo.id}
                      to={`/inspection/${wo.id}`}
                      className="cursor-pointer group flex items-center gap-3 px-3.5 py-3 rounded border border-border/90 bg-card/70 hover:bg-card hover:border-primary/40 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{wo.woNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className={`font-semibold mr-1 ${wo.status === 'overdue' ? 'text-red-500' : 'text-foreground'}`}>
                            {formatRelativeDate(wo.scheduledDate)}
                          </span>
                          {wo.scheduledDate}
                        </p>
                      </div>
                      <Badge variant={wo.woType === 'frequent' ? 'secondary' : 'warning'} className="shrink-0">
                        {tInspection(`type.${wo.woType}`)}
                      </Badge>
                      <Badge variant={INSP_STATUS_VARIANT[wo.status]} className="shrink-0">
                        {tInspection(`status.${wo.status}`)}
                      </Badge>
                      {wo.result ? (
                        <Badge variant={INSP_RESULT_VARIANT[wo.result]} className="shrink-0">
                          {tInspection(`result.${wo.result}`)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground shrink-0 w-10 text-right">—</span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 탭: 정비 이력 */}
          {activeTab === 'maintenance' && (
            <div className="flex flex-col gap-2">
              {repairs.length === 0 ? (
                <div className="rounded border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                  {t('detail.noMaintenanceHistory')}
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-120 pr-1">
                  {repairs.map((wo) => (
                    <Link
                      key={wo.id}
                      to={`/maintenance/${wo.id}`}
                      className="cursor-pointer group flex flex-col gap-1.5 px-3.5 py-3 rounded border border-border/90 bg-card/70 hover:bg-card hover:border-primary/40 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{wo.woNumber}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant={REPAIR_PRIORITY_VARIANT[wo.priority]}>
                            {tMaintenance(`priority.${wo.priority}`).toUpperCase()}
                          </Badge>
                          <Badge variant={REPAIR_STATUS_VARIANT[wo.status]}>
                            {tMaintenance(`status.${wo.status}`)}
                          </Badge>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{wo.componentName}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{wo.failureDescription}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold mr-1 text-foreground">
                          {formatRelativeDate(wo.scheduledStart.slice(0, 10))}
                        </span>
                        {wo.scheduledStart.slice(0, 10)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
