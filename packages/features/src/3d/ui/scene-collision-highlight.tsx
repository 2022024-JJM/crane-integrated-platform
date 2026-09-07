import { Html } from '@react-three/drei';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  COLLISION_LINE_COLOR,
  COLLISION_LINE_WIDTH,
  ModelSelectionBox,
} from '@crane/domain/3d';
import { resolveRecordNodes } from '../lib/scene-collision-pairs';
import {
  useSceneCollisionStore,
  type SceneCollisionRecord,
} from '../model/use-scene-collision-store';

function selectActiveRecord(state: {
  history: SceneCollisionRecord[];
  activeRecordId: number | null;
}): SceneCollisionRecord | null {
  if (state.activeRecordId === null) return null;
  return state.history.find((r) => r.id === state.activeRecordId) ?? null;
}

/**
 * 활성 충돌 기록을 씬에 표시한다 — 두 노드의 빨간 박스 + 접촉점의 노란 경고
 * 배지. Canvas 안에 둔다.
 *
 * - 박스: `ModelSelectionBox` 에 `target` 을 주면 그 노드에 포털로 붙어 노드의
 *   움직임을 씬 그래프 상속으로 따라간다(선택 박스와 같은 구조, 색만 다르다).
 *   노드는 기록의 id·경로를 registry 에서 해석한다 — 리마운트된 모델도 찾고,
 *   없어진 노드는 건너뛴다.
 * - 경고 배지: 기록의 접촉점(월드 좌표, 충돌 순간 고정값)에 drei `Html` 로
 *   띄운다. 노드에 붙이지 않는 이유 — 접촉점은 그 순간의 월드 좌표라 이후
 *   노드가 움직여도 "어디서 부딪혔는지"를 가리켜야 한다. 화면 크기 고정,
 *   pointer-events-none 이라 orbit 조작을 막지 않는다.
 */
export function SceneCollisionHighlight() {
  const { t } = useTranslation();
  const record = useSceneCollisionStore(selectActiveRecord);
  const nodes = useMemo(
    () => (record ? resolveRecordNodes([record.a, record.b]) : []),
    [record],
  );
  if (!record) return null;
  return (
    <>
      {nodes.map((node) => (
        <ModelSelectionBox
          key={`${record.id}:${node.uuid}`}
          clone={node}
          target={node}
          isSelected
          color={COLLISION_LINE_COLOR}
          lineWidth={COLLISION_LINE_WIDTH}
        />
      ))}
      <group position={record.contactPoint}>
        {/* 라벨(zIndexRange [5,0])보다 앞에 온다 — 겹치면 경고가 위. */}
        <Html center zIndexRange={[6, 0]}>
          <WarningSign label={t('monitoring:sceneCollision.contact')} />
        </Html>
      </group>
    </>
  );
}

/**
 * ISO 7010 계열 일반 경고 표지 — 검은 테두리의 노란 삼각형에 검은 느낌표.
 * 아이콘 폰트·외부 자산 없이 인라인 SVG 로 그린다(폐쇄망·테마 무관).
 * 그림자는 두지 않는다 — 검은 테두리만으로 윤곽이 충분하다(사용자 요청).
 */
function WarningSign({ label }: { label: string }) {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 100 90"
      className="pointer-events-none size-10"
    >
      <title>{label}</title>
      {/* 바깥 검은 삼각형(모서리 둥글게) */}
      <polygon
        points="50,6 95,84 5,84"
        fill="#1a1a1a"
        stroke="#1a1a1a"
        strokeWidth="8"
        strokeLinejoin="round"
      />
      {/* 안쪽 노란 삼각형 */}
      <polygon points="50,24 82,78 18,78" fill="#f7e11a" />
      {/* 느낌표 — 위가 조금 넓은 막대 + 점 */}
      <path
        d="M44.5 38 h11 l-2.2 20 h-6.6 z"
        fill="#1a1a1a"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="67" r="4.6" fill="#1a1a1a" />
    </svg>
  );
}
