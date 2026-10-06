import { useProgress } from '@react-three/drei';
import { Loader2 } from 'lucide-react';
import { Component, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';

/**
 * 자산 뷰어(3D 모델·배경 파노라마)가 같이 쓰는 조각 — 로드 오류 경계, 유리판
 * 위의 조작 버튼, 불러오는 중 표시.
 */

export class ViewerErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error('[asset-viewer] 파일을 불러오지 못했습니다.', error);
    this.props.onError();
  }

  render() {
    // Canvas 안이라 DOM 을 돌려줄 수 없다 — 안내는 바깥 오버레이가 맡는다.
    return this.state.failed ? null : this.props.children;
  }
}

/** 뷰어 위 조작 버튼 — 배경이 무엇이든 읽히는 어두운 유리판 위의 아이콘. */
export function ViewerIconButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-pressed={pressed}
            className={cn(
              'flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/70 [&_svg]:size-4',
              pressed
                ? 'bg-white text-zinc-900'
                : 'text-white/75 hover:bg-white/15 hover:text-white',
            )}
          />
        }
        onClick={onClick}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function ViewerLoadingOverlay({
  light,
  subject,
}: {
  light: boolean;
  /** 무엇을 불러오는 중인지. */
  subject: 'model' | 'environment';
}) {
  const { t } = useTranslation();
  const { active, progress } = useProgress();
  // 로더의 진행률은 앞 파일을 다 읽은 값으로 남아 있다 — 이 표시가 뜬 뒤에
  // 읽기가 시작되기 전까지는 0 으로 둔다(파일을 받기 전부터 뜰 수 있다).
  const [started, setStarted] = useState(false);
  if (active && !started) setStarted(true);
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2',
        light ? 'text-zinc-600' : 'text-white/80',
      )}
    >
      <Loader2 className="size-5 animate-spin" />
      <p className="text-xs tabular-nums">
        {t(
          subject === 'environment'
            ? 'asset-library:viewer.loadingEnvironment'
            : 'asset-library:viewer.loading',
          { percent: started ? Math.round(progress) : 0 },
        )}
      </p>
    </div>
  );
}
