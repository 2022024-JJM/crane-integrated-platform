import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { InshopKey } from '../../../lib/i18n/keys'
import { cn } from '../../../lib/utils'
import { Card } from '../../../ui/atoms/Card'
import { PinIcon } from '../../../ui/icons'
import { fetchEventDetail } from '../api/performanceApi'
import type {
  AsmEventKind,
  PntEventKind,
  CollectionEvent,
  EventDetail,
  EventInstant,
  StageStatus,
} from '../model/types'

const STATUS_KEY: Record<StageStatus, InshopKey> = {
  done: 'performance.status.done',
  inProgress: 'performance.status.inProgress',
  notDue: 'performance.status.notDue',
  excluded: 'performance.status.excluded',
}

const STATUS_CLASS: Record<StageStatus, string> = {
  done: 'bg-status-healthy/10 text-status-healthy',
  inProgress: 'bg-accent/10 text-accent',
  notDue: 'bg-surface-secondary text-foreground/55',
  excluded: 'bg-surface-secondary text-foreground/45',
}

const KIND_KEY: Record<AsmEventKind | PntEventKind, InshopKey> = {
  woStart: 'performance.grid.kind.woStart',
  woDone: 'performance.grid.kind.woDone',
  btsIn: 'performance.grid.kind.btsIn',
  btsOut: 'performance.grid.kind.btsOut',
  stepStart: 'performance.grid.kind.stepStart',
  stepDone: 'performance.grid.kind.stepDone',
}

/** 값 없음은 '—' (정의서 §6.1) — S1·S4·S5 는 일자만 오는 계약이라 시각을 붙이지 않는다 */
function instantText(instant: EventInstant | null): string {
  if (!instant) return '—'
  return instant.time ? `${instant.date.slice(5)} ${instant.time}` : instant.date.slice(5)
}

/**
 * 수집 현황 그리드(IPD-S01) + 하위 데이터 KV(IPD-S02).
 *
 * 행 클릭 → 오른쪽 패널에 그 행의 원천 항목·값. 적색은 '확인 필요'다(정의서 문구).
 */
export function EventsSection({
  events,
  pendingProcess,
  scopeKey,
}: {
  events: CollectionEvent[]
  /** 의장·도장 필터 — 아직 범위 밖이라 준비중 안내를 낸다 */
  pendingProcess: boolean
  /** 그리드 부제 — 현재 필터가 담는 이벤트 범위 (가공/조립/가공·조립) */
  scopeKey: InshopKey
}) {
  const { t } = useTranslation()
  /* 조립 'ASM'/도장 'PNT' 행의 단계 셀은 공정명 하나 — 하위 단계·스텝 이름은 옆의
     이벤트 종류 칩(W/O·BTS)과 관리번호·드릴다운이 말한다 */
  const stageCellOf = (event: CollectionEvent) =>
    event.stage === 'ASM'
      ? t('performance.asm.gridStage')
      : event.stage === 'PNT'
        ? t('performance.pnt.gridStage')
        : event.stage
  const [selected, setSelected] = useState<CollectionEvent | null>(null)
  const [detail, setDetail] = useState<EventDetail | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!selected) {
      setDetail(null)
      return
    }
    fetchEventDetail(selected).then((d) => {
      if (!cancelled) setDetail(d)
    })
    return () => {
      cancelled = true
    }
  }, [selected])

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="text-inshop-sm font-semibold">
            {t('performance.grid.title')}{' '}
            <span className="font-normal text-foreground/50">
              · {t(scopeKey)} · {t('performance.grid.rows', { count: events.length })}
            </span>
          </div>
          <div className="text-[11px] text-foreground/45">{t('performance.grid.legend')}</div>
        </div>

        {pendingProcess ? (
          <div className="px-4 py-10 text-center text-inshop-sm text-foreground/55">
            {t('performance.grid.pendingProcess')}
          </div>
        ) : events.length === 0 ? (
          <div className="px-4 py-10 text-center text-inshop-sm text-foreground/55">
            {t('performance.grid.empty')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-inshop-xs">
              <thead>
                <tr className="border-b border-border text-[11px] text-foreground/55">
                  <th className="px-4 py-2 font-medium">{t('performance.grid.block')}</th>
                  <th className="px-2 py-2 font-medium">{t('performance.grid.stage')}</th>
                  <th className="px-2 py-2 font-medium">{t('performance.grid.mgmtNo')}</th>
                  <th className="px-2 py-2 font-medium">{t('performance.grid.occurred')}</th>
                  <th className="px-2 py-2 font-medium">{t('performance.grid.completed')}</th>
                  <th className="px-2 py-2 font-medium">{t('performance.grid.status')}</th>
                  <th className="px-2 py-2 font-medium">{t('performance.grid.source')}</th>
                  <th className="px-4 py-2" aria-label={t('performance.grid.viewBay')} />
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr
                    key={event.id}
                    onClick={() => setSelected(event)}
                    className={cn(
                      'cursor-pointer border-b border-border/60 transition-colors hover:bg-surface-secondary/40',
                      selected?.id === event.id && 'bg-accent/8'
                    )}
                  >
                    <td className="px-4 py-2 tabular-nums">{event.blockNo}</td>
                    <td className="px-2 py-2 font-medium">
                      {stageCellOf(event)}
                      {event.kind && (
                        <div className="text-[10px] font-normal text-foreground/50">
                          {t(KIND_KEY[event.kind])}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 tabular-nums">
                      <span className="mr-1 rounded bg-surface-secondary px-1 py-px text-[10px] text-foreground/55">
                        {event.mgmtNoType}
                      </span>
                      {event.mgmtNo}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-foreground/70">
                      {instantText(event.occurred)}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-foreground/70">
                      {instantText(event.completed)}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[11px] font-medium',
                          STATUS_CLASS[event.status]
                        )}
                      >
                        {t(STATUS_KEY[event.status])}
                      </span>
                      {event.flagged && (
                        <span className="ml-1 rounded bg-status-unhealthy/10 px-1.5 py-0.5 text-[11px] font-medium text-status-unhealthy">
                          {t('performance.grid.flagged')}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-foreground/60">{event.sources}</td>
                    <td className="px-4 py-2">
                      {event.mapShop && (
                        // 진입점 B — 공정 맵 딥링크(조립/도장). ⚠️ bay 파라미터 미지원이라 공장 포커스까지
                        <Link
                          to={`/indoorshop/zones/${event.mapShopProcess === 'painting' ? 'painting' : 'assembly'}?shop=${encodeURIComponent(event.mapShop)}`}
                          onClick={(e) => e.stopPropagation()}
                          title={t('performance.grid.viewBayTitle', { shop: event.mapShop })}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-inshop-md border border-border px-1.5 py-0.5 text-[10px] text-foreground/60 transition-colors hover:border-accent/50 hover:text-accent"
                        >
                          <PinIcon size={11} />
                          {event.mapShopProcess === 'painting'
                            ? t('performance.grid.viewShop')
                            : t('performance.grid.viewBay')}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="h-fit p-4">
        <div className="text-inshop-sm font-semibold">
          {t('performance.detail.title')}
          {selected && <span className="ml-1 font-normal text-foreground/55">— {selected.mgmtNo}</span>}
        </div>
        {detail ? (
          <>
            <div className="mt-1 text-[11px] text-foreground/50">
              {t('performance.detail.unit')}: {detail.unit}
            </div>
            <table className="mt-3 w-full text-inshop-xs">
              <tbody>
                {detail.entries.map((entry) => (
                  <tr key={entry.label} className="border-b border-border/60 last:border-0">
                    <td className="py-1.5 pr-2 text-foreground/55">{entry.label}</td>
                    <td className="py-1.5 text-right tabular-nums">{entry.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <div className="mt-3 text-inshop-xs text-foreground/45">{t('performance.detail.hint')}</div>
        )}
      </Card>
    </div>
  )
}
