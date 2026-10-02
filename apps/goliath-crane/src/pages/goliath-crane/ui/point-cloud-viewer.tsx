// LiDAR ProcessedPointCloudBundle 스트림을 React Three Fiber 위에서
// monitoring_web/src/viewer.js + main.js 와 동일한 결과로 렌더링한다.
// 서버 vendor (SOSLAB/OUSTER/SICK 등) 와 무관하게 동일한 포맷이므로
// 본 viewer 는 vendor 중립이다.
//
// - 한 컴포넌트(<PointCloudViewer>) = 한 Canvas. 그리드에 LiDAR 1/LiDAR 2/
//   Fusion 3개 타일이 있으면 Canvas 도 3개지만, 데이터 소스(WebSocket) 는
//   point-cloud-stream-store 에서 단일하게 공유된다.
// - mode 에 따라 INDIVIDUAL_LIDAR_CHANNELS 의 visibility 를 토글. fusion 일 때
//   는 모든 개별 센서가 visible.
// - mode === 'fusion' 이고 compact 가 아니면 레퍼런스(main.js) 와 동일한
//   상단 메트릭 그리드 + 우측 센서 패널(Transform/Reset) HUD 를 노출한다.
//
// 세부 렌더링/HUD 컴포넌트는 ui/point-cloud/ 서브트리로 분리되어 있다.

import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { CAMERA, SCENE_BG } from '../lib/point-cloud/config';
import {
  usePointCloudStreamStore,
  type PointCloudSensorMode,
} from '../model/point-cloud-stream-store';
import { CameraController } from './point-cloud/camera-controller';
import { SceneHelpers } from './point-cloud/scene-helpers';
import { SensorPoints } from './point-cloud/sensor-points';
import { CompactHud } from './point-cloud/huds/compact-hud';
import { FusionHud } from './point-cloud/huds/fusion-hud';
import { INDIVIDUAL_LIDAR_CHANNELS } from './vision/types';

export interface PointCloudViewerProps {
  /** 어떤 센서를 보여줄지. fusion = 둘 다 visible 합성. */
  mode: PointCloudSensorMode;
  /** 좁은 썸네일용. HUD 와 OrbitControls 를 끄고 자동 회전. */
  compact?: boolean;
}

export function PointCloudViewer({
  mode,
  compact = false,
}: PointCloudViewerProps) {
  // 단일 WebSocket 공유: 마운트마다 acquire, 언마운트마다 release.
  useEffect(() => {
    const { acquire, release } = usePointCloudStreamStore.getState();
    acquire();
    return () => release();
  }, []);

  const status = usePointCloudStreamStore((s) => s.status);
  const [refitToken, setRefitToken] = useState(0);
  const showFusionHud = !compact && mode === 'fusion';

  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-950">
      {!compact && !showFusionHud && <CompactHud mode={mode} status={status} />}
      {showFusionHud && (
        <FusionHud
          status={status}
          onRefit={() => setRefitToken((t) => t + 1)}
        />
      )}
      <Canvas
        gl={{ outputColorSpace: THREE.SRGBColorSpace, antialias: true }}
        dpr={[1, 2]}
        style={{ background: SCENE_BG }}
      >
        <PerspectiveCamera
          makeDefault
          position={[
            CAMERA.initialPosition[0],
            CAMERA.initialPosition[1],
            CAMERA.initialPosition[2],
          ]}
          fov={CAMERA.fov}
          near={CAMERA.near}
          far={CAMERA.far}
        />
        {!compact && (
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        )}
        <SceneHelpers />
        {/*
          개별 센서는 LIDAR_CHANNELS SSOT 에서 가져온다.
          modeVisible 은 mode 가 'fusion' 이거나 해당 mode 와 일치할 때만 true.
          SensorPoints 의 sensorKey prop 은 store sensors Map 의 key (sensorStoreKey) 다.
          colorHex 는 channel entry 의 값 (B4).
        */}
        {INDIVIDUAL_LIDAR_CHANNELS.map((channel) => (
          <SensorPoints
            key={channel.mode}
            sensorKey={channel.sensorStoreKey}
            fallbackColorHex={channel.colorHex}
            modeVisible={mode === channel.mode || mode === 'fusion'}
          />
        ))}
        <CameraController refitToken={refitToken} />
      </Canvas>
    </div>
  );
}
