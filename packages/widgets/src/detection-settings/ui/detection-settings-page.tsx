import { useTranslation } from 'react-i18next';
import { useSceneCollisionStore, useSceneZoneStore } from '@crane/features/3d';
import { Switch } from '@crane/ui/atoms/switch';
import { Card, CardContent } from '@crane/ui/molecules/card';

/**
 * 감지 설정 페이지 — 충돌 감지·영역 침범 감지의 설정 다섯 개를 한 곳에서
 * 관리한다(2026-09-17). 그 전엔 실시간·3D 플레이 독 팝업과 에디터 팔레트
 * 탭에 같은 스위치가 흩어져 있었다. 값은 features/3d 의 두 스토어가 들고
 * localStorage `crane:detection-settings` 에 영속되므로 이 페이지는 스위치만
 * 그린다 — 기록·침범 목록 같은 런타임 상태는 각 화면(경보 비네트·알람
 * 목록·실행 리포트)이 보여 준다. 가상 태그 페이지와 같이 내용은 전역이고
 * 경로만 region 하위다.
 */
export function DetectionSettingsPage() {
  const { t } = useTranslation();
  const collisionEnabled = useSceneCollisionStore((s) => s.enabled);
  const setCollisionEnabled = useSceneCollisionStore((s) => s.setEnabled);
  const pauseOnCollision = useSceneCollisionStore((s) => s.pauseOnCollision);
  const setPauseOnCollision = useSceneCollisionStore(
    (s) => s.setPauseOnCollision,
  );
  const zoneEnabled = useSceneZoneStore((s) => s.enabled);
  const setZoneEnabled = useSceneZoneStore((s) => s.setEnabled);
  const labelsVisible = useSceneZoneStore((s) => s.labelsVisible);
  const setLabelsVisible = useSceneZoneStore((s) => s.setLabelsVisible);
  const stopOnIntrusion = useSceneZoneStore((s) => s.stopOnIntrusion);
  const setStopOnIntrusion = useSceneZoneStore((s) => s.setStopOnIntrusion);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4">
      <div>
        <h1 className="text-foreground text-base font-semibold">
          {t('monitoring:detectionSettings.title')}
        </h1>
        <p className="text-muted-foreground text-xs">
          {t('monitoring:detectionSettings.subtitle')}
        </p>
      </div>

      <div className="grid max-w-3xl gap-3 md:grid-cols-2">
        <SettingsCard
          title={t('monitoring:detectionSettings.collision.title')}
          hint={t('monitoring:detectionSettings.collision.pauseHint')}
        >
          <SettingRow
            label={t('monitoring:detectionSettings.collision.enable')}
            checked={collisionEnabled}
            onChange={setCollisionEnabled}
          />
          <SettingRow
            label={t('monitoring:detectionSettings.collision.pauseOnCollision')}
            checked={pauseOnCollision}
            onChange={setPauseOnCollision}
          />
        </SettingsCard>

        <SettingsCard
          title={t('monitoring:detectionSettings.zones.title')}
          hint={t('monitoring:detectionSettings.zones.stopHint')}
        >
          <SettingRow
            label={t('monitoring:detectionSettings.zones.enable')}
            checked={zoneEnabled}
            onChange={setZoneEnabled}
          />
          <SettingRow
            label={t('monitoring:detectionSettings.zones.labels')}
            checked={labelsVisible}
            onChange={setLabelsVisible}
          />
          <SettingRow
            label={t('monitoring:detectionSettings.zones.stopOnIntrusion')}
            checked={stopOnIntrusion}
            onChange={setStopOnIntrusion}
          />
        </SettingsCard>
      </div>
    </div>
  );
}

function SettingsCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="space-y-3 px-4">
        <h2 className="text-[14px] font-semibold">{title}</h2>
        <div className="space-y-2">{children}</div>
        <p className="text-muted-foreground text-[11px] whitespace-pre-line">
          {hint}
        </p>
      </CardContent>
    </Card>
  );
}

function SettingRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="bg-muted/60 border-border/70 flex items-center justify-between rounded-md border px-3 py-2.5">
      <span className="text-[12px] font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
