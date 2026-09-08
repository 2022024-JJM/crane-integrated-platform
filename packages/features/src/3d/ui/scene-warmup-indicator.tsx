import { useTranslation } from 'react-i18next';
import { Spinner } from '@crane/ui/atoms/spinner';
import { cn } from '@crane/core/lib/utils';
import { useSceneWarmupStep } from '../model/use-scene-warmup-step';

/**
 * 로딩 뒤 후처리 상태 — 캔버스 좌측 상단에 스피너 + "…준비 중" 한 줄.
 *
 * 모델이 뜬 뒤에도 몇 초간 버벅이는 동안 무엇을 계산하는지 보여 준다
 * (BVH 빌드 → 충돌 기준선 → 에셋 로드, 단계 선택은 lib/scene-warmup-step).
 * 조작을 막지 않는다(pointer-events-none) — 초기 로딩 오버레이와 달리
 * 사용자가 기다릴 필요는 없고, 지금 느린 이유를 알려 주는 표시다.
 * 모니터링·리플레이·편집 화면이 같이 쓴다. 위치(absolute)는 부모가 정한다 —
 * 세 화면의 좌측 상단 슬롯 사정이 다르다.
 */
export function SceneWarmupIndicator({ className }: { className?: string }) {
  const { t } = useTranslation();
  const step = useSceneWarmupStep();
  if (!step) return null;

  const label =
    step.kind === 'bvh'
      ? t('common:viewer3d.warmup.bvh', { done: step.done, total: step.total })
      : step.kind === 'collision'
        ? t('common:viewer3d.warmup.collision')
        : t('common:viewer3d.warmup.assets', {
            loaded: step.loaded,
            total: step.total,
          });

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'bg-background/85 border-border/70 text-muted-foreground pointer-events-none flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium tabular-nums shadow-sm backdrop-blur-sm',
        className,
      )}
    >
      <Spinner className="size-3.5 shrink-0 text-orange-500" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
