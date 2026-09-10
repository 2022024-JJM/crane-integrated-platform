import { Html } from '@react-three/drei';
import { useTranslation } from 'react-i18next';
import {
  GhostModel,
  PREDICTION_LINE_COLOR,
  PREDICTION_LINE_RGB,
} from '@crane/domain/3d';
import {
  COUNTDOWN_ARC_RADIUS,
  countdownArc,
  formatLeadTimeSec,
  PREDICTION_GHOST_OPACITY,
} from '../lib/prediction-visual';
import { usePrefersReducedMotion } from '../model/use-prefers-reduced-motion';
import {
  useSceneCollisionStore,
  type ScenePredictedCollision,
} from '../model/use-scene-collision-store';

/**
 * 충돌 예측을 씬에 표시한다. 바운딩 박스가 아니라 **미래 자세 그 자체**를
 * 그린다 — 박스는 형태를 잃어 어느 부품이 어디로 가는지 안 읽혔다.
 *
 * 두 겹으로 쌓는다.
 * 1. **고스트**: 부딪히는 순간의 자세를 홀로그램(프레넬 림)으로 한 벌 더
 *    그린다. 실물이 자기 고스트를 향해 다가가는 장면이 되고, 붐이 어느
 *    각도에서 상대를 치는지 형태로 보인다. 구동되는 장비만 그린다 — 정적
 *    장비는 미래가 현재와 같아 이중상만 된다.
 * 2. **카운트다운**: 접촉 예상 지점 위에 띄우고 리더선으로 이어, 남은 시간을
 *    큰 숫자와 줄어드는 원형 호로 보여 준다.
 *
 * 2026-09-10 에 세 가지를 뺐다. 바운딩 박스(형태를 잃어 어느 부품이 어디로
 * 가는지 안 읽힘), 중간 시점 잔상 고스트(화면을 겹겹이 덮기만 함), 그리고
 * 접근 궤적 점선과 지면 핀(고스트가 이미 "어디로 가는지" 를 형태로 말하는데
 * 선이 하나 더 깔리면 시선만 분산됨). 고스트와 카운트다운 둘로 충분하다.
 *
 * 전부 **스텐실을 쓰지 않는다.** 스텐실 참조값이 캔버스당 하나뿐이라 빨간
 * 충돌 실루엣과 동시에 뜨면 발자국이 전역 합집합이 된다
 * (object-silhouette-outline 주석).
 *
 * 자세·궤적·지면 높이는 스토어가 쌍을 처음 발견한 시점에 고정해 둔 값이다.
 * 매 스윕 갱신하면 clone 과 라인이 계속 다시 만들어져 처닝이 생긴다.
 */
export function SceneCollisionPredictionHighlight() {
  const predicted = useSceneCollisionStore((s) => s.predicted);
  if (!predicted) return null;
  return <PredictionVisuals predicted={predicted} />;
}

/**
 * `predicted` 가 있을 때만 마운트되는 안쪽 — 훅을 조건부로 부르지 않으려고
 * 컴포넌트를 나눴다. 예측이 사라지면 통째로 언마운트되어 clone 도 정리된다.
 */
function PredictionVisuals({
  predicted,
}: {
  predicted: ScenePredictedCollision;
}) {
  const { t } = useTranslation();
  const reducedMotion = usePrefersReducedMotion();

  const nameA = predicted.a.equipName || predicted.a.modelId;
  const nameB = predicted.b.equipName || predicted.b.modelId;
  const untilImpact = t('monitoring:sceneCollision.predictUntilImpact');

  return (
    <>
      {/* 본체 고스트 — 부딪히는 순간의 자세. */}
      {predicted.ghosts.map((ghost) => (
        <GhostModel
          key={`ghost-${ghost.modelId}`}
          url={ghost.path}
          nodes={ghost.nodes}
          color={PREDICTION_LINE_COLOR}
          opacity={PREDICTION_GHOST_OPACITY}
        />
      ))}

      {/* 카운트다운 — 접촉 예상 지점 **위쪽**에 띄우고 리더선으로 잇는다.
          접촉점에 그대로 겹치면 정작 보여 줘야 할 고스트를 카운트다운과
          장비명이 가린다.

          drei `center` 는 앵커에 정중앙을 맞추므로 쓰지 않는다. 대신 블록
          **맨 아래에 리더선을 포함시키고** 전체를 자기 높이만큼 위로 올려
          (`-translate-y-full`), 리더선 끝이 접촉점에 정확히 닿게 한다.
          띄우는 높이 = 리더선 길이라 값이 한 곳에만 있다.

          리더선을 3D `<Line>` 이 아니라 DOM 으로 그리는 이유: 블록이 화면
          픽셀로 떠 있으므로 이어 주는 선도 화면 픽셀이어야 길이가 맞는다.
          월드 단위 선은 줌에 따라 길이가 달라져 어긋난다. 접촉점 아래
          지면까지 내려가는 기둥은 반대로 월드 단위가 맞아 3D 로 그린다. */}
      <group position={predicted.contactPoint}>
        {/* 라벨(zIndexRange [5,0])과 같은 층, 충돌 경고(6)보다 뒤 — 실제
            충돌이 같은 지점에 있으면 빨강이 위에 온다. */}
        <Html zIndexRange={[5, 0]}>
          <div className="pointer-events-none flex -translate-x-1/2 -translate-y-full flex-col items-center gap-1">
            <Countdown
              leadTimeSec={predicted.leadTimeSec}
              initialLeadTimeSec={predicted.initialLeadTimeSec}
              label={untilImpact}
              unit={t('monitoring:editor.collision.predictHorizonUnit')}
              animate={!reducedMotion}
            />
            <p className="rounded bg-teal-600/95 px-1.5 py-0.5 text-[11px] leading-tight font-semibold whitespace-nowrap text-white shadow">
              {nameA}
              <span className="mx-1 font-normal opacity-80">↔</span>
              {nameB}
            </p>
            {/* 리더선 + 접촉점 매듭. 점은 transform 으로만 내려 레이아웃
                높이에 들어가지 않는다 — 블록 아래 끝이 곧 접촉점이다. */}
            <div
              aria-hidden
              className="relative border-l-2 border-dashed border-teal-400/80"
              style={{ height: LEADER_HEIGHT_PX }}
            >
              <span className="absolute bottom-0 left-1/2 size-1.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-teal-300 shadow" />
            </div>
          </div>
        </Html>
      </group>
    </>
  );
}

/**
 * 카운트다운 블록과 접촉점을 잇는 리더선의 길이(화면 px). 이 값이 곧 블록이
 * 접촉점 위로 떠 있는 높이다 — 선이 블록의 마지막 자식이라 둘이 분리될 수 없다.
 */
const LEADER_HEIGHT_PX = 64;

/**
 * 남은 시간 — 큰 숫자 + 줄어드는 원형 호. 숫자만 있으면 변화가 잘 안 읽히고,
 * 호가 함께 줄면 긴박함이 생긴다. 색 단독 인코딩을 피해 숫자·호·단위를
 * 함께 쓴다.
 */
function Countdown({
  leadTimeSec,
  initialLeadTimeSec,
  label,
  unit,
  animate,
}: {
  leadTimeSec: number;
  initialLeadTimeSec: number;
  label: string;
  unit: string;
  animate: boolean;
}) {
  const { dash, gap } = countdownArc(leadTimeSec, initialLeadTimeSec);
  const text = formatLeadTimeSec(leadTimeSec);
  const size = COUNTDOWN_ARC_RADIUS * 2 + 8;
  const center = size / 2;
  return (
    <svg
      role="img"
      aria-label={`${label} ${text}${unit}`}
      viewBox={`0 0 ${size} ${size}`}
      className="size-16 drop-shadow"
    >
      <title>{`${label} ${text}${unit}`}</title>
      {/* 배경 원 — 어두운 지형 위에서도 호가 읽히게. */}
      <circle
        cx={center}
        cy={center}
        r={COUNTDOWN_ARC_RADIUS}
        fill="rgba(26,26,26,0.72)"
        stroke={`rgba(${PREDICTION_LINE_RGB}, 0.35)`}
        strokeWidth="3"
      />
      {/* 남은 비율 호 — 12시에서 시계 방향으로 줄어든다. */}
      <circle
        cx={center}
        cy={center}
        r={COUNTDOWN_ARC_RADIUS}
        fill="none"
        stroke={PREDICTION_LINE_COLOR}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${gap}`}
        transform={`rotate(-90 ${center} ${center})`}
        className={
          animate
            ? 'transition-[stroke-dasharray] duration-150 ease-linear'
            : ''
        }
      />
      {/* "무엇까지 남은 시간인지" 를 원 안에 함께 둔다 — 숫자만 있으면
          읽는 사람이 맥락을 잃고, 원 밖에 칩으로 띄우면 접촉 지점 위에
          덩어리가 하나 더 쌓인다. */}
      <text
        x={center}
        y={center - 12}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-teal-200 text-[8px] font-bold"
      >
        {label}
      </text>
      <text
        x={center}
        y={center + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-white text-[15px] font-bold tabular-nums"
      >
        {text}
      </text>
      <text
        x={center}
        y={center + 14}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-teal-200 text-[8px] font-semibold"
      >
        {unit}
      </text>
    </svg>
  );
}
