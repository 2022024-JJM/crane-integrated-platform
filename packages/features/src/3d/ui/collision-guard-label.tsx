import { useEffect, useRef } from 'react';
import { Html } from '@react-three/drei';

/**
 * 감지 객체 위험 거리 태그 (FSD풍 빌보드).
 *
 * 평시에는 보이지 않는다 — 객체를 가리지 않도록 상시 라벨을 두지 않고
 * (거리·속도·종류는 HUD 패널이 담당), 위험 반경 진입 시에만 부모가
 * opacity를 올려 작고 붉은 거리 태그가 나타난다.
 *
 * React 상태를 쓰지 않는다 — 부모(DetectedObjectMesh)의 useFrame이
 * register로 받은 DOM ref를 직접 mutate한다(거리 텍스트 8Hz, opacity는
 * 매 프레임). occlude는 쓰지 않는다(맵 전체 레이캐스트 비용).
 */

export interface TrackLabelRefs {
  root: HTMLDivElement;
  distance: HTMLSpanElement;
}

interface TrackLabelProps {
  /** 태그 부착 높이 (로컬 미터 — 그룹 스케일이 월드 unit으로 환산) */
  height: number;
  register: (refs: TrackLabelRefs | null) => void;
}

export function TrackLabel({ height, register }: TrackLabelProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const distanceRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (rootRef.current && distanceRef.current) {
      register({ root: rootRef.current, distance: distanceRef.current });
    }
    return () => register(null);
  }, [register]);

  return (
    <Html
      position={[0, height, 0]}
      center
      zIndexRange={[5, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div
        ref={rootRef}
        // 위험 전까지 완전 투명 — opacity는 부모가 매 프레임 구동
        style={{ opacity: 0 }}
        className="rounded bg-red-500/90 px-1.5 py-0.5 font-mono text-[10px] leading-none font-bold whitespace-nowrap text-white shadow-md"
      >
        <span ref={distanceRef} className="tabular-nums" />
      </div>
    </Html>
  );
}
