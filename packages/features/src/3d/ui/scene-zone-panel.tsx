import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@crane/ui/atoms/switch';
import {
  useSceneZoneStore,
  type ZoneIntrusion,
} from '../model/use-scene-zone-store';

/**
 * 모델 영역 침범 패널 — 감지 on/off, 씬 안 이름 배지 표시 on/off, 현재 침범 중
 * 목록. 에디터 팔레트 "영역" 탭과 모니터링 독 충돌 팝업(SceneCollisionMenu,
 * 충돌 패널 아래에 이어 붙임)이 함께 쓴다. 충돌 감지와는 별도 스토어이며
 * 기록은 없다(상태만) — 영역은 "현재 침범 중" 이라 행을 눌러도 아무 일도 없다.
 * 배지 토글은 감지와 독립이다 — 감지는 계속 돌고 링도 그대로이며 배지만
 * 사라진다.
 */
export const SceneZonePanel = memo(function SceneZonePanel() {
  const { t } = useTranslation();
  const enabled = useSceneZoneStore((s) => s.enabled);
  const labelsVisible = useSceneZoneStore((s) => s.labelsVisible);
  const intrusions = useSceneZoneStore((s) => s.intrusions);
  const setEnabled = useSceneZoneStore((s) => s.setEnabled);
  const setLabelsVisible = useSceneZoneStore((s) => s.setLabelsVisible);

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-medium">
          {t('monitoring:editor.zones.enable')}
        </span>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label={t('monitoring:editor.zones.enable')}
        />
      </label>
      <label className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-medium">
          {t('monitoring:editor.zones.labels')}
        </span>
        <Switch
          checked={labelsVisible}
          onCheckedChange={setLabelsVisible}
          aria-label={t('monitoring:editor.zones.labels')}
        />
      </label>

      <p className="text-muted-foreground pt-1 text-[10px] font-semibold tracking-[0.14em] uppercase">
        {t('monitoring:editor.zones.current')}
      </p>
      {intrusions.length === 0 ? (
        <p className="text-muted-foreground text-[10px]">
          {t('monitoring:editor.zones.none')}
        </p>
      ) : (
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {intrusions.map((intrusion) => (
            <ZoneIntrusionRow key={intrusion.zoneKey} intrusion={intrusion} />
          ))}
        </ul>
      )}
    </div>
  );
});

function ZoneDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2 shrink-0 rounded-full"
      style={{ background: color }}
    />
  );
}

function ZoneIntrusionRow({ intrusion }: { intrusion: ZoneIntrusion }) {
  // 이름은 추가 시 "영역 n" 으로 채워져 비는 일이 드물다 — 비웠으면 id.
  const zoneName = intrusion.zoneName || intrusion.zoneId;
  return (
    <li className="border-border bg-muted/30 flex items-start gap-1.5 rounded-md border p-1.5">
      <ZoneDot color={intrusion.color} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium">
          {intrusion.ownerName}
          <span className="text-muted-foreground mx-1">·</span>
          {zoneName}
        </p>
        <p className="text-muted-foreground truncate text-[10px]">
          ← {intrusion.intruders.map((i) => i.name).join(', ')}
        </p>
      </div>
    </li>
  );
}
