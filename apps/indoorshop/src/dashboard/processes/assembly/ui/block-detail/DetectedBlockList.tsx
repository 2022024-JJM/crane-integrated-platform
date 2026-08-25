import { useEffect, useRef } from 'react'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import type { LidarBlockInfo } from '../../model/lidarBlock'
import {
  formatDetectionId,
  parseWstgCode,
  isSpecialSeries,
} from '../../model/lidarBlock'
import type { LoadedBlockModel } from '../../model/blockModel'
import { Card, CardContent, CardHeader } from '../../../../shared/ui/atoms/Card'
import { StatusChip } from '../../../../shared/ui/atoms/StatusChip'
import { cn } from '../../../../shared/lib/utils'
import { LidarHistoryTimeline } from './LidarHistoryTimeline'
import { BlockShapePreview } from './BlockShapePreview'

interface DetectedBlockListProps {
  blocks: LidarBlockInfo[]
  /** 블록 CAD 모델 — 전달 시 카드에 형상 썸네일 표시 */
  model?: LoadedBlockModel | null
  /** 썸네일 클릭 시 해당 블록 단독 뷰로 전환 */
  onSelectBlock?: (blockId: string) => void
  /** 뷰어에서 선택된 블록 — 그 카드가 강조되고 목록 안에서 화면 안으로 들어온다 */
  selectedBlockId?: string | null
  /** 격자 규칙 override — 좁은 사이드 패널에 담을 때 한 열로 되돌린다 */
  className?: string
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'bg-status-healthy'
  if (confidence >= 0.8) return 'bg-status-degraded'
  return 'bg-status-unhealthy'
}

function StatCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-inshop-xs font-mono uppercase tracking-wide text-foreground/68">{label}</p>
      <p className="text-inshop-sm font-semibold text-foreground">{children}</p>
    </div>
  )
}

/** 카드가 패널 위쪽에 딱 붙지 않도록 남기는 여백 */
const CARD_TOP_GAP = 8

/** 이 요소를 실제로 굴리는 조상(세로 스크롤 컨테이너)을 찾는다 */
function findScrollParent(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement
  while (node) {
    const overflowY = getComputedStyle(node).overflowY
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node
    }
    node = node.parentElement
  }
  return null
}

interface DetectedBlockCardProps {
  block: LidarBlockInfo
  model?: LoadedBlockModel | null
  onSelect?: (blockId: string) => void
  /**
   * 프리뷰를 크게 내고 사용자가 직접 각도를 잡게 한다 (선택된 카드 하나).
   * 끄더라도 형상은 그대로 자동 회전한다 — 조작을 받지 않을 뿐이다.
   */
  livePreview?: boolean
  /** 뷰어에서 이 블록이 선택된 상태 — 목록에서 스스로 눈에 띄고 화면 안으로 들어온다 */
  selected?: boolean
}

export function DetectedBlockCard({
  block,
  model,
  onSelect,
  livePreview,
  selected = false,
}: DetectedBlockCardProps) {
  const { t } = useTranslation()
  const confidencePercent = Math.round(block.confidence * 100)
  const wstg = parseWstgCode(block.wstgCode)
  const [x, , z] = block.transform.position
  const cardRef = useRef<HTMLDivElement>(null)

  /*
   * 뷰어에서 블록을 고르면 그 카드가 목록 맨 위로 **바로** 온다.
   * 스르륵 굴러가면 그동안 눈이 카드를 따라가야 하는데, 이미 3D 쪽에서 무엇을
   * 골랐는지 알고 있으므로 기다릴 이유가 없다 — 그래서 애니메이션 없이 즉시 옮긴다.
   *
   * 페이지 전체를 움직이는 scrollIntoView 대신 **목록 패널만** 움직인다.
   * 그러지 않으면 뷰어까지 화면 밖으로 밀려난다.
   */
  useEffect(() => {
    if (!selected) return
    const card = cardRef.current
    if (!card) return

    const scroller = findScrollParent(card)
    if (!scroller) {
      card.scrollIntoView({ block: 'start', behavior: 'auto' })
      return
    }

    const offset = card.getBoundingClientRect().top - scroller.getBoundingClientRect().top
    scroller.scrollTop += offset - CARD_TOP_GAP
  }, [selected])

  return (
    <Card
      ref={cardRef}
      className={cn(
        'animate-fade-in scroll-mt-2',
        selected && 'ring-2 ring-accent ring-offset-2 ring-offset-background',
      )}
    >
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {block.cadRegistered ? (
            <>
              <p className="font-mono text-inshop-lg font-bold text-accent">{formatDetectionId(block)}</p>
              <span className="rounded-inshop-md bg-surface-secondary px-2 py-0.5 font-mono text-inshop-xs text-foreground/68">
                {t('blocks.projNo', { no: block.projNo })}
              </span>
              {isSpecialSeries(block) && (
                <span className="rounded-inshop-md bg-accent/15 px-2 py-0.5 font-mono text-inshop-xs font-semibold text-accent">
                  {t('blocks.specialSeries')}
                </span>
              )}
            </>
          ) : (
            <>
              <p className="font-mono text-inshop-lg font-bold text-status-unhealthy">{t('blocks.unidentifiedAssembly')}</p>
              <StatusChip tone="critical" label={t('blocks.cadUnmatched')} />
            </>
          )}
        </div>
        <p className="text-inshop-sm text-foreground/70">
          {block.cadRegistered
            ? block.blockName
            : t('blocks.pcdClusterDescription')}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {!block.cadRegistered && (
          <div className="flex h-20 items-center justify-center rounded-inshop-md bg-viewport text-inshop-sm text-glass-foreground/80">
            {t('blocks.noShape')}
          </div>
        )}
        {/*
          형상은 기본이 회전이다 — 어느 카드든 돌아간다.
          다만 각도를 직접 잡을 수 있는 것은 선택된 카드 하나뿐이고, 나머지는
          눌러서 그 블록을 고르는 버튼으로 남는다 (선택 → 그 다음 조작).
        */}
        {block.cadRegistered && model && block.modelAssemblyIds && (
          <BlockShapePreview
            model={model}
            assemblyIds={block.modelAssemblyIds}
            cacheKey={block.id}
            interactive={livePreview}
            onSelect={onSelect ? () => onSelect(block.id) : undefined}
            className={livePreview ? 'h-52 w-full' : 'h-36 w-full'}
          />
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-inshop-xs font-mono uppercase tracking-wide text-foreground/68">
              {t('blocks.confidence')}
            </span>
            <span className="text-inshop-sm font-semibold text-foreground">{confidencePercent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-secondary">
            <div
              className={cn('h-full rounded-full', confidenceColor(block.confidence))}
              style={{ width: `${confidencePercent}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-inshop-lg bg-surface-secondary p-4">
          <StatCell label={t('blocks.wstg')}>
            {block.cadRegistered ? (
              <span className="font-mono">
                {wstg.current} → {wstg.next}
              </span>
            ) : (
              <span className="text-foreground/68">{t('blocks.notIdentified')}</span>
            )}
          </StatCell>
          <StatCell label={t('blocks.cadRegistering')}>
            {block.cadRegistered ? (
              <span className="text-status-healthy">{t('blocks.registered')}</span>
            ) : (
              <span className="text-status-unhealthy">{t('blocks.registerFailed')}</span>
            )}
          </StatCell>
          <StatCell label={t('blocks.dimensions')}>
            {block.dimensions.length}m × {block.dimensions.width}m × {block.dimensions.height}m
          </StatCell>
          <StatCell label={t('blocks.positionInBay')}>
            <span className="font-mono">
              x {x >= 0 ? '+' : ''}
              {x}m, z {z >= 0 ? '+' : ''}
              {z}m
            </span>
          </StatCell>
        </div>

        {block.cadRegistered && block.plan && (
          <div className="rounded-inshop-lg border border-border p-4">
            <p className="mb-2 text-inshop-xs font-semibold uppercase tracking-wide text-foreground/68">
              {t('blocks.monthlyPlan')}
            </p>
            <StatCell label={t('blocks.planPeriod')}>
              <span className="font-mono">
                {block.plan.planStartDate} ~ {block.plan.planEndDate}
              </span>
            </StatCell>
          </div>
        )}

        {block.cadRegistered && block.subAssemblies && block.subAssemblies.length > 0 && (
          <div>
            <h4 className="mb-2 text-inshop-xs font-semibold uppercase tracking-wide text-foreground/68">
              하위 조립 구성 ({block.subAssemblies.length}) —{' '}
              <span className="normal-case">
                완료 {block.subAssemblies.filter((s) => s.workStatus === 'completed').length} ·
                작업중 {block.subAssemblies.filter((s) => s.workStatus === 'in_progress').length} ·
                대기 {block.subAssemblies.filter((s) => s.workStatus === 'not_started').length}
              </span>
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {block.subAssemblies.map((sub) => (
                <span
                  key={sub.id}
                  className={cn(
                    'flex items-center gap-1.5 rounded-inshop-md px-2 py-1 font-mono text-inshop-xs',
                    sub.workStatus === 'completed' && 'bg-status-healthy/10',
                    sub.workStatus === 'in_progress' && 'bg-accent/10',
                    sub.workStatus === 'not_started' && 'bg-surface-secondary'
                  )}
                  title={t('blocks.partCount', { count: sub.partCount })}
                >
                  <span className="text-foreground/80">{sub.id}</span>
                  <span className="text-foreground/50">[{sub.wstgCode}]</span>
                  {sub.workStatus === 'completed' && (
                    <span className="font-semibold text-status-healthy">{t('blocks.done')}</span>
                  )}
                  {sub.workStatus === 'not_started' && (
                    <span className="text-foreground/68">{t('blocks.waiting')}</span>
                  )}
                  {sub.workStatus === 'in_progress' && (
                    <span className="flex items-center gap-1">
                      <span className="h-1 w-8 overflow-hidden rounded-full bg-border">
                        <span
                          className="block h-full rounded-full bg-accent"
                          style={{ width: `${sub.progress ?? 0}%` }}
                        />
                      </span>
                      <span className="font-semibold text-accent">{sub.progress}%</span>
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="mb-2 text-inshop-xs font-semibold uppercase tracking-wide text-foreground/68">
            {t('blocks.historyTitle')}
          </h4>
          <LidarHistoryTimeline history={block.history} />
        </div>
      </CardContent>
    </Card>
  )
}

export function DetectedBlockList({
  blocks,
  model,
  onSelectBlock,
  selectedBlockId,
  className,
}: DetectedBlockListProps) {
  const { t } = useTranslation()

  if (blocks.length === 0) {
    return <p className="text-inshop-sm text-foreground/68">{t('blocks.empty')}</p>
  }

  return (
    <div className={cn('grid grid-cols-1 gap-5 xl:grid-cols-2', className)}>
      {blocks.map((block) => {
        const selected = block.id === selectedBlockId
        return (
          <DetectedBlockCard
            key={block.id}
            block={block}
            model={model}
            onSelect={onSelectBlock}
            selected={selected}
            // 회전은 모든 카드가 한다 — 고른 카드만 크게, 그리고 손으로 몰 수 있게
            livePreview={selected}
          />
        )
      })}
    </div>
  )
}
