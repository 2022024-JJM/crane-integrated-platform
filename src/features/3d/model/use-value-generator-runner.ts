import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useValueGeneratorStore } from './use-value-generator-store';

export function useValueGeneratorRunner() {
  const interval = useValueGeneratorStore((s) => s.interval);
  const isRunning = useValueGeneratorStore((s) => s.isRunning);
  const tick = useValueGeneratorStore((s) => s.tick);
  const { scene } = useThree();

  const timerRef = useRef<number | null>(null);
  const tickRef = useRef(tick);
  const sceneRef = useRef(scene);
  tickRef.current = tick;
  sceneRef.current = scene;

  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = window.setInterval(() => {
      tickRef.current(sceneRef.current);
    }, interval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, interval]);
}
