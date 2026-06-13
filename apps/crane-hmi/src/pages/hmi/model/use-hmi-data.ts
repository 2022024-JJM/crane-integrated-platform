import type { HmiSnapshot } from './types';
import { useHmiSimulation } from './use-hmi-simulation';
import type { HmiSimulationOptions } from './use-hmi-simulation';

export type HmiDataOptions = HmiSimulationOptions;

/**
 * HMI 데이터 소스 추상화 — UI는 이 훅과 HmiSnapshot 계약만 의존한다.
 *
 * 현재는 시뮬레이션(useHmiSimulation)에 위임한다. PLC 연동 시 이 훅 내부를
 * `@crane/core/ws`의 WebSocket 클라이언트(acquire/release + subscribe)로 교체해
 * 스냅샷을 수신하고, 자유 선회/바이패스/컨트롤 상태 송신도 여기서 담당한다.
 * 이 파일 외의 UI 코드는 수정이 필요 없다.
 */
export function useHmiData(options: HmiDataOptions): HmiSnapshot {
  return useHmiSimulation(options);
}
