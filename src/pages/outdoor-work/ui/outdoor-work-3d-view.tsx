import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Vector3 } from 'three';
import { OutdoorWorkModelSimulation } from '@/features/outdoor-work-model-simulation/ui/outdoor-work-model-simulation';

const DEFAULT_CAMERA_POSITION = new Vector3(-65, 20, -10);
const DEFAULT_TARGET = new Vector3(-65, 0, -35);
const TOP_VIEW_CAMERA_POSITION = new Vector3(-65, 92, -35);

export interface OutdoorWork3dViewHandle {
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleTopView: () => void;
}

interface ViewportControllerProps {
  onReady: (controls: OrbitControlsImpl) => void;
}

function ViewportController({ onReady }: ViewportControllerProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { camera } = useThree();

  useEffect(() => {
    const controls = controlsRef.current;

    if (!controls) {
      return;
    }

    camera.position.copy(DEFAULT_CAMERA_POSITION);
    controls.target.copy(DEFAULT_TARGET);
    controls.update();
    onReady(controls);
  }, [camera, onReady]);

  return <OrbitControls ref={controlsRef} enableDamping={false} />;
}

export const OutdoorWork3dView = forwardRef<OutdoorWork3dViewHandle>(
  function OutdoorWork3dView(_, ref) {
    const controlsRef = useRef<OrbitControlsImpl | null>(null);
    const [isTopView, setIsTopView] = useState(false);

    useImperativeHandle(ref, () => ({
      resetView: () => {
        const controls = controlsRef.current;

        if (!controls) {
          return;
        }

        controls.object.position.copy(DEFAULT_CAMERA_POSITION);
        controls.target.copy(DEFAULT_TARGET);
        controls.update();
        setIsTopView(false);
      },
      zoomIn: () => {
        const controls = controlsRef.current;

        if (!controls) {
          return;
        }

        const direction = new Vector3()
          .subVectors(controls.target, controls.object.position)
          .normalize()
          .multiplyScalar(8);

        controls.object.position.add(direction);
        controls.update();
      },
      zoomOut: () => {
        const controls = controlsRef.current;

        if (!controls) {
          return;
        }

        const direction = new Vector3()
          .subVectors(controls.object.position, controls.target)
          .normalize()
          .multiplyScalar(8);

        controls.object.position.add(direction);
        controls.update();
      },
      toggleTopView: () => {
        const controls = controlsRef.current;

        if (!controls) {
          return;
        }

        setIsTopView((prev) => {
          const next = !prev;

          controls.object.position.copy(
            next ? TOP_VIEW_CAMERA_POSITION : DEFAULT_CAMERA_POSITION,
          );
          controls.target.copy(DEFAULT_TARGET);
          controls.update();

          return next;
        });
      },
    }));

    return (
      <Canvas
        camera={{ position: DEFAULT_CAMERA_POSITION.toArray() }}
        gl={{
          toneMapping: 0,
          powerPreference: 'high-performance',
          alpha: false,
          antialias: true,
          stencil: false,
          autoClear: false,
          depth: true,
        }}
      >
        <ambientLight intensity={2} />
        <directionalLight
          position={[0, 50, 10]}
          color={'#ffffff'}
          intensity={5}
        />
        <ViewportController
          onReady={(controls) => {
            controlsRef.current = controls;
          }}
        />
        <OutdoorWorkModelSimulation />
      </Canvas>
    );
  },
);
