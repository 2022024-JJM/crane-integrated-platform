import type {
  HmiSnapshot,
  MasterGeometry,
  SlaveCircular,
} from '../model/types';

const ZONE_BG: Record<string, string> = {
  near: '#f6f67c',
  slow: '#f57800',
  stop: '#ef0e0e',
};

const ORANGE = '#f88a00';
const TROLLEY_YELLOW = '#ffe23e';
const COMM_RED = '#e01212';

interface GantryGeom {
  railY: number;
  x1: number;
  x2: number;
  trolleys: number[];
}

function GcShape({
  gc,
  commError = false,
}: {
  gc: GantryGeom;
  commError?: boolean;
}) {
  const body = commError ? COMM_RED : ORANGE;
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
        fill={commError ? '#ff8d8d' : TROLLEY_YELLOW}
      />
      <rect
        x={gc.trolleys[1] - 7}
        y={gc.railY - 10}
        width={14}
        height={20}
        fill={commError ? '#ffb9b9' : '#f5ead0'}
      />
    </g>
  );
}

function CircularShape({ crane }: { crane: SlaveCircular }) {
  const commError = crane.commError;
  const rad = (crane.boomDeg * Math.PI) / 180;
  const tipX = crane.x + crane.boomLen * Math.cos(rad);
  const tipY = crane.y + crane.boomLen * Math.sin(rad);
  const circleFill = commError
    ? 'rgba(150, 12, 12, 0.55)'
    : crane.kind === 'OC'
      ? 'rgba(132, 128, 46, 0.42)'
      : 'rgba(64, 104, 108, 0.88)';
  const boomColor = commError ? COMM_RED : ORANGE;

  return (
    <g>
      <circle cx={crane.x} cy={crane.y} r={crane.r} fill={circleFill} />
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
            fill={commError ? '#ff8d8d' : TROLLEY_YELLOW}
            stroke="#7a6400"
            strokeWidth={0.5}
          />
        </>
      )}
    </g>
  );
}

/** 마스터 도형 — 종류별 분기 (매뉴얼 2.2: TTC/TC 원+붐+트롤리, OC/CC 원+본체+붐, GC 거더) */
function MasterShape({ geometry }: { geometry: MasterGeometry }) {
  if (geometry.shape === 'gantry') {
    return <GcShape gc={geometry} />;
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
        fill="rgba(62, 106, 110, 0.9)"
      />
      {geometry.trolley !== null ? (
        <>
          <line
            x1={geometry.x - 11 * cos}
            y1={geometry.y - 11 * sin}
            x2={tipX}
            y2={tipY}
            stroke={ORANGE}
            strokeWidth={4.5}
          />
          <rect
            x={geometry.x + geometry.trolley * cos - 5}
            y={geometry.y + geometry.trolley * sin - 5}
            width={10}
            height={10}
            fill={TROLLEY_YELLOW}
            stroke="#7a6400"
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
            fill={ORANGE}
          />
          <line
            x1={geometry.x + 4 * cos}
            y1={geometry.y + 4 * sin}
            x2={tipX}
            y2={tipY}
            stroke={ORANGE}
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
  const { master, slaves, zone } = snap;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#000',
        border: '1px solid #8c8c8c',
        overflow: 'hidden',
      }}
    >
      {zone !== 'none' && (
        <div
          key={flashKey}
          className="hmi-flash"
          style={{ position: 'absolute', inset: 0, background: ZONE_BG[zone] }}
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
        {slaves.map((s) =>
          s.kind === 'GC' ? (
            <GcShape key={s.id} gc={s} commError={s.commError} />
          ) : (
            <CircularShape key={s.id} crane={s} />
          ),
        )}
        <MasterShape geometry={master.geometry} />
      </svg>
    </div>
  );
}
