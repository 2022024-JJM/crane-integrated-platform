import { useCallback } from 'react';
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
 *
 * 등록은 useEffect가 아니라 root의 ref 콜백에서 한다: drei Html은 자식을
 * 별도 React 루트(포털)로 렌더하므로 이 컴포넌트의 effect가 도는 시점에는
 * 포털 DOM이 아직 없다 — effect 등록은 조용히 영영 실패한다. ref 콜백은
 * 포털 커밋 시점에 (자식이 모두 붙은 뒤 bottom-up으로) 호출되므로
 * querySelector로 span들을 함께 넘길 수 있다.
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
  const handleRoot = useCallback(
    (root: HTMLDivElement | null) => {
      if (!root) {
        register(null);
        return;
      }
      const distance = root.querySelector<HTMLSpanElement>(
        '[data-slot="distance"]',
      );
      const speed = root.querySelector<HTMLSpanElement>('[data-slot="speed"]');
      if (distance && speed) {
        register({ root, distance, speed });
      }
    },
    [register],
  );

  return (
    <Html
      position={[0, height, 0]}
      center
      zIndexRange={[5, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div
        ref={handleRoot}
        // 첫 tick 전까지 완전 투명 — opacity·배경색은 부모가 구동
        style={{ opacity: 0 }}
        className="rounded px-1.5 py-0.5 font-mono text-[10px] leading-none font-bold whitespace-nowrap text-white shadow-md"
      >
        <span data-slot="distance" className="tabular-nums" />
        <span className="opacity-75"> · </span>
        <span data-slot="speed" className="tabular-nums" />
      </div>
    </Html>
  );
}
