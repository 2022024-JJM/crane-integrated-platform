import { Html } from '@react-three/drei';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  COLLISION_LINE_COLOR,
  ObjectSilhouetteOutline,
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
 * 활성 충돌 기록을 씬에 표시한다 — 두 노드의 일체형 빨간 실루엣 테두리 +
 * 접촉점의 노란 경고 배지. Canvas 안에 둔다.
 *
 * - 테두리: `ObjectSilhouetteOutline`(@crane/domain/3d — 에디터 선택 표시와
 *   같은 구현, 스텐실 마스크 + 인플레이션 헐)에 두 노드를 함께 넘겨 합집합
 *   실루엣 하나로 두른다. 예전의 AABB 빨간 박스는 "영역 전체"를 둘러 실제
 *   어느 장비가 부딪혔는지 형태로 안 읽혔다. 노드는 기록의 id·경로를
 *   registry 에서 해석한다 — 리마운트된 모델도 찾고, 없어진 노드는 건너뛴다.
 * - 경고 배지: 기록의 접촉점(월드 좌표, 충돌 순간 고정값)에 drei `Html` 로
 *   띄운다. 노드에 붙이지 않는 이유 — 접촉점은 그 순간의 월드 좌표라 이후
 *   노드가 움직여도 "어디서 부딪혔는지"를 가리켜야 한다. 화면 크기 고정,
 *   pointer-events-none 이라 orbit 조작을 막지 않는다.
 */
export function SceneCollisionHighlight() {
  const { t } = useTranslation();
  const record = useSceneCollisionStore(selectActiveRecord);
  // 테두리는 충돌 메시가 아니라 **장비 전체**(모델 루트)에 씌운다 — 부딪힌
  // 부품 하나만 두르면 멀리서 어느 장비인지 안 읽힌다. nodePath 를 '' 로
  // 비워 registry 에서 모델 루트를 해석한다.
  const nodes = useMemo(
    () =>
      record
        ? resolveRecordNodes([
            { ...record.a, nodePath: '' },
            { ...record.b, nodePath: '' },
          ])
        : [],
    [record],
  );
  if (!record) return null;
  return (
    <>
      <ObjectSilhouetteOutline
        key={record.id}
        objects={nodes}
        color={COLLISION_LINE_COLOR}
      />
      <group position={record.contactPoint}>
        {/* 라벨(zIndexRange [5,0])보다 앞에 온다 — 겹치면 경고가 위. */}
        <Html center zIndexRange={[6, 0]}>
          <div className="pointer-events-none flex flex-col items-center gap-1">
            <div className="animate-pulse motion-reduce:animate-none">
              <WarningSign label={t('monitoring:sceneCollision.contact')} />
            </div>
            {/* 어떤 장비끼리인지 접촉 지점에서 바로 읽히게 — 팝업을 열지
                않아도 되는 1차 정보. */}
            <p className="rounded bg-red-600/90 px-1.5 py-0.5 text-[11px] leading-tight font-semibold whitespace-nowrap text-white shadow">
              {record.a.equipName || record.a.modelId}
              <span className="mx-1 font-normal opacity-80">↔</span>
              {record.b.equipName || record.b.modelId}
            </p>
          </div>
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
