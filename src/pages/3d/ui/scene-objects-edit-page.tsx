import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';

export function SceneObjectsEditPage() {
  return (
    <Canvas
      camera={{ position: [0, 50, 50] }}
      onPointerMissed={() => {
        // select(null);
      }}
    >
      <ambientLight intensity={2} />
      <directionalLight position={[0, 50, 10]} color={'white'} intensity={5} />
      <OrbitControls
        enableDamping={false}
        // enabled={selected === null ? true : false}
      />
    </Canvas>
  );
}
