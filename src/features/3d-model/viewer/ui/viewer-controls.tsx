import { Button } from '@/shared/ui/atoms/button';
import {
  Gauge,
  Maximize2,
  Minimize2,
  Search,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface Props {
  isDetailView: boolean;
  isViewerFullscreen: boolean;
  onResetViewer: () => void;
  onToggleDetailView: () => void;
  onToggleFullscreen: () => void | Promise<void>;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function ViewerControls({
  isDetailView,
  isViewerFullscreen,
  onResetViewer,
  onToggleDetailView,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
}: Props) {
  return (
    <div className="absolute top-3 left-3 z-2 flex gap-2">
      <Button
        size={'sm'}
        variant={'secondary'}
        aria-label="기본 시점으로 이동"
        onClick={onResetViewer}
      >
        <Search />
      </Button>
      <Button
        size={'sm'}
        variant={'secondary'}
        aria-label="확대"
        onClick={onZoomIn}
      >
        <ZoomIn />
      </Button>
      <Button
        size={'sm'}
        variant={'secondary'}
        aria-label="축소"
        onClick={onZoomOut}
      >
        <ZoomOut />
      </Button>
      <Button
        size={'sm'}
        variant={'secondary'}
        aria-label={isDetailView ? '기본 보기' : '상세 보기'}
        onClick={onToggleDetailView}
      >
        <Gauge />
      </Button>
      <Button
        size={'sm'}
        variant={'secondary'}
        aria-label={isViewerFullscreen ? '전체화면 종료' : '전체화면'}
        onClick={() => {
          void onToggleFullscreen();
        }}
      >
        {isViewerFullscreen ? <Minimize2 /> : <Maximize2 />}
      </Button>
    </div>
  );
}
