import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';

interface AlarmFullscreenToggleButtonProps {
  active: boolean;
  alarmCount: number;
  onToggle: () => void;
}

export function AlarmFullscreenToggleButton({
  active,
  alarmCount,
  onToggle,
}: AlarmFullscreenToggleButtonProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const isKorean = language.toLowerCase().startsWith('ko');

  const label = active
    ? t('common:viewer3d.alarmOverlayHide', {
        defaultValue: isKorean ? '알람 숨기기' : 'Hide alarms',
      })
    : t('common:viewer3d.alarmOverlayShow', {
        defaultValue: isKorean ? '알람 표시' : 'Show alarms',
      });

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            className={cn(
              'relative border-border/70 shadow-sm backdrop-blur-sm',
              active
                ? 'bg-orange-500/20 text-orange-600 dark:text-orange-300'
                : 'bg-background/85',
            )}
            aria-label={label}
            aria-pressed={active}
          />
        }
        onClick={onToggle}
      >
        <Bell />
        {alarmCount > 0 ? (
          <span
            className="bg-red-500 text-[10px] font-semibold leading-none text-white absolute -top-1 -right-1 inline-flex min-w-4 h-4 items-center justify-center rounded-full px-1"
            aria-hidden="true"
          >
            {alarmCount > 99 ? '99+' : alarmCount}
          </span>
        ) : null}
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}
