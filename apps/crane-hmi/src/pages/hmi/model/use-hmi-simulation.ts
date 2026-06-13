import { useEffect, useRef, useState } from 'react';
import { axisLimits, zoneOf } from './limits';
import type { AxisLimits, CollisionLimits } from './limits';
import type {
  AlarmZone,
  ArrowDir,
  AxisStatus,
  CollisionAxisInfo,
  HmiSnapshot,
  MasterKind,
  SlaveCrane,
} from './types';
import { ZONE_SEVERITY } from './types';

const TICK_MS = 100;
/** 미속영역 속도 계수 (매뉴얼 2.3: 미속으로 제동) */
const SLOW_FACTOR = 0.35;
/** 정지영역 도달 후 후퇴(역방향 재개)까지 대기 시간 — 점멸 3초 + 체류 표시 확인용 */
const STOP_HOLD_S = 4;
/** 무알람 시 최근접 대상 표시 범위(m) — 매뉴얼 2.6 화면의 흰색 거리 표시 */
const NEAREST_SHOW_M = 30;
const MIN_DIST = 0.3;

const rad = (deg: number) => (deg * Math.PI) / 180;

interface Circle {
  id: string;
  x: number;
  y: number;
  r: number;
}

interface Nearest {
  id: string;
  d: number;
}

function edgeDist(px: number, py: number, c: Circle): number {
  return Math.max(MIN_DIST, Math.hypot(px - c.x, py - c.y) - c.r);
}

function nearestEdge(px: number, py: number, circles: Circle[]): Nearest {
  let best: Nearest = { id: circles[0].id, d: edgeDist(px, py, circles[0]) };
  for (let i = 1; i < circles.length; i += 1) {
    const d = edgeDist(px, py, circles[i]);
    if (d < best.d) best = { id: circles[i].id, d };
  }
  return best;
}

function minNearest(a: Nearest, b: Nearest): Nearest {
  return a.d <= b.d ? a : b;
}

// --- 축 시뮬레이터 ------------------------------------------------------------

interface AxisSim {
  pos: number;
  dir: 1 | -1;
  holdLeft: number;
}

interface AxisCfg {
  min?: number;
  max?: number;
  /** 단위/s (m 또는 °) */
  speed: number;
  /** 선회처럼 0~360 순환하는 축 */
  wrap?: boolean;
}

/**
 * 한 축을 한 틱 진행. 충돌 거리 피드백으로 매뉴얼 2.3 동작을 재현한다:
 * 미속영역 접근 → 감속, 정지영역 접근 → 정지(대기 후 후퇴), 안전영역 → 진입 불가.
 */
function stepAxis(
  a: AxisSim,
  cfg: AxisCfg,
  dt: number,
  distFn: (pos: number) => number,
  lim: AxisLimits,
): boolean {
  const d = distFn(a.pos);
  const approaching = distFn(a.pos + a.dir * 0.05) < d;
  let factor = 1;
  if (approaching) {
    const zone = zoneOf(d, lim);
    if (zone === 'stop' || d <= lim.safe) {
      if (a.holdLeft <= 0) {
        a.holdLeft = STOP_HOLD_S;
      } else {
        a.holdLeft -= dt;
        if (a.holdLeft <= 0) {
          a.dir = -a.dir as 1 | -1;
          a.holdLeft = 0;
        }
      }
      return false;
    }
    if (zone === 'slow') factor = SLOW_FACTOR;
  }

  let next = a.pos + a.dir * cfg.speed * factor * dt;
  if (cfg.wrap) {
    next = ((next % 360) + 360) % 360;
  } else {
    if (cfg.max !== undefined && next > cfg.max) {
      next = cfg.max;
      a.dir = -1;
    }
    if (cfg.min !== undefined && next < cfg.min) {
      next = cfg.min;
      a.dir = 1;
    }
  }
  // 이산 틱 오버슈트로 인한 안전영역 침범 방지
  if (distFn(next) < lim.safe && distFn(next) < d) return false;

  const moved = next !== a.pos;
  a.pos = next;
  return moved;
}

// --- 시나리오 공통 지형 ---------------------------------------------------------

const TTC05: Circle = { id: 'TTC-05', x: 45, y: 52, r: 34 };
const OC04: Circle = { id: 'OC-04', x: 190, y: 64, r: 40 };
const GC01 = { id: 'GC-01', railY: 215, x1: 22, x2: 228, trolleys: [152, 170] };

function slaveTtc05(t: number, commError: boolean): SlaveCrane {
  return {
    kind: 'TTC',
    id: TTC05.id,
    x: TTC05.x,
    y: TTC05.y,
    r: TTC05.r,
    boomLen: 30,
    boomDeg: (t * 2 + 140) % 360,
    commError,
  };
}

function slaveOc04(): SlaveCrane {
  return {
    kind: 'OC',
    id: OC04.id,
    x: OC04.x,
    y: OC04.y,
    r: OC04.r,
    boomLen: 38,
    boomDeg: 0,
    commError: false,
  };
}

function slaveGc(base: typeof GC01): SlaveCrane {
  return {
    kind: 'GC',
    id: base.id,
    railY: base.railY,
    x1: base.x1,
    x2: base.x2,
    trolleys: base.trolleys,
    commError: false,
  };
}

// --- 시뮬레이션 상태 -----------------------------------------------------------

interface SimState {
  kind: MasterKind;
  /** 경과 시간(s) — 슬레이브 붐 애니메이션용 */
  t: number;
  /** MASTER_AXES[kind] 순서와 1:1 */
  axes: [AxisSim, AxisSim, AxisSim];
}

function initSim(kind: MasterKind): SimState {
  const axis = (pos: number, dir: 1 | -1): AxisSim => ({
    pos,
    dir,
    holdLeft: 0,
  });
  switch (kind) {
    case 'TTC':
      return { kind, t: 0, axes: [axis(20, 1), axis(0, 1), axis(120, 1)] };
    case 'GC':
      return { kind, t: 0, axes: [axis(180, -1), axis(205, -1), axis(120, 1)] };
    case 'OC':
      return { kind, t: 0, axes: [axis(30, 1), axis(0, 1), axis(120, 1)] };
  }
}

function info(
  target: Nearest | null,
  lim: AxisLimits,
  direction: ArrowDir,
): CollisionAxisInfo {
  if (!target || target.d > NEAREST_SHOW_M) {
    return { zone: 'none', targetId: null, distance: null, direction: null };
  }
  const zone = zoneOf(target.d, lim);
  return {
    zone,
    targetId: target.id,
    distance: Math.round(target.d * 10) / 10,
    direction: zone === 'none' ? null : direction,
  };
}

function status(value: number, moving: boolean, dir: ArrowDir): AxisStatus {
  return { value, moving, dir };
}

type Computed = Omit<HmiSnapshot, 'alarmAt'>;

function overallZone(axes: CollisionAxisInfo[]): AlarmZone {
  let zone: AlarmZone = 'none';
  for (const a of axes) {
    if (ZONE_SEVERITY[a.zone] > ZONE_SEVERITY[zone]) zone = a.zone;
  }
  return zone;
}

// --- 종류별 시나리오 -----------------------------------------------------------

/** TTC 마스터: GC-01 방향 주행 왕복 + 연속 선회 + 트롤리 왕복 */
function stepTtc(
  s: SimState,
  limits: CollisionLimits,
  commErrorOn: boolean,
  dt: number,
): Computed {
  const [trolley, slew, travel] = s.axes;
  const lim = {
    traverse: axisLimits(limits, 'TTC', 'traverse'),
    slew: axisLimits(limits, 'TTC', 'slew'),
    travel: axisLimits(limits, 'TTC', 'travel'),
  };
  const X = 112;
  const BOOM = 45;
  const circles = [TTC05, OC04];
  const point = (deg: number, len: number, y: number) => ({
    px: X + len * Math.cos(rad(deg)),
    py: y + len * Math.sin(rad(deg)),
  });
  // 붐 끝단/트롤리 기준 최근접 — 선회영역 원들과 하단 GC-01 레일 모두 고려
  const boomNearest = (deg: number, len: number, y: number): Nearest => {
    const p = point(deg, len, y);
    const circle = nearestEdge(p.px, p.py, circles);
    const railGap = {
      id: GC01.id,
      d: Math.max(MIN_DIST, GC01.railY - p.py - 4),
    };
    return minNearest(circle, railGap);
  };

  const travelMoving = stepAxis(
    travel,
    { min: 105, max: 187, speed: 2 },
    dt,
    (y) => Math.max(MIN_DIST, GC01.railY - y - 22),
    lim.travel,
  );
  const slewMoving = stepAxis(
    slew,
    { wrap: true, speed: 3 },
    dt,
    (deg) => boomNearest(deg, BOOM, travel.pos).d,
    lim.slew,
  );
  const trolleyMoving = stepAxis(
    trolley,
    { min: 5, max: 45, speed: 1.5 },
    dt,
    (tl) => boomNearest(slew.pos, tl, travel.pos).d,
    lim.traverse,
  );

  const travelNearest: Nearest = {
    id: GC01.id,
    d: Math.max(MIN_DIST, GC01.railY - travel.pos - 22),
  };
  const slewNearest = boomNearest(slew.pos, BOOM, travel.pos);
  const trolleyNearest = boomNearest(slew.pos, trolley.pos, travel.pos);

  return {
    master: {
      id: 'TTC-01',
      kind: 'TTC',
      load: 0,
      status: [
        status(trolley.pos, trolleyMoving, trolley.dir > 0 ? 'up' : 'down'),
        status(slew.pos, slewMoving, slew.dir > 0 ? 'right' : 'left'),
        status(
          GC01.railY - travel.pos,
          travelMoving,
          travel.dir > 0 ? 'down' : 'up',
        ),
      ],
      geometry: {
        shape: 'circular',
        x: X,
        y: travel.pos,
        circleR: 48,
        boomLen: BOOM,
        slewDeg: slew.pos,
        trolley: trolley.pos,
      },
    },
    slaves: [slaveGc(GC01), slaveTtc05(s.t, commErrorOn), slaveOc04()],
    axes: [
      info(trolleyNearest, lim.traverse, 'up'),
      info(slewNearest, lim.slew, 'left'),
      info(travelNearest, lim.travel, 'down'),
    ],
    zone: 'none',
  };
}

/** GC 마스터: 거더 주행으로 TTC-05/OC-04 선회영역 접근 + UT/LT 트롤리 횡행 */
function stepGc(
  s: SimState,
  limits: CollisionLimits,
  commErrorOn: boolean,
  dt: number,
): Computed {
  const [ut, lt, travel] = s.axes;
  const lim = {
    ut: axisLimits(limits, 'GC', 'ut'),
    lt: axisLimits(limits, 'GC', 'lt'),
    travel: axisLimits(limits, 'GC', 'travel'),
  };
  const circles = [TTC05, OC04];
  // 트롤리 위치 기준 최근접 선회영역 — 횡행/주행 모두 점-원 거리로 판정
  const trolleyNearest = (x: number, y: number) => nearestEdge(x, y, circles);

  const utMoving = stepAxis(
    ut,
    { min: 55, max: 200, speed: 1.8 },
    dt,
    (x) => trolleyNearest(x, travel.pos).d,
    lim.ut,
  );
  const ltMoving = stepAxis(
    lt,
    { min: 75, max: 210, speed: 1.3 },
    dt,
    (x) => trolleyNearest(x, travel.pos).d,
    lim.lt,
  );
  const travelMoving = stepAxis(
    travel,
    { min: 60, max: 206, speed: 1.5 },
    dt,
    (y) => Math.min(trolleyNearest(ut.pos, y).d, trolleyNearest(lt.pos, y).d),
    lim.travel,
  );

  const utNearest = trolleyNearest(ut.pos, travel.pos);
  const ltNearest = trolleyNearest(lt.pos, travel.pos);
  const travelNearest = minNearest(utNearest, ltNearest);

  return {
    master: {
      id: 'GC-01',
      kind: 'GC',
      load: 0,
      status: [
        status(ut.pos, utMoving, ut.dir > 0 ? 'right' : 'left'),
        status(lt.pos, ltMoving, lt.dir > 0 ? 'right' : 'left'),
        status(travel.pos, travelMoving, travel.dir > 0 ? 'down' : 'up'),
      ],
      geometry: {
        shape: 'gantry',
        railY: travel.pos,
        x1: 25,
        x2: 225,
        trolleys: [ut.pos, lt.pos],
      },
    },
    slaves: [slaveTtc05(s.t, commErrorOn), slaveOc04()],
    axes: [
      info(utNearest, lim.ut, 'left'),
      info(ltNearest, lim.lt, 'left'),
      info(travelNearest, lim.travel, 'down'),
    ],
    zone: 'none',
  };
}

/** OC 마스터: 인입(붐 기복)으로 도달 반경 변화 + 선회 + GC-01 방향 주행 */
function stepOc(
  s: SimState,
  limits: CollisionLimits,
  commErrorOn: boolean,
  dt: number,
): Computed {
  const [luff, slew, travel] = s.axes;
  const lim = {
    luff: axisLimits(limits, 'OC', 'luff'),
    slew: axisLimits(limits, 'OC', 'slew'),
    travel: axisLimits(limits, 'OC', 'travel'),
  };
  const X = 112;
  const R_MAX = 50;
  const circles = [TTC05, OC04];
  const reach = (luffDeg: number) => R_MAX * Math.cos(rad(luffDeg));
  const tipNearest = (deg: number, len: number, y: number): Nearest =>
    nearestEdge(
      X + len * Math.cos(rad(deg)),
      y + len * Math.sin(rad(deg)),
      circles,
    );

  const travelMoving = stepAxis(
    travel,
    { min: 105, max: 187, speed: 1.5 },
    dt,
    (y) => Math.max(MIN_DIST, GC01.railY - y - 22),
    lim.travel,
  );
  const slewMoving = stepAxis(
    slew,
    { wrap: true, speed: 2.5 },
    dt,
    (deg) => tipNearest(deg, reach(luff.pos), travel.pos).d,
    lim.slew,
  );
  const luffMoving = stepAxis(
    luff,
    { min: 15, max: 70, speed: 2.5 },
    dt,
    (deg) => tipNearest(slew.pos, reach(deg), travel.pos).d,
    lim.luff,
  );

  const tip = tipNearest(slew.pos, reach(luff.pos), travel.pos);
  const travelNearest: Nearest = {
    id: GC01.id,
    d: Math.max(MIN_DIST, GC01.railY - travel.pos - 22),
  };

  return {
    master: {
      id: 'OC-01',
      kind: 'OC',
      load: 0,
      status: [
        status(luff.pos, luffMoving, luff.dir > 0 ? 'up' : 'down'),
        status(slew.pos, slewMoving, slew.dir > 0 ? 'right' : 'left'),
        status(
          GC01.railY - travel.pos,
          travelMoving,
          travel.dir > 0 ? 'down' : 'up',
        ),
      ],
      geometry: {
        shape: 'circular',
        x: X,
        y: travel.pos,
        circleR: R_MAX,
        boomLen: reach(luff.pos),
        slewDeg: slew.pos,
        trolley: null,
      },
    },
    slaves: [slaveGc(GC01), slaveTtc05(s.t, commErrorOn), slaveOc04()],
    axes: [
      info(tip, lim.luff, 'down'),
      info(tip, lim.slew, 'left'),
      info(travelNearest, lim.travel, 'down'),
    ],
    zone: 'none',
  };
}

function stepSim(
  s: SimState,
  limits: CollisionLimits,
  commErrorOn: boolean,
  dt: number,
): Computed {
  s.t += dt;
  const computed =
    s.kind === 'TTC'
      ? stepTtc(s, limits, commErrorOn, dt)
      : s.kind === 'GC'
        ? stepGc(s, limits, commErrorOn, dt)
        : stepOc(s, limits, commErrorOn, dt);
  computed.zone = overallZone(computed.axes);
  return computed;
}

// --- 훅 ------------------------------------------------------------------------

export interface HmiSimulationOptions {
  kind: MasterKind;
  /** 통신오류 데모 — TTC-05를 통신오류 상태로 표시 (매뉴얼 2.4) */
  commError: boolean;
  limits: CollisionLimits;
}

export function useHmiSimulation({
  kind,
  commError,
  limits,
}: HmiSimulationOptions): HmiSnapshot {
  const [snap, setSnap] = useState<HmiSnapshot>(() => ({
    ...stepSim(initSim(kind), limits, commError, 0),
    alarmAt: 0,
  }));
  const optsRef = useRef({ commError, limits });
  const alarmAtRef = useRef(0);

  useEffect(() => {
    optsRef.current = { commError, limits };
  }, [commError, limits]);

  useEffect(() => {
    const sim = initSim(kind);
    let prevZone: AlarmZone = 'none';
    setSnap({
      ...stepSim(sim, optsRef.current.limits, optsRef.current.commError, 0),
      alarmAt: alarmAtRef.current,
    });
    const id = setInterval(() => {
      const next = stepSim(
        sim,
        optsRef.current.limits,
        optsRef.current.commError,
        TICK_MS / 1000,
      );
      // 알람 영역 상향 진입 시 점멸 트리거 (매뉴얼 2.3)
      if (ZONE_SEVERITY[next.zone] > ZONE_SEVERITY[prevZone]) {
        alarmAtRef.current = Date.now();
      }
      prevZone = next.zone;
      setSnap({ ...next, alarmAt: alarmAtRef.current });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [kind]);

  return snap;
}
