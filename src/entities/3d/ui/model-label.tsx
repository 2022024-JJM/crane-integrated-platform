import { Html } from '@react-three/drei';
import type { Vector3Tuple } from '@/shared/types/math';

type AlarmHighlightSeverity = 'critical' | 'high' | 'medium' | 'info';

const ALARM_LABEL_CLASS: Record<AlarmHighlightSeverity, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-400 text-black',
  info: 'bg-blue-500 text-white',
};

interface ModelLabelProps {
  id: string;
  equipName?: string;
  position: Vector3Tuple;
  offsetY: number;
  alarmSeverity?: AlarmHighlightSeverity | null;
  onSelect?: (id: string) => void;
  onHoverStart?: (id: string, clientX: number, clientY: number) => void;
  onHoverMove?: (id: string, clientX: number, clientY: number) => void;
  onHoverEnd?: (id: string) => void;
}

export function ModelLabel({
  id,
  equipName,
  position,
  offsetY,
  alarmSeverity = null,
  onSelect,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
}: ModelLabelProps) {
  return (
    <Html
      transform
      sprite
      center
      zIndexRange={[5, 0]}
      position={[position[0], position[1] + offsetY, position[2]]}
    >
      <div
        className={`cursor-pointer rounded px-2 py-0.5 font-mono text-2xl font-bold whitespace-nowrap drop-shadow-lg ${alarmSeverity ? ALARM_LABEL_CLASS[alarmSeverity] : 'bg-black/80 text-white'}`}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onPointerEnter={(event) => {
          event.stopPropagation();
          onHoverStart?.(id, event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          event.stopPropagation();
          onHoverMove?.(id, event.clientX, event.clientY);
        }}
        onPointerLeave={(event) => {
          event.stopPropagation();
          onHoverEnd?.(id);
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.(id);
        }}
      >
        {equipName}
      </div>
    </Html>
  );
}

export { type AlarmHighlightSeverity };
