import { ArrowUpRight, X } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitoring3dView } from '@/features/3d';
import { useProgressNavigate } from '@/shared/lib/use-progress-navigate';
import { Button } from '@/shared/ui/atoms/button';

interface DashboardRegionPreviewModalProps {
  open: boolean;
  regionId: string;
  title: string;
  navigateTo: string;
  onClose: () => void;
}

export function DashboardRegionPreviewModal({
  open,
  regionId,
  title,
  navigateTo,
  onClose,
}: DashboardRegionPreviewModalProps) {
  const { t } = useTranslation();
  const navigate = useProgressNavigate();

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/76 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[10%] left-[14%] h-40 w-40 rounded-full bg-cyan-400/14 blur-3xl" />
        <div className="absolute right-[12%] bottom-[16%] h-56 w-56 rounded-full bg-orange-400/12 blur-3xl" />
      </div>
      <div
        className="border-border/70 bg-background/96 relative flex h-[min(82vh,900px)] w-[min(90vw,1320px)] min-w-0 flex-col overflow-hidden rounded-[1.75rem] border shadow-[0_28px_120px_rgba(2,6,23,0.55)]"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="from-background via-background/96 to-background/88 border-border/60 relative flex items-center justify-between gap-4 border-b bg-gradient-to-r px-5 py-4 md:px-6">
          <div className="min-w-0 space-y-2">
            <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.22em] uppercase">
              {t('dashboard:preview.label')}
            </p>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold tracking-tight md:text-xl">
                {title}
              </h3>
              <span className="border-border/60 bg-muted/45 text-muted-foreground inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase">
                {regionId}
              </span>
              <span className="border-emerald-500/25 bg-emerald-500/10 text-emerald-300 inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase">
                Preview
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="border-border/65 bg-background/72 hover:bg-muted/80 cursor-pointer rounded-full backdrop-blur-sm"
              aria-label={t('dashboard:preview.openFull')}
              onClick={() => {
                onClose();
                navigate(navigateTo);
              }}
            >
              <ArrowUpRight />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="border-border/65 bg-background/72 hover:bg-muted/80 cursor-pointer rounded-full backdrop-blur-sm"
              aria-label={t('dashboard:preview.close')}
              onClick={onClose}
            >
              <X />
            </Button>
          </div>
        </div>
        <div className="from-background via-background/98 to-muted/20 min-h-0 flex-1 bg-gradient-to-b p-3 md:p-4">
          <div className="border-border/60 relative h-full overflow-hidden rounded-[1.35rem] border bg-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-slate-950/35 to-transparent" />
            <div className="pointer-events-none absolute top-4 left-4 z-10 flex items-center gap-2">
              <span className="bg-background/72 text-foreground rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase backdrop-blur-sm">
                3D Viewer
              </span>
              <span className="bg-background/58 text-muted-foreground rounded-full px-2.5 py-1 text-[10px] font-medium backdrop-blur-sm">
                {title}
              </span>
            </div>
            <Monitoring3dView regionId={regionId} />
          </div>
        </div>
      </div>
    </div>
  );
}
