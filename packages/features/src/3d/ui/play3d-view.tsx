import { useEffect, useRef } from 'react';
import type { MonitoringReplayUiState } from '@crane/domain/monitoring';
import type { AlarmSeverity } from '@crane/domain/alarm';
import { stopSimulation } from '../model/stop-simulation';
import { usePlay3dStatsRecorder } from '../model/use-play3d-stats-recorder';
import {
  usePlay3dStore,
  type Play3dSource,
} from '../model/use-play3d-store';
import { useReplayPlayerStore } from '../model/use-replay-player-store';
import { Monitoring3dView } from './monitoring-3d-view';
import { Play3dSourceTabs } from './play3d-source-tabs';
import { Play3dTransportBar } from './play3d-transport-bar';

const EMPTY_ALARMS: Record<string, AlarmSeverity> = {};

/**
 * 3D 플레이 뷰 — 소스 탭·트랜스포트 바를 위에, 3D 모니터링 뷰(mode='play3d')
 * 를 아래에 두고 실행 통계 기록기를 얹는다. 소스(리플레이|시뮬레이션)는 usePlay3dStore
 * 가 들고, 전환은 **리마운트가 아니라 상태 전환**이다 — 씬·GLB·카메라·검색
 * 상태·리플레이 프레임이 전부 유지되고 이전 소스만 여기서 정리한다.
 * (`key={source}` 리마운트는 useSceneData 진입의 resetReplay 로 프레임을
 * 잃었고, loadFrames effect 는 query data 가 바뀔 때만 돌아 되돌아와도 비어
 * 있었다.)
 *
 * 리포트 패널은 페이지가 옆에 둔다(Play3dReportPanel) — 같은 스토어를
 * 읽으므로 여기 안에 있을 필요가 없다.
 */
export function Play3dView({
  regionId,
  search,
  onLoadingChange,
}: {
  regionId: string;
  /** 리플레이 구간 검색 상태(앱 페이지의 useMonitoringReplayUiState). */
  search?: MonitoringReplayUiState;
  onLoadingChange?: (isLoading: boolean) => void;
}) {
  const source = usePlay3dStore((s) => s.source);
  usePlay3dStatsRecorder(regionId);

  // 소스 전환 — 떠나는 소스만 정리한다. 시뮬레이션은 종료(자세 rest·충돌
  // 기록 삭제), 리플레이는 정지 + 처음 프레임(프레임은 남긴다).
  const prevSourceRef = useRef<Play3dSource | null>(null);
  useEffect(() => {
    const prev = prevSourceRef.current;
    prevSourceRef.current = source;
    if (prev === null || prev === source) return;
    if (prev === 'simulation') {
      stopSimulation();
    } else {
      const replay = useReplayPlayerStore.getState();
      replay.pause();
      if (replay.frames.length > 0) replay.seekTo(0);
    }
  }, [source]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* 상단: 소스 탭 → 트랜스포트 바 → 캔버스(2026-09-17, 사용자 요청으로
          하단에서 올렸다). */}
      <Play3dSourceTabs />
      <Play3dTransportBar search={search} />
      <div className="relative min-h-0 flex-1">
        <Monitoring3dView
          regionId={regionId}
          mode="play3d"
          toolbarLayout="dock"
          alarmsByCraneId={EMPTY_ALARMS}
          alarmHighlightMesh={false}
          autoStartSimulation={false}
          onLoadingChange={onLoadingChange}
        />
      </div>
    </div>
  );
}
