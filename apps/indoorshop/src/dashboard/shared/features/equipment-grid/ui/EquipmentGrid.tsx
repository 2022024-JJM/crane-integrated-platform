import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import { nowMs } from '../../../lib/now'
import { Sparkline } from '../../../ui/atoms/Sparkline'
import { STATUS_SHAPE, lampStyle, type StatusMeaning } from '../../../ui/statusPalette'
import {
  EquipmentSymbolChip,
} from '../../../entities/equipment/ui/EquipmentSymbol'
import { arrangeCells, countCells, isIssueCell } from '../lib/sortCells'
import type {
  EquipmentCell,
  EquipmentGridDensity,
  EquipmentGridFilter,
  EquipmentLamp,
} from '../model/cell'

/*
 * ── 설비 그리드 — 세 공정이 공유하는 압축 셀 ──
 *
 * 근거: `.work/설비관제_레퍼런스.md` §3.2·§3.6. 요약 스트립(접힘 훑기)은 바깥이 그대로
 * 유지하고, **펼친 본문만** 세로 목록에서 그리드로 바꾼다(하이브리드 — 권고안).
 *
 * 셀은 세 요소다: 종류칩+ID / 램프 3 / 핵심 수치 1개(신선도). 나머지는 한 대를 골랐을
 * 때의 질문이라 펼침 상세로 내린다.
 *
 * 함께 가는 넷(§3.6) — 이 중 1·4가 빠지면 그리드 전환은 이득보다 손해다:
 *  1. **상태순 정렬** — 이상이 위로 (`lib/sortCells`)
 *  2. **이상만 보기** 필터
 *  3. **밀도 2단** — 좁은 패널은 압축, 넓은 화면은 상세
 *  4. **정상은 조용한 초록** — 램프 색은 `lampStyle(.., { dense })` 가 정한다. 정상은
 *     초록을 유지하되 소리를 낮추고(글로우·애니메이션 없음), 이상만 밝게 선다(R18)
 *
 * 접근성: 시각만 격자이고 의미는 목록이다 — `role="list"`/`listitem` 을 유지한다(§3.5).
 */

/**
 * 살아 있는 수치 한 칸 (R19).
 *
 * 세 가지를 함께 한다:
 *  · **흐른다** — `at`(마지막 수신 시각)이 있으면 경과를 1초마다 다시 적는다. 화면이 멈춰
 *    보이면 조작자는 "이 화면이 지금 것인가"를 먼저 의심하게 된다.
 *  · **깜빡인다** — 값이 바뀐 순간 짧게 밝아진다. 수백 칸 중 무엇이 방금 움직였는지는
 *    색이나 위치가 아니라 **변화 자체**로만 알 수 있다.
 *  · **침묵이 보인다** — 경과가 임계를 넘으면 그 자리가 '침묵'을 말한다. 값이 그대로인
 *    것과 값이 안 오는 것은 다른 사정인데, 마지막 값만 적으면 둘이 같아 보인다.
 */
const SILENT_AFTER_MS = 90_000
const FLASH_MS = 700

function LiveMetric({
  text,
  at,
  ink,
  silentLabel,
}: {
  text: string
  at?: number
  ink: string
  silentLabel: (seconds: number) => string
}) {
  const [now, setNow] = useState(nowMs)
  const [flash, setFlash] = useState(false)
  const previous = useRef(text)

  /* 경과가 흐르도록 1초 시계 — `at` 이 없는 셀은 시계를 켜지 않는다 */
  useEffect(() => {
    if (at === undefined) return
    const timer = window.setInterval(() => setNow(nowMs()), 1000)
    return () => window.clearInterval(timer)
  }, [at])

  useEffect(() => {
    if (previous.current === text) return
    previous.current = text
    setFlash(true)
    const timer = window.setTimeout(() => setFlash(false), FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [text])

  const elapsed = at === undefined ? null : Math.max(0, now - at)
  const silent = elapsed !== null && elapsed > SILENT_AFTER_MS

  return (
    <span
      data-flash={flash ? 'true' : 'false'}
      data-silent={silent ? 'true' : 'false'}
      className={cn(
        'shrink-0 font-mono text-[10px] tabular-nums transition-[color,opacity] duration-200',
        silent ? 'text-status-degraded' : ink,
        flash && 'opacity-100 brightness-150'
      )}
    >
      {silent && elapsed !== null ? silentLabel(Math.round(elapsed / 1000)) : text}
    </span>
  )
}

/** 램프 한 개 — 색과 **모양**을 함께 낸다(색 단독 금지) */
function Lamp({
  lamp,
  dense,
  glass,
}: {
  lamp: EquipmentLamp
  dense: boolean
  glass: boolean
}) {
  const { fill } = lampStyle(lamp.meaning, { dense, glass })
  const shape = STATUS_SHAPE[lamp.meaning]
  return (
    <span
      title={lamp.value ? `${lamp.label} · ${lamp.value}` : lamp.label}
      aria-label={lamp.value ? `${lamp.label} ${lamp.value}` : lamp.label}
      className={cn(
        'inline-block h-2 w-2 shrink-0',
        fill,
        shape === 'circle' && 'rounded-full',
        shape === 'square' && 'rounded-[1px]',
        shape === 'diamond' && 'rotate-45 rounded-[1px]',
        shape === 'triangle' && 'rounded-[1px]',
        shape === 'dash' && 'h-0.5 self-center rounded-full'
      )}
    />
  )
}

function CellBody({
  cell,
  dense,
  glass,
  selected,
  silentLabel,
}: {
  cell: EquipmentCell
  dense: boolean
  glass: boolean
  selected: boolean
  silentLabel: (seconds: number) => string
}) {
  const issue = isIssueCell(cell)
  const metric = lampStyle(cell.metric.meaning, { dense, glass })
  return (
    <>
      <div className="flex min-w-0 items-center gap-1.5">
        <EquipmentSymbolChip typeId={cell.typeId} size={14} dim={!issue && dense} />
        <span
          className={cn(
            'min-w-0 flex-1 truncate font-mono text-2xs font-semibold',
            glass ? 'text-glass-foreground/88' : 'text-foreground/85'
          )}
        >
          {cell.label}
        </span>
        {/* 핵심 수치 한 개 — 이상이면 이 자리가 사유가 된다("오프라인 19분") */}
        <LiveMetric
          text={cell.metric.text}
          at={cell.metric.at}
          ink={metric.ink}
          silentLabel={silentLabel}
        />
      </div>
      <div className="mt-1 flex items-center gap-1">
        {cell.lamps.map((lamp) => (
          <Lamp key={lamp.label} lamp={lamp} dense={dense} glass={glass} />
        ))}
        {cell.note && (
          <span
            className={cn(
              'ml-1 min-w-0 flex-1 truncate text-[10px]',
              glass ? 'text-glass-foreground/55' : 'text-foreground/55'
            )}
          >
            {cell.note}
          </span>
        )}
      </div>
      {/* 미니 트렌드는 기본 off — 이상 셀과 선택 셀에만 (§3.2) */}
      {cell.trend && cell.trend.length > 1 && (issue || selected) && (
        <div className={cn('mt-1', metric.ink)}>
          <Sparkline points={cell.trend} variant="line" width={72} height={14} ariaLabel={cell.label} />
        </div>
      )}
    </>
  )
}

export interface EquipmentGridProps {
  cells: readonly EquipmentCell[]
  /** 어두운 오버레이(지도 패널) 위인가 — 배색 램프가 갈린다 */
  tone?: 'surface' | 'glass'
  /** 초기 밀도. 좁은 패널은 `compact`, 넓은 화면은 `roomy` */
  density?: EquipmentGridDensity
  /** 필터·밀도 토글을 낼 것인가 (좁은 패널은 바깥에 이미 토글이 많다) */
  showControls?: boolean
  /**
   * 선택을 밖에서 쥘 때 — 지도처럼 **다른 층과 선택을 공유하는** 화면이 쓴다.
   * 주지 않으면 그리드가 스스로 들고 있는다(대부분의 목록).
   */
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  className?: string
}

/**
 * 설비 그리드.
 *
 * 선택은 이 컴포넌트가 들고 있다 — 펼침 상세는 "지금 보는 것" 이라 화면 상태가 아니라
 * 목록의 상태다. 밖에서 고를 필요가 생기면 그때 props 로 끌어올린다.
 */
export function EquipmentGrid({
  cells,
  tone = 'surface',
  density: initialDensity = 'compact',
  showControls = true,
  selectedId: controlledSelectedId,
  onSelect,
  className,
}: EquipmentGridProps) {
  const { t } = useTranslation()
  const glass = tone === 'glass'
  const [filter, setFilter] = useState<EquipmentGridFilter>('all')
  const [density, setDensity] = useState<EquipmentGridDensity>(initialDensity)
  const [ownSelectedId, setOwnSelectedId] = useState<string | null>(null)
  const controlled = controlledSelectedId !== undefined
  /*
   * 버드뷰에서 고른 설비가 화면 밖에 있으면 링킹이 아무 일도 안 한 것처럼 보인다 —
   * 밖에서 선택이 들어온 경우에만 그 칸을 시야로 데려온다(내부 클릭은 이미 보고 있다).
   */
  const selectedRef = useRef<HTMLLIElement | null>(null)
  const selectedId = controlled ? controlledSelectedId : ownSelectedId
  const select = (next: string | null) => {
    if (controlled) onSelect?.(next)
    else setOwnSelectedId(next)
  }

  /* 침묵 문구는 화면 어휘라 여기서 번역한다(LiveMetric 은 t() 를 모른다) */
  const silentLabel = (seconds: number) =>
    seconds < 120
      ? t('equipmentGrid.silentSeconds', { count: seconds })
      : t('equipmentGrid.silentMinutes', { count: Math.round(seconds / 60) })

  const counts = useMemo(() => countCells(cells), [cells])
  const shown = useMemo(() => arrangeCells(cells, filter), [cells, filter])

  useEffect(() => {
    if (!controlled || !controlledSelectedId) return
    selectedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [controlled, controlledSelectedId])
  const dense = density === 'compact'

  if (cells.length === 0) {
    return (
      <p
        className={cn(
          'px-2 py-3 text-2xs',
          glass ? 'text-glass-foreground/45' : 'text-foreground/45',
          className
        )}
      >
        {t('equipmentGrid.empty')}
      </p>
    )
  }

  return (
    /*
     * 열 수는 **뷰포트가 아니라 그릇**이 정한다(컨테이너 쿼리). 좁은 사이드 패널(280px)과
     * 넓은 공장 현황이 같은 컴포넌트를 쓰는데, 뷰포트 브레이크포인트로 열을 정하면 넓은
     * 화면의 좁은 패널이 4열이 되어 셀 안의 설비ID 가 잘린다(레퍼런스 §3.5 — 좁은 폭 1~2열).
     */
    <div className={cn('@container', className)}>
      {showControls && (
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          {/* 이상만 보기 — 337칸에서 붉은 칸만 남긴다 (§3.6-2) */}
          <button
            type="button"
            aria-pressed={filter === 'issues'}
            onClick={() => setFilter((current) => (current === 'issues' ? 'all' : 'issues'))}
            className={cn(
              'rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors focus:outline-none focus-visible:ring-2',
              filter === 'issues'
                ? 'border-status-unhealthy/50 bg-status-unhealthy/12 text-status-unhealthy'
                : glass
                  ? 'border-white/12 text-glass-foreground/55 hover:text-glass-foreground'
                  : 'border-border text-foreground/55 hover:text-foreground'
            )}
          >
            {t('equipmentGrid.onlyIssues', { count: counts.issues })}
          </button>
          {/* 밀도 2단 (§3.6-3) */}
          <button
            type="button"
            aria-pressed={density === 'roomy'}
            onClick={() => setDensity((current) => (current === 'compact' ? 'roomy' : 'compact'))}
            className={cn(
              'rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors focus:outline-none focus-visible:ring-2',
              glass
                ? 'border-white/12 text-glass-foreground/55 hover:text-glass-foreground'
                : 'border-border text-foreground/55 hover:text-foreground'
            )}
          >
            {t(density === 'compact' ? 'equipmentGrid.densityRoomy' : 'equipmentGrid.densityCompact')}
          </button>
          <span
            className={cn(
              'ml-auto font-mono text-[10px] tabular-nums',
              glass ? 'text-glass-foreground/45' : 'text-foreground/45'
            )}
          >
            {shown.length}/{counts.total}
          </span>
        </div>
      )}

      {shown.length === 0 ? (
        <p
          className={cn(
            'px-2 py-3 text-2xs',
            glass ? 'text-glass-foreground/45' : 'text-foreground/45'
          )}
        >
          {t('equipmentGrid.noIssues')}
        </p>
      ) : (
        /* 시각만 격자다 — 의미는 목록이라 role 을 지킨다(§3.5 접근성) */
        <ul
          role="list"
          className={cn(
            'grid gap-1',
            dense
              ? 'grid-cols-1 @[19rem]:grid-cols-2 @[30rem]:grid-cols-3 @[44rem]:grid-cols-4'
              : 'grid-cols-1 @[26rem]:grid-cols-2'
          )}
        >
          {shown.map((cell) => {
            const selected = cell.id === selectedId
            const issue = isIssueCell(cell)
            return (
              <li
                key={cell.id}
                role="listitem"
                ref={selected ? selectedRef : undefined}
                /*
                 * 붙어 있는 머리(현황 보드)가 있으면 그 높이만큼 비켜서 선다 — 없으면 0.
                 * 유틸리티 클래스가 아니라 인라인으로 두는 이유는, 이 값이 머리를 접었다
                 * 폈다 할 때마다 달라지는 **측정값**이라 빌드 타임에 정해질 수 없어서다.
                 */
                style={{ scrollMarginTop: 'var(--board-head, 0px)' }}
              >
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={cell.label}
                  onClick={() => select(selected ? null : cell.id)}
                  data-issue={issue ? 'true' : 'false'}
                  data-attenuated={!issue ? 'true' : 'false'}
                  className={cn(
                    'w-full rounded-inshop-md border px-1.5 py-1 text-left transition-colors focus:outline-none focus-visible:ring-2',
                    glass
                      ? 'border-white/10 hover:bg-white/[0.05]'
                      : 'border-border hover:bg-surface-secondary',
                    /* 이상만 테두리를 얻는다 — 눈이 갈 곳은 거기 하나면 된다 */
                    issue && 'border-status-unhealthy/45 bg-status-unhealthy/[0.06]',
                    /* 선택은 '이상' 이 아니라 '지금 보는 것' 이라 다른 축(강조 테두리) */
                    selected && 'ring-2 ring-accent',
                    /* 정상 칸은 한 걸음 물러난다 — 색은 그대로 두고 존재감만 낮춘다(R18) */
                    !issue && dense && 'opacity-[0.88]'
                  )}
                >
                  <CellBody
                    cell={cell}
                    dense={dense}
                    glass={glass}
                    selected={selected}
                    silentLabel={silentLabel}
                  />
                  {selected && cell.detail && (
                    <div
                      className={cn(
                        'mt-1.5 border-t pt-1.5',
                        glass ? 'border-white/10' : 'border-border'
                      )}
                    >
                      {cell.detail}
                    </div>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** 셀의 판정 — 램프 중 가장 나쁜 것을 접는다(공정이 따로 정하지 않을 때의 기본) */
export function worstMeaning(meanings: readonly StatusMeaning[]): StatusMeaning {
  const order: StatusMeaning[] = ['error', 'warning', 'inProgress', 'done', 'idle']
  for (const meaning of order) if (meanings.includes(meaning)) return meaning
  return 'idle'
}
