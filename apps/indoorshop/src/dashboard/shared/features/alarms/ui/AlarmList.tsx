import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { Alarm } from '../../../entities/alarm/model/types'
import { AlarmItem } from './AlarmItem'

interface AlarmListProps {
  alarms: Alarm[]
  onOpen: (alarm: Alarm) => void
  onDismiss: (id: string) => void
  /** 필터에 걸려 하나도 안 남았을 때의 문구 */
  emptyMessage?: string
}

export function AlarmList({
  alarms,
  onOpen,
  onDismiss,
  emptyMessage,
}: AlarmListProps) {
  const { t } = useTranslation()
  if (alarms.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
        <p className="text-inshop-sm font-medium text-foreground/68">{emptyMessage ?? t('alarms.empty')}</p>
        <p className="text-inshop-xs text-foreground/50">{t('alarms.emptyHint')}</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-0.5 p-1.5">
      {alarms.map((alarm) => (
        <AlarmItem key={alarm.id} alarm={alarm} onOpen={onOpen} onDismiss={onDismiss} />
      ))}
    </ul>
  )
}
