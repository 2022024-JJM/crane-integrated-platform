import type {
  HmiSnapshot,
  MasterGeometry,
  SlaveCircular,
} from '../model/types';
import { useHmiTheme } from './theme';
import type { HmiTheme } from './theme';

interface GantryGeom {
  railY: number;
  x1: number;
  x2: number;
  trolleys: number[];
}

function GcShape({
  gc,
  theme,
  commError = false,
}: {
  gc: GantryGeom;
  theme: HmiTheme;
  commError?: boolean;
}) {
  const body = commError ? theme.map.commBody : theme.map.boom;
  return (
    <g>
      <rect
        x={gc.x1}
        y={gc.railY - 3}
        width={gc.x2 - gc.x1}
        height={6}
        fill={body}
      />
      <rect
        x={gc.x1 - 3}
        y={gc.railY - 11}
        width={4.5}
        height={22}
        fill={body}
      />
      <rect
        x={gc.x2 - 1.5}
        y={gc.railY - 11}
        width={4.5}
        height={22}
        fill={body}
      />
      <rect
        x={gc.trolleys[0] - 6}
        y={gc.railY - 8}
        width={12}
        height={16}
        fill={commError ? '#ff8d8d' : theme.map.trolley}
      />
      <rect
        x={gc.trolleys[1] - 7}
        y={gc.railY - 10}
        width={14}
        height={20}
        fill={commError ? '#ffb9b9' : theme.map.trolleyAlt}
      />
    </g>
  );
}

function CircularShape({
  crane,
  theme,
}: {
  crane: SlaveCircular;
  theme: HmiTheme;
}) {
  const commError = crane.commError;
  const rad = (crane.boomDeg * Math.PI) / 180;
  const tipX = crane.x + crane.boomLen * Math.cos(rad);
  const tipY = crane.y + crane.boomLen * Math.sin(rad);
  const circleFill = commError
    ? theme.map.commFill
    : crane.kind === 'OC'
      ? theme.map.ocFill
      : theme.map.ttcFill;
  const circleStroke = commError
    ? theme.map.commBody
    : crane.kind === 'OC'
      ? theme.map.ocStroke
      : theme.map.ttcStroke;
  const boomColor = commError ? theme.map.commBody : theme.map.boom;

  return (
    <g>
      <circle
        cx={crane.x}
        cy={crane.y}
        r={crane.r}
        fill={circleFill}
        stroke={circleStroke ?? 'none'}
        strokeWidth={circleStroke ? 0.7 : 0}
      />
      {crane.kind === 'OC' ? (
        <>
          <rect
            x={crane.x - 9}
            y={crane.y - 5}
            width={15}
            height={10}
            fill={boomColor}
          />
          <line
            x1={crane.x + 4}
            y1={crane.y}
            x2={tipX}
            y2={tipY}
            stroke={boomColor}
            strokeWidth={4}
          />
        </>
      ) : (
        <>
          <line
            x1={crane.x - 10 * Math.cos(rad)}
            y1={crane.y - 10 * Math.sin(rad)}
            x2={tipX}
            y2={tipY}
            stroke={boomColor}
            strokeWidth={4}
          />
          <rect
            x={crane.x - 4.5}
            y={crane.y - 4.5}
            width={9}
            height={9}
            fill={commError ? '#ff8d8d' : theme.map.trolley}
            stroke={theme.map.trolleyStroke}
            strokeWidth={0.5}
          />
        </>
      )}
    </g>
  );
}

/** 마스터 도형 — 종류별 분기 (매뉴얼 2.2: TTC/TC 원+붐+트롤리, OC/CC 원+본체+붐, GC 거더) */
function MasterShape({
  geometry,
  theme,
}: {
  geometry: MasterGeometry;
  theme: HmiTheme;
}) {
  if (geometry.shape === 'gantry') {
    return <GcShape gc={geometry} theme={theme} />;
  }

  const rad = (geometry.slewDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const tipX = geometry.x + geometry.boomLen * cos;
  const tipY = geometry.y + geometry.boomLen * sin;

  return (
    <g>
      <circle
        cx={geometry.x}
        cy={geometry.y}
        r={geometry.circleR}
        fill={theme.map.masterFill}
        stroke={theme.map.masterStroke ?? 'none'}
        strokeWidth={theme.map.masterStroke ? 0.9 : 0}
      />
      {geometry.trolley !== null ? (
        <>
          <line
            x1={geometry.x - 11 * cos}
            y1={geometry.y - 11 * sin}
            x2={tipX}
            y2={tipY}
            stroke={theme.map.boom}
            strokeWidth={4.5}
          />
          <rect
            x={geometry.x + geometry.trolley * cos - 5}
            y={geometry.y + geometry.trolley * sin - 5}
            width={10}
            height={10}
            fill={theme.map.trolley}
            stroke={theme.map.trolleyStroke}
            strokeWidth={0.6}
          />
        </>
      ) : (
        <>
          <rect
            x={geometry.x - 9}
            y={geometry.y - 5}
            width={15}
            height={10}
            fill={theme.map.boom}
          />
          <line
            x1={geometry.x + 4 * cos}
            y1={geometry.y + 4 * sin}
            x2={tipX}
            y2={tipY}
            stroke={theme.map.boom}
            strokeWidth={4.5}
          />
        </>
      )}
    </g>
  );
}

interface CraneMapProps {
  snap: HmiSnapshot;
  /** 알람 영역 진입 시각 — 변경 시 3초 점멸 애니메이션 재시작 */
  flashKey: number;
}

/** 좌측 전체 보기 — 250m x 250m 탑뷰 (매뉴얼 2.2). 통신오류 크레인은 빨간색 (매뉴얼 2.4) */
export function CraneMap({ snap, flashKey }: CraneMapProps) {
  const theme = useHmiTheme();
  const { master, slaves, zone } = snap;
  const glow =
    zone !== 'none' && theme.alarm.glow ? theme.alarm.glow[zone] : null;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: theme.map.bg,
        border: theme.map.border,
        borderRadius: theme.panel.radius,
        boxShadow: glow
          ? `inset 0 0 0 2px ${glow}, 0 0 26px ${glow}66`
          : undefined,
        transition: 'box-shadow 0.3s',
        overflow: 'hidden',
      }}
    >
      {zone !== 'none' && (
        <div
          key={flashKey}
          className="hmi-flash"
          style={{
            position: 'absolute',
            inset: 0,
            background: theme.alarm.overlay[zone],
          }}
        />
      )}
      <svg
        viewBox="0 0 250 250"
        preserveAspectRatio="xMidYMid meet"
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      >
        {theme.map.grid && (
          <>
            <defs>
              <pattern
                id="hmiGrid"
                width="25"
                height="25"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 25 0 L 0 0 0 25"
                  fill="none"
                  stroke={theme.map.grid}
                  strokeWidth="0.4"
                />
              </pattern>
            </defs>
            {/* viewBox 밖(넓은 화면에서 생기는 좌우 여백)까지 그리드가 이어지도록 넉넉히 그린다 */}
            <rect
              x="-1000"
              y="-1000"
              width="2250"
              height="2250"
              fill="url(#hmiGrid)"
            />
          </>
        )}
        {slaves.map((s) =>
          s.kind === 'GC' ? (
            <GcShape key={s.id} gc={s} theme={theme} commError={s.commError} />
          ) : (
            <CircularShape key={s.id} crane={s} theme={theme} />
          ),
        )}
        <MasterShape geometry={master.geometry} theme={theme} />
      </svg>
    </div>
  );
}
