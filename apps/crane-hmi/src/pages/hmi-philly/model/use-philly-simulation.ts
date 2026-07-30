import { useEffect, useState } from 'react';
import type { AxisDir, AxisState, PhillySnapshot } from './types';

const TICK_MS = 100;

/** 왕복(bounce) 축 시뮬레이션 상태 */
interface BounceAxis {
  value: number;
  dir: AxisDir;
  min: number;
  max: number;
  /** 초당 변화량 */
  rate: number;
}

function stepBounce(axis: BounceAxis): BounceAxis {
  if (axis.dir === 0) return axis;
  let value = axis.value + axis.dir * axis.rate * (TICK_MS / 1000);
  let dir = axis.dir;
  if (value >= axis.max) {
    value = axis.max;
    dir = -1;
  } else if (value <= axis.min) {
    value = axis.min;
    dir = 1;
  }
  return { ...axis, value, dir };
}

interface SimState {
  tick: number;
  /** LLC-01 (MY CRANE) */
  luff1: BounceAxis;
  slew1: BounceAxis;
  trav1: BounceAxis;
  /** LLC-02 */
  luff2: BounceAxis;
  slew2: BounceAxis;
  trav2: BounceAxis;
  /** GC-01 */
  gcTravel: BounceAxis;
  gcTrolley: BounceAxis;
}

/** 초기값은 원본 HMI 화면(2026-07-29 13:51 캡처)과 동일하게 맞춘다 */
const INITIAL_SIM: SimState = {
  tick: 0,
  luff1: { value: 35.0, dir: 1, min: 25, max: 62, rate: 1.4 },
  slew1: { value: 128.1, dir: 1, min: 55, max: 210, rate: 4.0 },
  trav1: { value: 93.8, dir: 1, min: 60, max: 130, rate: 1.1 },
  luff2: { value: 48.0, dir: -1, min: 28, max: 58, rate: 0.9 },
  slew2: { value: 236.0, dir: -1, min: 150, max: 320, rate: 2.6 },
  trav2: { value: 105.0, dir: -1, min: 62, max: 118, rate: 0.7 },
  gcTravel: { value: 70.0, dir: 1, min: 40, max: 120, rate: 1.6 },
  gcTrolley: { value: 3.0, dir: 1, min: 0.5, max: 19.5, rate: 0.9 },
};

function toAxis(axis: BounceAxis): AxisState {
  return { value: axis.value, dir: axis.dir };
}

function toSnapshot(sim: SimState): PhillySnapshot {
  // 하중은 99.8t 부근에서 미세하게 흔들리는 정도로만 변화
  const load = 99.8 + 0.3 * Math.sin(sim.tick / 70);
  return {
    load,
    myCrane: {
      luffing: toAxis(sim.luff1),
      slewing: toAxis(sim.slew1),
      travel: toAxis(sim.trav1),
    },
    llc2: {
      luffing: toAxis(sim.luff2),
      slewing: toAxis(sim.slew2),
      travel: toAxis(sim.trav2),
    },
    gc: {
      travel: toAxis(sim.gcTravel),
      trolley: toAxis(sim.gcTrolley),
    },
  };
}

/**
 * Philly Anti-Collision HMI 데모 시뮬레이션.
 * 100ms 틱으로 LLC-01/LLC-02/GC-01 3대의 축을 왕복 구동한다.
 * (실 PLC 연동 시 이 훅을 WebSocket 데이터 소스로 교체)
 */
export function usePhillySimulation(): PhillySnapshot {
  const [sim, setSim] = useState<SimState>(INITIAL_SIM);

  useEffect(() => {
    const id = setInterval(() => {
      setSim((prev) => ({
        tick: prev.tick + 1,
        luff1: stepBounce(prev.luff1),
        slew1: stepBounce(prev.slew1),
        trav1: stepBounce(prev.trav1),
        luff2: stepBounce(prev.luff2),
        slew2: stepBounce(prev.slew2),
        trav2: stepBounce(prev.trav2),
        gcTravel: stepBounce(prev.gcTravel),
        gcTrolley: stepBounce(prev.gcTrolley),
      }));
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  return toSnapshot(sim);
}
