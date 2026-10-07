import { FileX, Link2, Link2Off, Loader2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAssetPreviewMode,
  type AssetRecord,
  type AssetStats,
  type AssetVersion,
} from '@crane/domain/asset-library';
import {
  createPlaybackClock,
  createViewerCameraSync,
  useAssetFileUrl,
  type PlaybackClock,
  type ViewerCameraSync,
} from '@crane/features/asset-library';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from '@crane/ui/molecules/select';
import type { ViewerDisplay } from '../lib/viewer-display-state';
import { useViewerDisplay } from '../model/use-viewer-display';
import { AssetDrawingViewer } from './asset-drawing-viewer';
import { AssetEnvironmentViewer } from './asset-environment-viewer';
import { AssetModelViewer } from './asset-model-viewer';

interface ComparePaneProps {
  version: AssetVersion;
  /** 기준 쪽인가. 기준 쪽이 조작 도구를 들고 양쪽 표시를 함께 바꾼다. */
  base: boolean;
  display: ViewerDisplay;
  onDisplayChange: (patch: Partial<ViewerDisplay>) => void;
  cameraSync: ViewerCameraSync | null;
  /** 양쪽이 같이 읽는 애니메이션 시계. 기준 쪽이 민다. */
  playbackClock: PlaybackClock;
  onMeasured: (version: number, stats: AssetStats) => void;
}

function ComparePane({
  version,
  base,
  display,
  onDisplayChange,
  cameraSync,
  playbackClock,
  onMeasured,
}: ComparePaneProps) {
  const { t } = useTranslation();
  const file = useAssetFileUrl(version.file.ref);
  const mode = getAssetPreviewMode(version.file.format);
  const label = (
    <span
      className={cn(
        'font-condensed rounded-md px-2 py-1 text-sm leading-none font-semibold tabular-nums shadow-sm',
        base
          ? 'bg-black/55 text-white backdrop-blur-md'
          : 'bg-(--hanwha-orange-100) text-white',
      )}
    >
      v{version.version}
      <span className="ml-1.5 text-xs font-medium opacity-80">
        {t(
          base ? 'asset-library:compare.base' : 'asset-library:compare.target',
        )}
      </span>
    </span>
  );

  return (
    <div className="relative min-h-0 min-w-0 flex-1">
      {file.status === 'loading' ? (
        <div className="text-muted-foreground flex h-full items-center justify-center">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : file.status === 'missing' ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
          <FileX className="text-muted-foreground size-6" />
          <p className="text-foreground text-sm font-medium">
            {t('asset-library:detail.fileMissing')}
          </p>
        </div>
      ) : mode === 'model' ? (
        <AssetModelViewer
          url={file.url}
          toolbar={base ? 'full' : 'none'}
          display={display}
          onDisplayChange={onDisplayChange}
          cameraSync={
            cameraSync
              ? { bus: cameraSync, id: base ? 'base' : 'target' }
              : undefined
          }
          playbackSync={{ clock: playbackClock, drive: base }}
          cornerLabel={label}
          onLoaded={({ stats }) => onMeasured(version.version, stats)}
        />
      ) : mode === 'environment' ? (
        <AssetEnvironmentViewer url={file.url} cornerLabel={label} />
      ) : (
        <>
          <AssetDrawingViewer
            url={file.url}
            mode={mode}
            fileName={version.file.fileName}
          />
          <div className="pointer-events-none absolute bottom-3 left-3 z-10">
            {label}
          </div>
        </>
      )}
    </div>
  );
}

interface AssetCompareViewProps {
  asset: AssetRecord;
  /** 상세 화면이 보고 있는 버전. */
  viewed: AssetVersion;
  /** 나란히 놓을 다른 버전. */
  other: AssetVersion;
  onChangeOther: (version: number) => void;
  onClose: () => void;
  onMeasured: (version: number, stats: AssetStats) => void;
}

/**
 * 두 버전 나란히 보기. 어느 쪽을 보고 있었든 왼쪽이 옛 버전(기준), 오른쪽이
 * 새 버전(변경)이다 — "무엇이 달라졌나" 는 늘 옛것에서 새것으로 읽는다.
 * 표시 방식은 한 벌을 양쪽이 같이 쓰고, 카메라는 맞물려 한쪽을 돌리면 다른 쪽도 같은
 * 구도로 따라온다 — 맞물림은 끌 수 있다. 애니메이션은 같은 클립을 같은 시각으로
 * 양쪽이 돈다(기준 쪽이 시계를 밀고 변경 쪽은 읽는다) — 카메라 맞물림을 꺼도
 * 그대로다.
 */
export function AssetCompareView({
  asset,
  viewed,
  other,
  onChangeOther,
  onClose,
  onMeasured,
}: AssetCompareViewProps) {
  const [base, target] =
    viewed.version < other.version ? [viewed, other] : [other, viewed];
  const { t } = useTranslation();
  const { display, setDisplay } = useViewerDisplay();
  const [linked, setLinked] = useState(true);
  const bus = useMemo(() => createViewerCameraSync(), []);
  const playbackClock = useMemo(() => createPlaybackClock(), []);
  const candidates = asset.versions
    .filter((item) => item.version !== viewed.version)
    .sort((a, b) => b.version - a.version);

  // 맞물린 채 자동 회전을 양쪽에서 돌리면 서로 자세를 주고받으며 겹친다 —
  // 기준 쪽만 돌리고 다른 쪽은 따라오게 한다.
  const followerDisplay = linked ? { ...display, turntable: false } : display;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
        <span className="text-foreground text-[13px] font-semibold">
          {t('asset-library:compare.title')}
        </span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {t('asset-library:compare.viewedLabel', { version: viewed.version })}
        </span>
        <Select
          value={String(other.version)}
          onValueChange={(value) => onChangeOther(Number(value))}
        >
          <SelectTrigger
            aria-label={t('asset-library:compare.chooseOther')}
            label={t('asset-library:compare.otherLabel', {
              version: other.version,
            })}
            className="h-7"
          />
          <SelectPopup>
            {candidates.map((item) => (
              <SelectItem key={item.version} value={String(item.version)}>
                v{item.version}
                {item.version === asset.currentVersion
                  ? ` (${t('asset-library:versions.current')})`
                  : ''}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant={linked ? 'secondary' : 'ghost'}
            size="xs"
            aria-pressed={linked}
            onClick={() => setLinked((current) => !current)}
          >
            {linked ? <Link2 /> : <Link2Off />}
            {t('asset-library:compare.linkCamera')}
          </Button>
          <Button variant="ghost" size="xs" onClick={onClose}>
            <X />
            {t('asset-library:compare.close')}
          </Button>
        </div>
      </div>
      <div className="divide-border flex min-h-0 flex-1 flex-col divide-y md:flex-row md:divide-x md:divide-y-0">
        <ComparePane
          version={base}
          base
          display={display}
          onDisplayChange={setDisplay}
          cameraSync={linked ? bus : null}
          playbackClock={playbackClock}
          onMeasured={onMeasured}
        />
        <ComparePane
          version={target}
          base={false}
          display={followerDisplay}
          onDisplayChange={setDisplay}
          cameraSync={linked ? bus : null}
          playbackClock={playbackClock}
          onMeasured={onMeasured}
        />
      </div>
    </div>
  );
}
