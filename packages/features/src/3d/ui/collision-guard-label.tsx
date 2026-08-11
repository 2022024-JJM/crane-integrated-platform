import { useEffect, useRef } from 'react';
import { Html } from '@react-three/drei';

/**
 * 감지 객체 거리·속도 태그 (FSD풍 빌보드).
 *
 * 감지 범위 안의 모든 활성 트랙에 표시된다. 배경색은 부모가 세버리티에
 * 따라 구동한다 — 주의는 amber, 위험은 red (씬 색 언어와 동일).
 *
 * React 상태를 쓰지 않는다 — 부모(DetectedObjectMesh)의 useFrame이
 * register로 받은 DOM ref를 직접 mutate한다(텍스트·배경색 8Hz, opacity는
 * 매 프레임). occlude는 쓰지 않는다(맵 전체 레이캐스트 비용).
 */

export interface TrackLabelRefs {
  root: HTMLDivElement;
  distance: HTMLSpanElement;
  speed: HTMLSpanElement;
}

interface TrackLabelProps {
  /** 태그 부착 높이 (로컬 미터 — 그룹 스케일이 월드 unit으로 환산) */
  height: number;
  register: (refs: TrackLabelRefs | null) => void;
}

export function TrackLabel({ height, register }: TrackLabelProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const distanceRef = useRef<HTMLSpanElement | null>(null);
  const speedRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (rootRef.current && distanceRef.current && speedRef.current) {
      register({
        root: rootRef.current,
        distance: distanceRef.current,
        speed: speedRef.current,
      });
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
        // 첫 tick 전까지 완전 투명 — opacity·배경색은 부모가 구동
        style={{ opacity: 0 }}
        className="rounded px-1.5 py-0.5 font-mono text-[10px] leading-none font-bold whitespace-nowrap text-white shadow-md"
      >
        <span ref={distanceRef} className="tabular-nums" />
        <span className="opacity-75"> · </span>
        <span ref={speedRef} className="tabular-nums" />
      </div>
    </Html>
  );
}
