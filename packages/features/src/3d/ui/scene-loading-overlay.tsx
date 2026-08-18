import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@crane/ui/atoms/spinner';
import { cn } from '@crane/core/lib/utils';

/**
 * 첫 진입 시 3D 에셋(GLB/EXR)이 로드되는 동안 캔버스를 덮는 진행률 오버레이.
 *
 * 페이지 스피너는 씬 JSON(수 KB) 기준으로 꺼지기 때문에, 실제 무게인
 * GLB(수십 MB)를 받는 동안 빈 캔버스 → 모델 일괄 팝인 → 배경(EXR) 팝인이
 * 순서대로 "깜빡"였다. 이 오버레이는 로딩의 중간 상태를 보여주지 않고,
 * 모든 것이 준비된 뒤 한 번에 걷힌다.
 *
 * 걷힘 조건은 두 신호의 AND다:
 *  - `ready` — 씬 Suspense가 resolve됨 (SceneReadyProbe가 씬 안에서 보냄).
 *    타이머 추측이 아니라 실제 마운트 신호라, dev 모드처럼 로더 시작이
 *    수 초 늦어져도 오판하지 않는다. 캐시 완주(재방문)면 로더가 아예
 *    안 돌아도 이 신호로 즉시 걷힌다.
 *  - 로더 idle(`!active`) — EXR 등 씬 밖 Suspense의 에셋까지 끝났다는 뜻.
 * 짧은 유예(grace)를 둬 배치 사이 순간적인 idle에 일찍 걷히지 않는다.
 * 한 번 걷히면 이후 로드(충돌감지 워밍업 등)에는 다시 덮지 않는다.
 */
const DISMISS_GRACE_MS = 300;
const FADE_OUT_MS = 500;

interface SceneLoadingOverlayProps {
  /** 씬 Suspense가 resolve되어 모델이 마운트됐는지 (SceneReadyProbe 신호) */
  ready: boolean;
}

export function SceneLoadingOverlay({ ready }: SceneLoadingOverlayProps) {
  const { t } = useTranslation();
  const active = useProgress((s) => s.active);
  const progress = useProgress((s) => s.progress);
  const [dismissed, setDismissed] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (dismissed || !ready || active) return;
    const timer = setTimeout(() => setDismissed(true), DISMISS_GRACE_MS);
    return () => clearTimeout(timer);
  }, [ready, active, dismissed]);

  // 페이드아웃이 끝나면 언마운트.
  useEffect(() => {
    if (!dismissed) return;
    const timer = setTimeout(() => setGone(true), FADE_OUT_MS);
    return () => clearTimeout(timer);
  }, [dismissed]);

  if (gone) return null;

  return (
    <div
      aria-hidden={dismissed}
      className={cn(
        // 캔버스 배경색과 같은 불투명 커버 — 로딩 중간 상태(부분 팝인)를
        // 완전히 가리고, 걷힐 때만 완성된 씬이 드러난다.
        'absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-(--canvas-background) transition-opacity duration-500',
        dismissed ? 'opacity-0' : 'opacity-100',
      )}
    >
      <Spinner className="size-6 text-orange-500" aria-hidden />
      <p className="text-sm font-medium text-white tabular-nums">
        {t('common:viewer3d.loading')}
        {active ? ` ${Math.round(progress)}%` : ''}
      </p>
    </div>
  );
}

/**
 * 씬 Suspense의 마지막 자식으로 마운트하는 준비 신호 — Suspense가 resolve된
 * 뒤에야 effect가 돌므로 "모델이 실제로 마운트됐다"를 정확히 알린다.
 */
export function SceneReadyProbe({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}
