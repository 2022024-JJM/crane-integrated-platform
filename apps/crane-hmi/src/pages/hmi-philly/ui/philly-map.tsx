import type { SVGProps } from 'react';
import type { PhillySnapshot } from '../model/types';
import { PHILLY_SPRITES } from './assets';
import { usePhillyTheme } from './theme';

/**
 * 필라델피아 조선소(Philadelphia Naval Shipyard) 탑뷰 지도 + 크레인 오버레이.
 * 원본 HMI의 CraneMap_Philly 믹스를 SVG로 재현한다.
 * 지도 팔레트는 라이트/다크 테마(theme.map)를 따른다.
 */

const VIEW_W = 1010;
const VIEW_H = 910;

// ---- 크레인 배치 상수 (지도 좌표) ---------------------------------------
/** 도크 레일 x 좌표 */
const DOCK_LEFT = 447;
const DOCK_RIGHT = 588;

/** GC-01: 주행(m) [40,120] → y [260,440] */
function gcTravelToY(travel: number) {
  return 260 + ((travel - 40) / 80) * 180;
}
/** GC-01: 횡행(m) [0,20] → 트롤리 x [450,556] */
function gcTrolleyToX(trolley: number) {
  return 450 + (trolley / 20) * 106;
}
/** LLC-01: 주행(m) [60,130] → y [600,470] (증가 = 북쪽) */
function llc1TravelToY(travel: number) {
  return 600 - ((travel - 60) / 70) * 130;
}
/** LLC-02: 주행(m) [62,118] → y [648,548] */
function llc2TravelToY(travel: number) {
  return 648 - ((travel - 62) / 56) * 100;
}
/** 선회각(° CCW, 동쪽 기준) → SVG 회전각. 지브 스프라이트는 -x(서쪽) 방향 */
function slewToRotation(slew: number) {
  return 180 - slew;
}
/** 기복각 → 지브 수평 투영 길이 배율 (기복 상승 = 반경 축소) */
function luffToJibScale(luffDeg: number) {
  const rad = (luffDeg * Math.PI) / 180;
  const base = Math.cos((25 * Math.PI) / 180);
  return Math.max(0.55, Math.min(1, Math.cos(rad) / base));
}

// ---- 정적 지도 요소 -------------------------------------------------------

/** 헤일로(배경색 외곽선)가 깔린 지도 라벨 — 도로/건물 위에서도 읽힌다 */
function MapText(props: SVGProps<SVGTextElement>) {
  const { map } = usePhillyTheme();
  return (
    <text
      {...props}
      paintOrder="stroke"
      stroke={map.labelHalo}
      strokeWidth={3.5}
      strokeLinejoin="round"
    />
  );
}

function Road({
  d,
  width,
  minor = false,
}: {
  d: string;
  width: number;
  minor?: boolean;
}) {
  const { map } = usePhillyTheme();
  return (
    <>
      <path
        d={d}
        fill="none"
        stroke={map.roadCasing}
        strokeWidth={width + (minor ? 2 : 3)}
        strokeLinecap="round"
      />
      <path
        d={d}
        fill="none"
        stroke={map.roadFill}
        strokeWidth={width}
        strokeLinecap="round"
      />
    </>
  );
}

function Poi({
  x,
  y,
  label,
  anchor = 'start',
  purple = false,
}: {
  x: number;
  y: number;
  label: string[];
  anchor?: 'start' | 'end';
  purple?: boolean;
}) {
  const { map } = usePhillyTheme();
  const tx = anchor === 'start' ? x + 15 : x - 15;
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={9}
        fill={purple ? map.purple : map.poiFill}
        stroke={purple ? map.purpleStroke : map.poiRing}
        strokeWidth={2}
      />
      {purple ? (
        <text
          x={x}
          y={y + 4}
          fontSize={13}
          fontWeight={700}
          fill="#ffffff"
          textAnchor="middle"
        >
          i
        </text>
      ) : (
        <circle cx={x} cy={y} r={3.5} fill={map.poiDot} />
      )}
      {label.map((line, i) => (
        <MapText
          key={line}
          x={tx}
          y={y - 2 + i * 16}
          fontSize={14}
          fill={purple ? map.purpleLabel : map.poiLabel}
          textAnchor={anchor}
        >
          {line}
        </MapText>
      ))}
    </g>
  );
}

function StaticMap() {
  const { map } = usePhillyTheme();
  return (
    <g>
      {/* 육지 */}
      <rect width={VIEW_W} height={VIEW_H} fill={map.land} />

      {/* Schuylkill River (좌측 수직 수역) */}
      <path
        d="M0 0 H64 C56 140 60 300 52 460 C46 590 52 730 42 910 H0 Z"
        fill={map.water}
      />

      {/* 하단 Reserve Basin 수역 + 피어 형상 */}
      <path
        d={
          'M0 910 V806 L150 798 L300 794 L440 790 L440 760 L595 760 L595 788 ' +
          'L660 784 L660 846 L708 846 L708 780 L790 774 L790 812 L846 812 ' +
          'L846 768 L900 762 L900 700 L946 700 L946 756 L1010 748 V910 Z'
        }
        fill={map.water}
      />

      {/* 공원 녹지 (상단 중앙) */}
      <rect x={420} y={0} width={62} height={58} rx={3} fill={map.green} />

      {/* 도크(드라이독) 구역 */}
      <rect
        x={445}
        y={240}
        width={145}
        height={470}
        fill={map.dock}
        stroke={map.dockLine}
      />
      <rect
        x={470}
        y={256}
        width={95}
        height={438}
        fill={map.dockInner}
        stroke={map.dockLine}
      />
      {/* 크레인 레일 */}
      <line
        x1={DOCK_LEFT}
        y1={232}
        x2={DOCK_LEFT}
        y2={716}
        stroke={map.rail}
        strokeWidth={2}
      />
      <line
        x1={DOCK_RIGHT}
        y1={232}
        x2={DOCK_RIGHT}
        y2={716}
        stroke={map.rail}
        strokeWidth={2}
      />

      {/* 도로 */}
      <Road d="M430 62 L1010 54" width={7} />
      <Road d="M64 252 L430 246 L640 258 L1010 272" width={7} />
      <Road d="M64 206 L210 96 L430 62" width={6} minor />
      <Road d="M430 62 L430 246" width={6} minor />
      <Road d="M432 246 L436 745" width={6} minor />
      <Road d="M640 258 L640 745" width={6} minor />
      <Road d="M700 262 L700 610" width={5} minor />
      <Road d="M940 54 L940 745" width={6} minor />
      <Road d="M880 450 L880 745" width={5} minor />

      {/* 건물 */}
      {(
        [
          [105, 78, 190, 118],
          [150, 208, 90, 34],
          [320, 92, 82, 92],
          [505, 92, 82, 74],
          [620, 82, 72, 58],
          [760, 92, 70, 48],
          [880, 92, 55, 44],
          [250, 300, 62, 118],
          [250, 470, 62, 88],
          [350, 300, 72, 178],
          [615, 300, 92, 148],
          [660, 472, 88, 58],
          [730, 300, 60, 88],
          [760, 430, 82, 58],
          [930, 470, 62, 50],
          [740, 560, 92, 55],
        ] as const
      ).map(([x, y, w, h]) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={w}
          height={h}
          fill={map.building}
          stroke={map.buildingLine}
        />
      ))}

      {/* 도로/수역 라벨 */}
      <MapText
        x={36}
        y={400}
        fontSize={15.5}
        fill={map.waterLabel}
        fontStyle="italic"
        textAnchor="middle"
        transform="rotate(-90 36 400)"
      >
        Schuylkill River
      </MapText>
      <MapText
        x={128}
        y={152}
        fontSize={14}
        fill={map.roadLabel}
        transform="rotate(-33 128 152)"
      >
        Basin Bridge Rd
      </MapText>
      <MapText x={560} y={50} fontSize={14} fill={map.roadLabel}>
        Constitution Ave
      </MapText>
      <MapText x={140} y={242} fontSize={14} fill={map.roadLabel}>
        Kitty Hawk Ave
      </MapText>
      <MapText x={310} y={238} fontSize={14} fill={map.roadLabel}>
        Kitty Hawk Ave
      </MapText>
      <MapText x={690} y={252} fontSize={14} fill={map.roadLabel}>
        Kitty Hawk Ave
      </MapText>
      <MapText
        x={424}
        y={160}
        fontSize={14}
        fill={map.roadLabel}
        transform="rotate(-90 424 160)"
        textAnchor="middle"
      >
        S 21st St
      </MapText>
      <MapText
        x={428}
        y={520}
        fontSize={14}
        fill={map.roadLabel}
        transform="rotate(-90 428 520)"
        textAnchor="middle"
      >
        S 21st St
      </MapText>
      <MapText
        x={634}
        y={530}
        fontSize={14}
        fill={map.roadLabel}
        transform="rotate(-90 634 530)"
        textAnchor="middle"
      >
        S 19th St
      </MapText>
      <MapText
        x={694}
        y={330}
        fontSize={13.5}
        fill={map.roadLabel}
        transform="rotate(-90 694 330)"
        textAnchor="middle"
      >
        S 18th St
      </MapText>
      <MapText
        x={934}
        y={150}
        fontSize={14}
        fill={map.roadLabel}
        transform="rotate(-90 934 150)"
        textAnchor="middle"
      >
        S 17th St
      </MapText>
      <MapText
        x={874}
        y={560}
        fontSize={13.5}
        fill={map.roadLabel}
        transform="rotate(-90 874 560)"
        textAnchor="middle"
      >
        Piers Rd
      </MapText>

      {/* POI */}
      <MapText x={556} y={288} fontSize={14} fill={map.poiLabel}>
        Rhoads Industries
      </MapText>
      <Poi x={620} y={296} label={['Navy Yard Cat', 'Community']} />
      <Poi x={655} y={44} label={['DTL-PHILADELPHIA']} anchor="end" />
      <Poi x={790} y={455} label={['Building 1000']} anchor="end" />
      <Poi
        x={835}
        y={500}
        label={['Philadelphia Naval', 'Shipyard 1921']}
        purple
      />
      <Poi x={955} y={505} label={['Building 22']} anchor="end" />
      <Poi
        x={855}
        y={585}
        label={['Philadelphia', 'Barge Company']}
        anchor="end"
      />
    </g>
  );
}

// ---- 크레인 오버레이 ------------------------------------------------------

/** GC 거더 렌더 크기 (원본 899×298 비율) */
const GC_W = 190;
const GC_H = GC_W / (899 / 298);
/** GC 트롤리 (거더와 같은 세로폭, 원본 폭비 85.9/308) */
const GC_TROLLEY_W = GC_H * (85.9 / 308);
/** LLC 레그 (원본 111×196 비율) */
const LLC_LEG_H = 46;
const LLC_LEG_W = LLC_LEG_H * (111 / 196);
/** LLC 지브 (원본 412×77 비율), 피벗은 좌측 끝에서 78% 지점 */
const LLC_JIB_W = 96;
const LLC_JIB_H = LLC_JIB_W * (77 / 412);
const LLC_JIB_PIVOT = 0.78;

/** 크레인 이름표 — 지도 위에서 어느 크레인인지 바로 식별되도록 */
function CraneTag({
  x,
  y,
  label,
  anchor = 'start',
}: {
  x: number;
  y: number;
  label: string;
  anchor?: 'start' | 'end';
}) {
  const t = usePhillyTheme();
  const w = label.length * 8.6 + 16;
  const h = 24;
  const left = anchor === 'start' ? x : x - w;
  return (
    <g>
      <rect
        x={left}
        y={y - h / 2}
        width={w}
        height={h}
        rx={5}
        fill={t.panelBg}
        stroke={t.border}
        opacity={0.94}
      />
      <text
        x={left + w / 2}
        y={y + 5}
        fontSize={14}
        fontWeight={700}
        fill={t.text}
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
}

function GcCrane({ snap }: { snap: PhillySnapshot }) {
  const y = gcTravelToY(snap.gc.travel.value);
  const trolleyX = gcTrolleyToX(snap.gc.trolley.value);
  return (
    <g>
      <image
        href={PHILLY_SPRITES.gcBody}
        x={(DOCK_LEFT + DOCK_RIGHT) / 2 - GC_W / 2}
        y={y - GC_H / 2}
        width={GC_W}
        height={GC_H}
        preserveAspectRatio="none"
      />
      <image
        href={PHILLY_SPRITES.gcTrolley}
        x={trolleyX - GC_TROLLEY_W / 2}
        y={y - GC_H / 2}
        width={GC_TROLLEY_W}
        height={GC_H}
        preserveAspectRatio="none"
      />
      <CraneTag x={DOCK_RIGHT + 12} y={y} label="GC-01" />
    </g>
  );
}

function LlcCrane({
  cx,
  cy,
  slew,
  luff,
  circleR,
  name,
  tagAnchor = 'start',
}: {
  cx: number;
  cy: number;
  slew: number;
  luff: number;
  circleR: number;
  name: string;
  tagAnchor?: 'start' | 'end';
}) {
  const { map } = usePhillyTheme();
  const rotation = slewToRotation(slew);
  const jibScale = luffToJibScale(luff);
  return (
    <g>
      {/* 선회 영역 */}
      <circle
        cx={cx}
        cy={cy}
        r={circleR}
        fill={map.slewCircle}
        fillOpacity={0.38}
      />
      {/* 포탈(레그) — 고정부 */}
      <image
        href={PHILLY_SPRITES.llcLeg}
        x={cx - LLC_LEG_W / 2}
        y={cy - LLC_LEG_H / 2}
        width={LLC_LEG_W}
        height={LLC_LEG_H}
        preserveAspectRatio="none"
      />
      {/* 상부 선회체(지브) — 선회각 회전 + 기복각 길이 투영 */}
      <g transform={`rotate(${rotation} ${cx} ${cy})`}>
        <g
          transform={`translate(${cx} ${cy}) scale(${jibScale} 1) translate(${-cx} ${-cy})`}
        >
          <image
            href={PHILLY_SPRITES.llcJib}
            x={cx - LLC_JIB_W * LLC_JIB_PIVOT}
            y={cy - LLC_JIB_H / 2}
            width={LLC_JIB_W}
            height={LLC_JIB_H}
            preserveAspectRatio="none"
          />
        </g>
      </g>
      <CraneTag
        x={tagAnchor === 'start' ? cx + circleR + 10 : cx - circleR - 10}
        y={cy}
        label={name}
        anchor={tagAnchor}
      />
    </g>
  );
}

export function PhillyMap({ snap }: { snap: PhillySnapshot }) {
  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      style={{ display: 'block' }}
    >
      <StaticMap />
      <GcCrane snap={snap} />
      <LlcCrane
        cx={560}
        cy={llc1TravelToY(snap.myCrane.travel.value)}
        slew={snap.myCrane.slewing.value}
        luff={snap.myCrane.luffing.value}
        circleR={42}
        name="LLC-01"
      />
      <LlcCrane
        cx={475}
        cy={llc2TravelToY(snap.llc2.travel.value)}
        slew={snap.llc2.slewing.value}
        luff={snap.llc2.luffing.value}
        circleR={38}
        name="LLC-02"
        tagAnchor="end"
      />
    </svg>
  );
}
