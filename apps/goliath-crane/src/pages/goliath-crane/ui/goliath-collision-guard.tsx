import { Radar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  CollisionGuard,
  useCollisionGuardStore,
  type CollisionGuardZone,
} from '@crane/features/3d';
import { Button } from '@crane/ui/atoms/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import { cn } from '@crane/core/lib/utils';

/**
 * 골리앗 크레인 충돌 감지 존 설정.
 *
 * - center/y: goliath.json의 크레인 배치 위치([12.871, 0.587, -32.316]) 기준.
 * - 씬 축척: 도크 거리 텍스트(100m@x=-33 ↔ 900m@x=35)로부터 1 unit ≈ 11.7m.
 * - radius 6 unit ≈ 70m 감지 반경, dangerRadius 2.5 unit ≈ 30m 위험 반경.
 * - sizeMultiplier 3: 실측 크기(사람 1.7m ≈ 0.15 unit)로는 씬에서 너무
 *   작아 보이므로 시각적으로 3배 과장.
 */
const GOLIATH_COLLISION_ZONE: CollisionGuardZone = {
  center: [12.871, -32.316],
  y: 0.6,
  radius: 6,
  dangerRadius: 2.5,
  metersPerUnit: 11.7,
  sizeMultiplier: 3,
};

/** Monitoring3dView의 sceneExtras 슬롯에 넣는 씬 레이어 (Canvas 내부) */
export function GoliathCollisionGuardScene() {
  return <CollisionGuard zone={GOLIATH_COLLISION_ZONE} />;
}

/** Monitoring3dView의 toolbarExtras 슬롯에 넣는 토글 버튼 (DOM) */
export function GoliathCollisionGuardToggle() {
  const { t } = useTranslation('goliath-crane');
  const enabled = useCollisionGuardStore((s) => s.enabled);
  const toggle = useCollisionGuardStore((s) => s.toggle);

  const label = enabled
    ? t('collisionGuard.disable')
    : t('collisionGuard.enable');

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={label}
            aria-pressed={enabled}
            className={cn(
              'bg-background/85 border-border/70 shadow-sm backdrop-blur-sm',
              enabled &&
                'border-sky-500/60 bg-sky-500/15 text-sky-600 hover:bg-sky-500/25 dark:text-sky-400',
            )}
          />
        }
        onClick={toggle}
      >
        <Radar />
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}
