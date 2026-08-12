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
  /** 세버리티 글리프 — 색 외 채널(적록색맹 대비) */
  mark: HTMLSpanElement;
}

/**
 * 기준 거리(월드 unit) — 이 거리에서 라벨이 CSS 원래 크기로 보이고,
 * 멀어지면 그에 비례해 작아진다(원근 감쇠). 에고 포즈의 실제 시거리
 * (후퇴 95 · 높이 100-12 → 약 130)에 맞춰 기본 구도에서 수치가 또렷하게
 * 읽히도록 잡는다.
 *
 * 부모 그룹 스케일(worldScale ≈ 3.4)이 여기에 곱해지므로, 실제로 넘기는
 * 값은 이 상수를 worldScale로 나눈 것이다 — 나누지 않으면 과장 배율만큼
 * 라벨이 덩달아 커진다. 다만 100% 상쇄하면 값이 38 수준으로 떨어져
 * 라벨이 1px로 사라지므로, 상수를 그만큼 키워 잡는다.
 */
const LABEL_DISTANCE_FACTOR = 440;

interface TrackLabelProps {
  /** 태그 부착 높이 (로컬 미터 — 그룹 스케일이 월드 unit으로 환산) */
  height: number;
  /**
   * 부모 그룹의 월드 스케일. drei의 distanceFactor는 부모 스케일에도
   * 곱해지므로, 이 값으로 나눠 과장 배율(sizeMultiplier)만큼 라벨이
   * 덩달아 커지는 것을 상쇄한다.
   */
  worldScale: number;
  register: (refs: TrackLabelRefs | null) => void;
}

export function TrackLabel({ height, worldScale, register }: TrackLabelProps) {
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
      const mark = root.querySelector<HTMLSpanElement>('[data-slot="mark"]');
      if (distance && speed && mark) {
        register({ root, distance, speed, mark });
      }
    },
    [register],
  );

  return (
    <Html
      position={[0, height, 0]}
      center
      distanceFactor={LABEL_DISTANCE_FACTOR / worldScale}
      zIndexRange={[5, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div
        ref={handleRoot}
        // 첫 tick 전까지 완전 투명 — opacity·배경/보더색은 부모가 구동
        // (주의: 어두운 칩 + amber 보더, 위험: red 칩 — 밝은 무대 위
        // amber 칩 + 흰 글자는 대비가 모자라 안 읽힌다)
        // translateY(-50%): drei center는 칩 "중앙"을 앵커에 놓아 칩
        // 하단이 객체 상단을 덮는다 — 반 칸 올려 객체를 가리지 않게.
        style={{ opacity: 0, transform: 'translateY(-50%)' }}
        className="relative rounded-md border px-2 py-1 font-mono text-xs leading-tight font-bold whitespace-nowrap text-white shadow-md"
      >
        {/* 세버리티 글리프 — 위험 ▲ / 주의 ● . 칩 배경색만으로 레벨을
            전달하면 적록색맹에게 amber/red가 같은 색으로 보인다.
            모양은 색각과 무관하게 읽힌다 */}
        <span data-slot="mark" className="mr-1 inline-block" />
        <span data-slot="distance" className="tabular-nums" />
        <span className="opacity-60"> · </span>
        <span data-slot="speed" className="tabular-nums" />
        {/* 말풍선 꼬리 — 라벨 높이 분산으로 칩이 떠 있어도 소속 객체를
            가리킨다. 배경색은 부모 칩(세버리티에 따라 동적)을 상속. */}
        <span
          aria-hidden
          className="absolute top-full left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rotate-45"
          style={{ backgroundColor: 'inherit' }}
        />
      </div>
    </Html>
  );
}
