import { useMemo, useState } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import type { InshopKey } from '../../../shared/lib/i18n/keys'
import type { Location } from '../../../shared/entities/location/model/types'
import type { LidarSensor, LidarSensorStatus } from '../../../shared/features/bay-viewer/model/lidarSensor'
import type { LidarBlockInfo } from '../../../shared/features/bay-viewer/model/lidarBlock'
import { formatDetectionId } from '../../../shared/features/bay-viewer/model/lidarBlock'
import {
  worstSensorStatus,
  sensorStatusCounts,
  bayWorkState,
  bayStage,
  type BayWorkState,
  type SensorStatusCounts,
} from '../../../shared/features/bay-viewer/lib/bayStatusSummary'
import {
  bayPassesFilter,
  isAbnormalBay,
  isFilterActive,
  DEFAULT_BAY_FILTER,
  type BayFilter,
} from '../lib/bayFilters'
import { latestScan, type LatestScan } from '../../../shared/features/bay-viewer/lib/freshness'
import { useAxisNow } from '../../../shared/lib/useBaseDate'
import { cn } from '../../../shared/lib/utils'

/*
 * 공장 뷰 상세 카드 (PRD FR-8) + 정반 선택 목록 · 필터 · 범례 (FR-9).
 *
 * 맵과 이 패널은 같은 selectedBayId 를 본다 — 어느 쪽에서 고르든 즉시 동기화된다(§5).
 * 카드의 정보 위계는 PRD 순서 그대로다: 헤더 → 핵심 요약 → LiDAR 요약 → 펼침 → 액션.
 * heartbeat·오류 코드·진단값(스캔율·온도·RSSI·FOV)은 §7.1 계약 연동(FR-1) 전이라
 * 추정하지 않고, 연동 대기임을 한 줄로만 알린다 (값 없는 항목 축약 원칙).
 */

export interface BayPanelBay {
  location: Location
  sensors: LidarSensor[]
  blocks: LidarBlockInfo[]
}

interface BayDetailPanelProps {
  bays: BayPanelBay[]
  selectedBayId: string | null
  highlightedBayId: string | null
  filter: BayFilter
  onFilterChange: (next: BayFilter) => void
  /** 목록 행 클릭 — null 은 선택 해제 */
  onSelectBay: (locationId: string | null) => void
  onHoverBay: (locationId: string | null) => void
  /** `정반 화면 이동` 액션 */
  onOpenBay: (locationId: string) => void
  /** `선택 정반 맞춤` 액션 — 카메라만 다시 맞춘다 */
  onFitBay: () => void
  className?: string
}

/** 대표 상태 → 점·글자색·문구. 색만으로 전하지 않는다 — 상태 텍스트가 항상 붙는다 (FR-1) */
const STATUS_META: Record<
  LidarSensorStatus | 'noData',
  { dot: string; ink: string; labelKey: InshopKey }
> = {
  online: { dot: 'bg-status-healthy', ink: 'text-status-healthy', labelKey: 'sensors.status.online' },
  offline: { dot: 'bg-foreground/25', ink: 'text-foreground/54', labelKey: 'sensors.status.offline' },
  error: { dot: 'bg-status-unhealthy', ink: 'text-status-unhealthy', labelKey: 'sensors.status.error' },
  calibrating: {
    dot: 'bg-sky-500 animate-pulse motion-reduce:animate-none',
    ink: 'text-sky-600 dark:text-sky-300',
    labelKey: 'sensors.status.calibrating',
  },
  noData: {
    dot: 'border border-foreground/40 bg-transparent',
    ink: 'text-foreground/54',
    labelKey: 'viewer.bayStatus.noData',
  },
}

/** 이상 우선 정렬 키 — 오류가 맨 위, 정상이 맨 아래 (FR-8: 이상 장비를 위에) */
const SENSOR_ORDER: Record<LidarSensorStatus, number> = {
  error: 0,
  offline: 1,
  calibrating: 2,
  online: 3,
}

function compareSensors(a: LidarSensor, b: LidarSensor): number {
  const byStatus = SENSOR_ORDER[a.status] - SENSOR_ORDER[b.status]
  if (byStatus !== 0) return byStatus
  const aHeartbeat = a.lastHeartbeatAt ?? ''
  const bHeartbeat = b.lastHeartbeatAt ?? ''
  return bHeartbeat.localeCompare(aHeartbeat)
}

interface BaySummary {
  id: string
  location: Location
  sensors: LidarSensor[]
  blocks: LidarBlockInfo[]
  sensorStatus: LidarSensorStatus | null
  counts: SensorStatusCounts
  workState: BayWorkState
  stage: string | null
  latest: LatestScan | null
  passesFilter: boolean
}

const FILTER_CHIP_CLASS =
  'flex h-7 items-center rounded-inshop-md border px-2 text-2xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function BayDetailPanel({
  bays,
  selectedBayId,
  highlightedBayId,
  filter,
  onFilterChange,
  onSelectBay,
  onHoverBay,
  onOpenBay,
  onFitBay,
  className,
}: BayDetailPanelProps) {
  const { t } = useTranslation()
  // 경과 표기가 굳지 않도록 30초마다 다시 계산한다
  const now = useAxisNow(30000)
  /** 펼침 영역 (FR-8 §4) — 기본은 접혀 있고, 정반을 바꿔도 펼침 상태는 유지한다 */
  const [devicesOpen, setDevicesOpen] = useState(false)

  const summaries = useMemo<BaySummary[]>(
    () =>
      bays.map((bay) => {
        const sensorStatus = worstSensorStatus(bay.sensors)
        const workState = bayWorkState(bay.sensors, bay.blocks)
        const stage = bayStage(bay.blocks)
        return {
          id: bay.location.id,
          location: bay.location,
          sensors: bay.sensors,
          blocks: bay.blocks,
          sensorStatus,
          counts: sensorStatusCounts(bay.sensors),
          workState,
          stage,
          latest: latestScan(bay.sensors, now),
          passesFilter: bayPassesFilter({ sensorStatus, workState, stage }, filter),
        }
      }),
    [bays, filter, now]
  )

  /** 공정 단계 필터 선택지 — 지금 화면에 실제로 있는 stage 만 낸다 (FR-9 범례와 같은 원칙) */
  const stages = useMemo(
    () => [...new Set(summaries.map((s) => s.stage).filter((s): s is string => s !== null))].sort(),
    [summaries]
  )

  /** 범례 — 현재 화면에서 사용 중인 상태만 표시한다 (FR-9) */
  const statusesInUse = useMemo(() => {
    const used = new Set<LidarSensorStatus | 'noData'>()
    for (const s of summaries) used.add(s.sensorStatus ?? 'noData')
    return (['error', 'offline', 'calibrating', 'noData', 'online'] as const).filter((key) => used.has(key))
  }, [summaries])

  const visible = summaries.filter((s) => s.passesFilter)
  const hiddenCount = summaries.length - visible.length
  const selected = selectedBayId ? summaries.find((s) => s.id === selectedBayId) : undefined

  const workText = (s: BaySummary) =>
    s.workState === 'working'
      ? t('viewer.bayStatus.working', { count: s.blocks.length })
      : s.workState === 'idle'
        ? t('viewer.bayStatus.idle')
        : t('viewer.bayStatus.noData')

  return (
    <div className={cn('flex min-w-0 flex-col gap-3', className)}>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h2 className="text-inshop-base font-semibold text-foreground">{t('assembly.bayPanel.title')}</h2>

        {/* 필터 (FR-9) — 걸린 정반은 맵에서 가라앉고 이 목록에서는 접힌다 */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-pressed={filter.abnormalOnly}
            onClick={() => onFilterChange({ ...filter, abnormalOnly: !filter.abnormalOnly })}
            className={cn(
              FILTER_CHIP_CLASS,
              filter.abnormalOnly
                ? 'border-status-unhealthy/60 bg-status-unhealthy/10 text-status-unhealthy'
                : 'border-border text-foreground/68 hover:border-accent/50 hover:text-foreground'
            )}
          >
            {t('assembly.bayPanel.filterAbnormal')}
          </button>
          <button
            type="button"
            aria-pressed={filter.hideUnoccupied}
            onClick={() => onFilterChange({ ...filter, hideUnoccupied: !filter.hideUnoccupied })}
            className={cn(
              FILTER_CHIP_CLASS,
              filter.hideUnoccupied
                ? 'border-accent/60 bg-accent/10 text-accent'
                : 'border-border text-foreground/68 hover:border-accent/50 hover:text-foreground'
            )}
          >
            {t('assembly.bayPanel.filterHideIdle')}
          </button>
          {stages.length > 1 && (
            <select
              value={filter.stage ?? ''}
              aria-label={t('assembly.bayPanel.filterStage')}
              onChange={(event) =>
                onFilterChange({ ...filter, stage: event.target.value || null })
              }
              className={cn(
                'h-7 rounded-inshop-md border border-border bg-surface px-1.5 font-mono text-2xs text-foreground/80',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                filter.stage !== null && 'border-accent/60 text-accent'
              )}
            >
              <option value="">{t('assembly.bayPanel.filterStageAll')}</option>
              {stages.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="min-w-0 space-y-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
        {/*
          정반 선택 목록 — 3D 라벨과 같은 선택을 카드 쪽에서도 제공한다 (FR-8 동기화).
          행 순서는 배치 데이터 순서 그대로다 — 탭·3D 와 같은 순서라야 손이 헤매지 않는다.
        */}
        <ul className="space-y-1" aria-label={t('assembly.bayPanel.selectorLabel')}>
          {visible.map((s) => {
            const meta = STATUS_META[s.sensorStatus ?? 'noData']
            const isSelected = s.id === selectedBayId
            const failing = isAbnormalBay(s.sensorStatus)
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectBay(isSelected ? null : s.id)}
                  onMouseEnter={() => onHoverBay(s.id)}
                  onMouseLeave={() => onHoverBay(null)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-inshop-md border px-2.5 py-1.5 text-left transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    isSelected
                      ? 'border-accent bg-accent/10'
                      : s.id === highlightedBayId
                        ? 'border-accent/50 bg-surface-secondary'
                        : 'border-border bg-surface hover:border-accent/40 hover:bg-surface-secondary',
                    !isSelected && failing && s.sensorStatus === 'error' && 'border-status-unhealthy/50'
                  )}
                >
                  <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', meta.dot)} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1.5">
                      <span className="truncate text-inshop-xs font-semibold text-foreground">
                        {s.location.name}
                      </span>
                      <span className="font-mono text-2xs tabular-nums text-foreground/54">
                        {s.location.workCntr}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-2xs">
                      <span className={cn('font-medium', meta.ink)}>{t(meta.labelKey)}</span>
                      <span aria-hidden="true" className="text-foreground/30">·</span>
                      <span className="tabular-nums text-foreground/68">{workText(s)}</span>
                      {s.stage && (
                        <span className="rounded bg-surface-secondary px-1 font-mono text-2xs text-foreground/68">
                          {s.stage}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {/* 필터가 조용히 줄인 것은 조용히 넘어가지 않는다 — 몇 면이 접혔는지 말한다 */}
        {hiddenCount > 0 && (
          <p className="flex items-center justify-between gap-2 text-2xs text-foreground/54">
            {t('assembly.bayPanel.hiddenByFilter', { count: hiddenCount })}
            <button
              type="button"
              onClick={() => onFilterChange(DEFAULT_BAY_FILTER)}
              className="text-accent underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t('assembly.bayPanel.clearFilter')}
            </button>
          </p>
        )}
        {isFilterActive(filter) && visible.length === 0 && (
          <p className="text-2xs text-foreground/54">{t('assembly.bayPanel.noneMatch')}</p>
        )}

        {/* ── 상세 카드 (FR-8) ── */}
        {selected ? (
          <section
            aria-label={t('assembly.bayPanel.cardLabel', { name: selected.location.name })}
            className="rounded-inshop-lg border border-border bg-surface"
          >
            {/* 1. 헤더 — 베이명 · 대표 상태 · 마지막 갱신 시각 */}
            <header className="border-b border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    STATUS_META[selected.sensorStatus ?? 'noData'].dot
                  )}
                />
                <h3 className="min-w-0 flex-1 truncate text-inshop-sm font-semibold text-foreground">
                  {selected.location.name}
                  <span className="ml-1.5 font-mono text-2xs font-normal tabular-nums text-foreground/54">
                    {selected.location.workCntr}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => onSelectBay(null)}
                  aria-label={t('assembly.bayPanel.deselect')}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-inshop-md text-foreground/54 transition-colors hover:bg-surface-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3">
                    <path d="m3 3 6 6M9 3l-6 6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <p className="mt-0.5 flex items-center gap-1 pl-4 text-2xs">
                <span className={cn('font-medium', STATUS_META[selected.sensorStatus ?? 'noData'].ink)}>
                  {t(STATUS_META[selected.sensorStatus ?? 'noData'].labelKey)}
                </span>
                <span aria-hidden="true" className="text-foreground/30">·</span>
                <span className="tabular-nums text-foreground/63">
                  {selected.latest
                    ? t('assembly.bayPanel.lastUpdate', { time: selected.latest.time })
                    : t('assembly.bayPanel.lastUpdateNone')}
                </span>
              </p>
            </header>

            {/* 2. 핵심 요약 — 현재 공정 · 진행 상태 · 블록 식별값 */}
            <dl className="space-y-1.5 border-b border-border px-3 py-2 text-2xs">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-foreground/54">{t('assembly.bayPanel.stage')}</dt>
                <dd className="font-mono text-foreground/85">
                  {selected.stage ?? t('common.none')}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-foreground/54">{t('assembly.bayPanel.workState')}</dt>
                <dd className="tabular-nums text-foreground/85">{workText(selected)}</dd>
              </div>
              {selected.blocks.length > 0 && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 text-foreground/54">{t('assembly.bayPanel.blocks')}</dt>
                  <dd className="flex min-w-0 flex-wrap justify-end gap-1">
                    {selected.blocks.map((block) => (
                      <span
                        key={block.id}
                        className={cn(
                          'rounded bg-surface-secondary px-1 font-mono tabular-nums',
                          block.cadRegistered ? 'text-foreground/80' : 'text-status-unhealthy'
                        )}
                        title={block.cadRegistered ? block.blockName : t('blocks.cadUnmatched')}
                      >
                        {block.cadRegistered ? formatDetectionId(block) : t('viewer.unidentified')}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>

            {/* 3. LiDAR 요약 — 상태별 대수 + 이상 장비 우선 목록 */}
            <div className="border-b border-border px-3 py-2">
              <p className="text-2xs text-foreground/68">
                {(['online', 'calibrating', 'offline', 'error'] as const)
                  .filter((status) => selected.counts[status] > 0)
                  .map((status) => `${t(STATUS_META[status].labelKey)} ${selected.counts[status]}`)
                  .join(' · ')}
              </p>
              {(() => {
                const abnormal = selected.sensors
                  .filter((sensor) => sensor.status !== 'online')
                  .sort(compareSensors)
                if (abnormal.length === 0) return null
                return (
                  <ul className="mt-1.5 space-y-1">
                    {abnormal.map((sensor) => (
                      <li
                        key={sensor.id}
                        className={cn(
                          'flex items-center gap-1.5 rounded-inshop-sm bg-surface-secondary px-1.5 py-1 text-2xs',
                          'ring-1 ring-inset',
                          sensor.status === 'error' ? 'ring-status-unhealthy/50' : 'ring-border'
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_META[sensor.status].dot)}
                        />
                        <span className="min-w-0 flex-1 truncate font-mono text-foreground/80">
                          {sensor.name}
                        </span>
                        <span className={cn('font-medium', STATUS_META[sensor.status].ink)}>
                          {t(STATUS_META[sensor.status].labelKey)}
                        </span>
                        <span className="font-mono tabular-nums text-foreground/54">
                          {sensor.lastScanAt}
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              })()}
            </div>

            {/* 4. 펼침 영역 — 장비 전체. 진단값은 계약 연동(FR-1) 전이라 추정하지 않는다 */}
            <div className="border-b border-border px-3 py-2">
              <button
                type="button"
                aria-expanded={devicesOpen}
                onClick={() => setDevicesOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-2 text-2xs font-medium text-foreground/68 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t('assembly.bayPanel.devicesToggle', { count: selected.sensors.length })}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 12 12"
                  className={cn('h-3 w-3 transition-transform', devicesOpen && 'rotate-180')}
                >
                  <path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {devicesOpen && (
                <>
                  {selected.sensors.length > 0 ? (
                    <ul className="mt-1.5 space-y-0.5">
                      {[...selected.sensors]
                        .sort(compareSensors)
                        .map((sensor) => (
                          <li
                            key={sensor.id}
                            className={cn(
                              'rounded-inshop-md border px-2 py-1.5 text-2xs',
                              sensor.status === 'error'
                                ? 'border-status-unhealthy/35 bg-status-unhealthy/5'
                                : 'border-border bg-surface-secondary/45'
                            )}
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                aria-hidden="true"
                                className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_META[sensor.status].dot)}
                              />
                              <span className="min-w-0 flex-1 truncate font-mono font-medium text-foreground/85">
                                {sensor.id}
                              </span>
                              <span className={cn('font-medium', STATUS_META[sensor.status].ink)}>
                                {t(STATUS_META[sensor.status].labelKey)}
                              </span>
                            </div>

                            <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-foreground/58">
                              <div className="col-span-2 flex min-w-0 items-baseline justify-between gap-2">
                                <dt>{t('assembly.bayPanel.heartbeat')}</dt>
                                <dd className="truncate font-mono tabular-nums text-foreground/76">
                                  {sensor.lastHeartbeatAt ?? '-'}
                                </dd>
                              </div>
                              {sensor.errorCode && (
                                <div className="col-span-2 flex min-w-0 items-baseline justify-between gap-2">
                                  <dt>{t('assembly.bayPanel.errorCode')}</dt>
                                  <dd className="truncate font-mono text-status-unhealthy">{sensor.errorCode}</dd>
                                </div>
                              )}
                              <div>
                                  <dt>{t('assembly.bayPanel.scanRate')}</dt>
                                  <dd className="font-mono tabular-nums text-foreground/80">
                                    {sensor.diagnostics?.scanRatePtsPerSec !== undefined
                                      ? `${sensor.diagnostics.scanRatePtsPerSec.toLocaleString()} pts/s`
                                      : '-'}
                                  </dd>
                                </div>
                              <div>
                                  <dt>{t('assembly.bayPanel.temperature')}</dt>
                                  <dd className="font-mono tabular-nums text-foreground/80">
                                    {sensor.diagnostics?.temperatureC !== undefined
                                      ? `${sensor.diagnostics.temperatureC} °C`
                                      : '-'}
                                  </dd>
                                </div>
                              <div>
                                  <dt>{t('assembly.bayPanel.rssi')}</dt>
                                  <dd className="font-mono tabular-nums text-foreground/80">
                                    {sensor.diagnostics?.rssiDbm !== undefined
                                      ? `${sensor.diagnostics.rssiDbm} dBm`
                                      : '-'}
                                  </dd>
                                </div>
                              <div>
                                  <dt>{t('assembly.bayPanel.fov')}</dt>
                                  <dd className="truncate font-mono text-foreground/80">
                                    {sensor.diagnostics?.fovMode || '-'}
                                  </dd>
                                </div>
                            </dl>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="mt-1.5 text-2xs text-foreground/54">{t('sensors.empty')}</p>
                  )}
                </>
              )}
            </div>

            {/* 5. 보조 액션 — 카드 전체를 클릭 대상으로 만들지 않는다 (중첩 클릭 방지) */}
            <div className="flex items-center gap-1.5 px-3 py-2">
              <button
                type="button"
                onClick={onFitBay}
                className="flex h-7 items-center rounded-inshop-md border border-border px-2.5 text-2xs font-medium text-foreground/75 transition-colors hover:border-accent/50 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t('viewer.fit.selected')}
              </button>
              <button
                type="button"
                onClick={() => onOpenBay(selected.id)}
                className="flex h-7 items-center gap-1 rounded-inshop-md bg-accent px-2.5 text-2xs font-medium text-on-accent transition-colors hover:bg-accent/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t('assembly.bayPanel.openBay')}
                <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3">
                  <path d="M2 6h6M5.5 2.8 8.8 6l-3.3 3.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </section>
        ) : (
          <p className="rounded-inshop-lg border border-dashed border-border px-3 py-4 text-center text-2xs text-foreground/54">
            {t('assembly.bayPanel.empty')}
          </p>
        )}

        {/* 범례 (FR-9) — 지금 화면에 실제로 쓰인 상태만 나열한다 */}
        {summaries.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-foreground/54">
          <span className="font-semibold uppercase tracking-wide">
            {t('assembly.bayPanel.legendTitle')}
          </span>
          {statusesInUse.map((key) => (
            <span key={key} className="flex items-center gap-1">
              <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', STATUS_META[key].dot)} />
              {t(STATUS_META[key].labelKey)}
            </span>
          ))}
        </div>
        )}
      </div>
    </div>
  )
}
