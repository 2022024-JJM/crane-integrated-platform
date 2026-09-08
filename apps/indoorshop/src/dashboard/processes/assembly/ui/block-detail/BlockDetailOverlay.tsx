import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import { cn } from '../../../../shared/lib/utils'
import type { LidarBlockInfo } from '../../../../shared/features/bay-viewer/model/lidarBlock'
import {
  formatDetectionId,
  parseWstgCode,
  isSpecialSeries,
} from '../../../../shared/features/bay-viewer/model/lidarBlock'
import { detectionProgress, hasProgressData } from '../../../../shared/features/bay-viewer/lib/progressStatus'

interface BlockDetailOverlayProps {
  block: LidarBlockInfo
  className?: string
}

/** 소조 작업 상태 집계 — 표 아래 "완료 n · 작업중 n · 대기 n" 한 줄 */
function summarizeSubAssemblies(block: LidarBlockInfo) {
  const subs = block.subAssemblies ?? []
  return {
    total: subs.length,
    completed: subs.filter((s) => s.workStatus === 'completed').length,
    inProgress: subs.filter((s) => s.workStatus === 'in_progress').length,
    notStarted: subs.filter((s) => s.workStatus === 'not_started').length,
    parts: subs.reduce((sum, s) => sum + s.partCount, 0),
  }
}

function confidenceClass(confidence: number): string {
  if (confidence >= 0.9) return 'bg-glass-healthy/20 text-glass-healthy'
  if (confidence >= 0.8) return 'bg-glass-degraded/20 text-glass-degraded'
  return 'bg-glass-unhealthy/20 text-glass-unhealthy'
}

/**
 * 블록 단독 뷰의 상세 패널 — 뷰포트 **왼쪽 위 구석에 박아 둔다**.
 *
 * 대상에 붙여 따라다니게 하면 궤도를 돌릴 때마다 패널이 화면을 헤엄치고, 시점에
 * 따라 형상을 가리는 자리로 넘어간다. 화면 하나에 대상도 하나뿐이라 "어느 것을
 * 말하는지"는 이미 분명하므로, 자리를 고정해 두는 편이 읽기에 낫다.
 *
 * 값은 **표**로 낸다 — 항목 이름과 값이 같은 열에 서야 위아래로 훑을 수 있고,
 * 다른 블록으로 옮겨 가도 같은 항목이 같은 자리에 있다.
 */
export function BlockDetailOverlay({ block, className }: BlockDetailOverlayProps) {
  const { t } = useTranslation()
  const wstg = parseWstgCode(block.wstgCode)
  const subs = summarizeSubAssemblies(block)
  const progress = Math.round(detectionProgress(block) * 100)
  const pct = Math.round(block.confidence * 100)
  const { length, width, height } = block.dimensions
  const latest = block.history?.[0]

  const rows: [string, string][] = [
    [t('blocks.overlay.shipBlock'), `${block.projNo} · ${block.blkNo}`],
    ...(block.assySerNo
      ? ([
          [
            t('blocks.overlay.assySerial'),
            `${block.assySerNo}${isSpecialSeries(block) ? ` (${t('blocks.overlay.special')})` : ''}`,
          ],
        ] as [string, string][])
      : []),
    [t('blocks.overlay.wstg'), `${block.wstgCode} · ${wstg.current}→${wstg.next}`],
    [t('blocks.overlay.dimensions'), `${length} × ${width} × ${height} m`],
    ...(subs.total > 0
      ? ([
          [
            t('blocks.overlay.composition'),
            t('blocks.overlay.compositionValue', { sub: subs.total, parts: subs.parts }),
          ],
        ] as [string, string][])
      : []),
    [
      t('blocks.overlay.plan'),
      block.plan
        ? `${block.plan.planStartDate} ~ ${block.plan.planEndDate}`
        : t('blocks.overlay.planPending'),
    ],
    ...(latest
      ? ([[t('blocks.overlay.recent'), `${latest.timestamp} ${latest.event}`]] as [
          string,
          string,
        ][])
      : []),
  ]

  return (
    <div
      className={cn(
        'pointer-events-none absolute left-3 top-3 w-64 animate-fade-in',
        'overflow-hidden rounded-inshop-lg glass-panel',
        className,
      )}
    >
      {/* 머리 — 무엇을 보고 있는지 */}
      <div className="flex items-center gap-1.5 border-b border-glass-border/70 px-2.5 py-2">
        <span
          className={cn(
            'font-mono text-inshop-xs font-semibold',
            block.cadRegistered ? 'text-glass-accent' : 'text-glass-unhealthy',
          )}
        >
          {block.cadRegistered ? formatDetectionId(block) : t('viewer.unidentified')}
        </span>
        <span className="min-w-0 flex-1 truncate text-2xs text-glass-foreground/63">
          {block.cadRegistered ? block.blockName : t('blocks.overlay.pcdClusterUnmatched')}
        </span>
        <span
          className={cn(
            'shrink-0 rounded px-1 py-px font-mono text-2xs font-semibold',
            confidenceClass(block.confidence),
          )}
        >
          {pct}%
        </span>
      </div>

      {!block.cadRegistered && (
        <p className="border-b border-glass-border/70 px-2.5 py-1.5 text-2xs text-glass-unhealthy">
          {t('blocks.overlay.registerFailWarning')}
        </p>
      )}

      {/* 진척 — 하나뿐인 게이지라 표 위에 따로 둔다. 근거 없는 기본값(100%)은 내보이지 않는다 */}
      {hasProgressData(block) && (
        <div className="border-b border-glass-border/70 px-2.5 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xs text-glass-foreground/54">{t('blocks.overlay.progress')}</span>
            <span className="font-mono text-2xs font-semibold text-glass-foreground/85 tabular-nums">
              {progress}%
            </span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-glass-active">
            <div
              className="h-full rounded-full bg-glass-accent transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* 값은 표로 — 항목/값 두 열이 위아래로 정렬돼야 훑을 수 있다 */}
      <table className="w-full table-fixed">
        <tbody>
          {rows.map(([term, value]) => (
            <tr key={term} className="border-b border-glass-border/40 last:border-b-0">
              <th
                scope="row"
                className="w-[5.5rem] px-2.5 py-1 text-left align-top text-2xs font-normal text-glass-foreground/54"
              >
                {term}
              </th>
              <td className="px-2.5 py-1 text-right align-top text-2xs text-glass-foreground/85">
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {subs.total > 0 && (
        <div className="flex items-center gap-2 border-t border-glass-border/70 px-2.5 py-1.5 text-2xs tabular-nums">
          <span className="text-glass-healthy">{t('blocks.done')} {subs.completed}</span>
          <span className="text-glass-degraded">{t('blocks.inProgress')} {subs.inProgress}</span>
          <span className="text-glass-foreground/50">{t('blocks.waiting')} {subs.notStarted}</span>
        </div>
      )}
    </div>
  )
}
