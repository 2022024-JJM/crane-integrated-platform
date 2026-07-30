import { useTranslation } from 'react-i18next';
import { Activity } from 'lucide-react';
import { SectionCard } from './section-card';
import { StatTile } from './stat-tile';

interface FleetStatusPanelProps {
  componentCritical: number;
  componentLow: number;
  alertSafety: number;
  alertProduction: number;
}

export function FleetStatusPanel({
  componentCritical,
  componentLow,
  alertSafety,
  alertProduction,
}: FleetStatusPanelProps) {
  const { t } = useTranslation('philly-dashboard');

  return (
    <SectionCard
      title={t('connectivity.title')}
      variant="panel"
      accent="info"
      icon={Activity}
      href="/asset-management"
    >
      {/* 톤 틴트 타일 2×2 — 0은 뉴트럴로 가라앉아 색이 곧 신호가 된다 */}
      <div className="flex flex-col justify-center gap-4">
        <Group title={t('connectivity.componentCondition')}>
          {/* componentCritical = 수리 중 크레인 수 — 자산 관리의 repair 필터와 1:1 */}
          <StatTile
            value={componentCritical}
            label={t('connectivity.critical')}
            tone="critical"
            to="/asset-management?status=repair"
          />
          <StatTile value={componentLow} label={t('connectivity.low')} tone="warning" />
        </Group>
        <Group title={t('connectivity.operatingAlerts')}>
          {/* openItems.safety/production(리스크 레지스터)과 수식이 다르므로 라벨도 구분한다 */}
          <StatTile value={alertSafety} label={t('connectivity.immediate')} tone="critical" />
          <StatTile value={alertProduction} label={t('connectivity.preventive')} tone="warning" />
        </Group>
      </div>
    </SectionCard>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: [React.ReactNode, React.ReactNode];
}) {
  const [first, second] = children;
  return (
    <div>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {first}
        {second}
      </div>
    </div>
  );
}
