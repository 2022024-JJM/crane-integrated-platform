import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  formatPlanClearance,
  modelObjectRegistry,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import { cn } from '@crane/core/lib/utils';
import {
  PLAN_OVERLAP_SCAN_INTERVAL_MS,
  PLAN_OVERLAP_WARN_METERS,
  PlanOverlapScanner,
  buildPlanHiddenIndex,
  clonePlanOverlaps,
  hasPlanOverlapChanged,
  isPlanClearanceKnown,
} from '../lib/plan-overlap-scan';
import { usePlanOverlapStore } from '../model/use-plan-overlap-store';
import { isPlanLookCamera } from '../lib/plan-look';
import { usePlanLookStore } from '../model/use-plan-look-store';

/**
 * 평면도 겹침 검출(Canvas 안, 무렌더) — 활성 카메라가 직교일 때만
 * PLAN_OVERLAP_SCAN_INTERVAL_MS 마다 씬 모델의 메쉬 월드 박스로 겹침을 찾아
 * 스토어에 쓴다. 원근이면 스토어를 비운다. **RigDriver 뒤에 마운트**한다
 * (같은 priority 의 useFrame 은 마운트 순 — 움직인 뒤 잰다).
 */
export function ScenePlanOverlapDetector({
  sceneInfo,
}: {
  sceneInfo: SavedSceneInfo | null;
}) {
  const scannerRef = useRef<PlanOverlapScanner | null>(null);
  const lastScanRef = useRef(Number.NEGATIVE_INFINITY);
  const ids = useMemo(
    () => (sceneInfo?.models ?? []).map((model) => model.id),
    [sceneInfo],
  );

  useEffect(
    () => () => {
      scannerRef.current?.clear();
      usePlanOverlapStore.getState().clear();
    },
    [],
  );

  useFrame(({ camera, clock }) => {
    const planView = isPlanLookCamera(
      camera,
      usePlanLookStore.getState().enabled,
    );
    if (!planView) {
      usePlanOverlapStore.getState().clear();
      return;
    }
    const nowMs = clock.elapsedTime * 1000;
    if (nowMs - lastScanRef.current < PLAN_OVERLAP_SCAN_INTERVAL_MS) return;
    lastScanRef.current = nowMs;
    scannerRef.current ??= new PlanOverlapScanner();
    const next = scannerRef.current.scan(ids, (id) =>
      modelObjectRegistry.get(id),
    );
    const store = usePlanOverlapStore.getState();
    if (!hasPlanOverlapChanged(store.overlaps, next)) return;
    const copy = clonePlanOverlaps(next);
    store.set(copy, buildPlanHiddenIndex(copy));
  });

  return null;
}

/**
 * 겹침 칩 — 겹침 사각형 중심(위 메쉬 윗면)에 두 장비 이름과 Δh. 여유가
 * PLAN_OVERLAP_WARN_METERS 아래면 주의색. 여유를 알 수 없는 쌍
 * (isPlanClearanceKnown false)은 칩 없이 숨은선만. 클릭할 것이 없어 포인터를 끊는다.
 * 장비 이름은 씬의 equipName(없으면 id).
 */
export function ScenePlanOverlapChips({
  sceneInfo,
  metersPerUnit,
}: {
  sceneInfo: SavedSceneInfo | null;
  metersPerUnit: number;
}) {
  const { t } = useTranslation();
  const overlaps = usePlanOverlapStore((s) => s.overlaps);
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const model of sceneInfo?.models ?? []) {
      map.set(model.id, model.equipName || model.id);
    }
    return map;
  }, [sceneInfo]);

  if (overlaps.length === 0) return null;
  return (
    <>
      {overlaps.filter(isPlanClearanceKnown).map((overlap) => {
        const gapMeters = overlap.gap * metersPerUnit;
        const warn = gapMeters < PLAN_OVERLAP_WARN_METERS;
        return (
          <group key={overlap.key} position={overlap.center}>
            <Html center zIndexRange={[6, 0]}>
              <div
                role="note"
                aria-label={t('monitoring:planOverlap.label')}
                className={cn(
                  'pointer-events-none flex flex-col items-center rounded-sm border px-1.5 py-0.5 font-mono leading-tight whitespace-nowrap select-none',
                  warn
                    ? 'border-amber-400 bg-amber-400 text-black'
                    : 'border-white/40 bg-black/70 text-white',
                )}
              >
                <span className="text-[9px] opacity-80">
                  {nameById.get(overlap.upperId) ?? overlap.upperId}
                  {' / '}
                  {nameById.get(overlap.lowerId) ?? overlap.lowerId}
                </span>
                <span className="text-[11px] font-bold tabular-nums">
                  {formatPlanClearance(gapMeters)}
                </span>
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}
