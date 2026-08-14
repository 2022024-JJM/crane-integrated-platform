import { Download, Loader2, Save, Search } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@crane/ui/atoms/badge';
import { Button } from '@crane/ui/atoms/button';
import { Input } from '@crane/ui/atoms/input';
import { CardHeader } from '@crane/ui/molecules/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';

interface PaletteHeaderProps {
  objectSearch: string;
  onObjectSearchChange: (value: string) => void;
  placedObjectCount: number;
  onSave: () => void;
  onExport: () => void;
  saveDisabled: boolean;
  exportDisabled: boolean;
  isSaving: boolean;
}

export const PaletteHeader = memo(function PaletteHeader({
  objectSearch = '',
  onObjectSearchChange,
  placedObjectCount,
  onSave,
  onExport,
  saveDisabled,
  exportDisabled,
  isSaving,
}: PaletteHeaderProps) {
  const { t } = useTranslation();
  const controlClassName = 'h-6 rounded-sm';

  return (
    <CardHeader className="border-border border-b border-b-0 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <div
          className={`border-border bg-muted text-foreground focus-within:border-ring focus-within:ring-ring/50 ${controlClassName} flex min-w-0 flex-1 items-center border px-2 transition-colors focus-within:ring-3`}
        >
          <Search className="text-muted-foreground/50 mr-2 size-3 shrink-0" />
          <Input
            value={objectSearch}
            onChange={(event) => {
              onObjectSearchChange(event.target.value);
            }}
            placeholder={t('monitoring:editor.searchObjects')}
            className="placeholder:text-muted-foreground h-full flex-1 border-0 bg-transparent px-0 text-[11px] leading-none shadow-none focus:border-0 focus:ring-0"
          />
        </div>
        <div className="flex h-6 shrink-0 items-center">
          <Badge
            render={<div />}
            variant="outline"
            className={`border-border bg-muted text-muted-foreground ${controlClassName} flex min-w-6 items-center justify-center px-1.5 py-0 text-[9px] leading-none`}
          >
            {placedObjectCount}
          </Badge>
        </div>
        <TooltipProvider delay={150}>
          <div className="flex h-6 shrink-0 items-center gap-1">
            <div className="flex h-6 w-6 items-center justify-center">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      aria-label={t('monitoring:editor.save')}
                      disabled={saveDisabled || isSaving}
                      className={`border-border bg-muted text-foreground hover:bg-muted/80 ${controlClassName} size-6 p-0`}
                    />
                  }
                  onClick={onSave}
                >
                  {isSaving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                </TooltipTrigger>
                {/* 단축키를 툴팁에 노출한다 — 버튼만 있으면 Ctrl+S가 있는지
                    알 길이 없어 브라우저 저장 대화상자를 먼저 만나게 된다. */}
                <TooltipContent>
                  {t('monitoring:editor.save')} (Ctrl+S)
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex h-6 w-6 items-center justify-center">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      aria-label={t('monitoring:editor.exportJson')}
                      disabled={exportDisabled}
                      className={`border-border bg-muted text-foreground hover:bg-muted/80 ${controlClassName} size-6 p-0`}
                    />
                  }
                  onClick={onExport}
                >
                  <Download className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>
                  {t('monitoring:editor.exportJson')}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </div>
    </CardHeader>
  );
});
