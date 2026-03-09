import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { OutdoorWorkModelSimulation } from '@/features/outdoor-work-model-simulation/ui/outdoor-work-model-simulation';

export function OutdoorWork3dView() {
  return (
    <>
      <Canvas
        camera={{ position: [-65, 20, -10] }}
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
        <OrbitControls enableDamping={false} target={[-65, 0, -35]} />
        <OutdoorWorkModelSimulation />
      </Canvas>
    </>
  );
}
