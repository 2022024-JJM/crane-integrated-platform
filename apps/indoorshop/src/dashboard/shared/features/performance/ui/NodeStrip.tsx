import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { InshopKey } from '../../../lib/i18n/keys'
import { cn } from '../../../lib/utils'
import { STATUS_STYLE } from '../../../ui/statusPalette'

/**
 * 절점 스트립 한 칸 — **세 권역이 같은 문법을 쓴다** (R33).
 *
 * 가공(S1~S10)·조립(취부→용접→사상)·도장(S/P→T/UP→FINAL)이 모두 이 모양으로 선다.
 * 예전에는 가공만 스트립이고 조립·도장은 텍스트 칩이라, 같은 헤더 안에서 세 권역을
 * 한 눈으로 읽을 수 없었다.
 *
 * `note` 는 그 절점의 근거 한 줄이다 — 가공은 절점 계획일, 조립·도장은 n/m(완료/계획).
 * 절점별 계획일이 있는 권역은 가공뿐이라 `delayed` 도 가공에서만 선다.
 */
export interface StripNode {
  /** 리스트 키 — 권역 안에서 고유 */
  key: string
  /** 칩에 찍히는 짧은 코드 (S1 · 취부 · S/P) */
  short: string
  /** 온전한 이름 — 툴팁·스크린리더에 쓴다 */
  name: string
  passed: boolean
  inProgress: boolean
  /** 가공 전용 — 계획일이 도래했는데 미통과 */
  delayed?: boolean
  /** 근거 한 줄 — 계획일 또는 n/m */
  note?: string
  /**
   * 이 절점이 속한 **큰 묶음**의 라벨 (가공의 적치/가공 — R39). 값이 바뀌는 자리에
   * 구분선과 라벨이 선다. 묶음이 없는 권역(조립·도장)은 비워 두면 종전 그대로 그려진다.
   */
  group?: string
}

/**
 * 수집 절점 스트립 — 블록 헤더에서 "어느 절점까지 왔는가"를 한 줄로 보여 준다.
 *
 * 색 단독으로 의미를 나르지 않는다(StatusChip 원칙과 동일) — 통과는 채움+✓,
 * 진행중은 반채움, 지연은 상태색 테두리+라벨을 함께 낸다.
 *
 * 가공이 10절점이 되면서 한 줄에 다 담기지 않는 폭이 생긴다. 디자인을 다시 짜지 않고
 * **줄바꿈**으로 받는다(`flex-wrap`) — 잘라 내면 뒤쪽 절점이 화면에서 사라지고,
 * 가로 스크롤은 헤더 카드에 어울리지 않는다. 이음선은 줄 첫 칸에서 뜨지 않도록
 * 칸 안쪽에 붙여 그린다.
 *
 * `group` 이 바뀌는 자리에는 이음선 대신 **세로 구분선 + 묶음 라벨**이 선다 (R39 —
 * 가공의 적치/가공). 칩 문법은 그대로 두고 사이만 갈라 놓는 것이라 재설계가 아니다.
 */
export function NodeStrip({ nodes, label }: { nodes: StripNode[]; label?: string }) {
  const { t } = useTranslation()

  const stateOf = (node: StripNode): { labelKey: InshopKey; className: string; mark: string } => {
    if (node.passed)
      return {
        labelKey: 'performance.nodes.passed',
        className: `border-status-healthy/50 bg-status-healthy/15 ${STATUS_STYLE.done.ink}`,
        mark: '✓',
      }
    if (node.delayed)
      return {
        labelKey: 'performance.nodes.delayed',
        className: `border-status-unhealthy/60 ${STATUS_STYLE.error.chip}`,
        mark: '!',
      }
    if (node.inProgress)
      return {
        labelKey: 'performance.nodes.inProgress',
        /* 진행중은 강조색이 아니라 상태 팔레트의 파랑 (감사 F-7) */
        className: `border-status-progress/50 ${STATUS_STYLE.inProgress.chip}`,
        mark: '…',
      }
    return {
      labelKey: 'performance.nodes.notDue',
      className: 'border-border bg-surface-secondary/60 text-foreground/45',
      mark: '·',
    }
  }

  return (
    <div className="flex items-start gap-1.5">
      {label && (
        <span className="mt-0.5 w-8 shrink-0 text-[10px] font-medium text-foreground/45">
          {label}
        </span>
      )}
      {nodes.length === 0 ? (
        <span className="rounded bg-surface-secondary px-1.5 py-0.5 text-[11px] text-foreground/45">
          {t('performance.nodes.none')}
        </span>
      ) : (
        <ol
          className="flex flex-wrap items-center gap-x-1 gap-y-1"
          aria-label={
            label ? `${label} ${t('performance.nodes.title')}` : t('performance.nodes.title')
          }
        >
          {nodes.map((node, i) => {
            const state = stateOf(node)
            const groupStart = node.group != null && node.group !== nodes[i - 1]?.group
            return (
              <li key={node.key} className="flex items-center gap-1">
                {groupStart ? (
                  <span className="flex items-center gap-1">
                    {i > 0 && <span className="mx-0.5 h-3.5 w-px bg-border" aria-hidden />}
                    <span className="text-[10px] font-medium text-foreground/45">{node.group}</span>
                  </span>
                ) : (
                  i > 0 && <span className="h-px w-2 bg-border" aria-hidden />
                )}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-inshop-md border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                    state.className
                  )}
                  title={[node.group, node.name, t(state.labelKey), node.note]
                    .filter(Boolean)
                    .join(' · ')}
                >
                  <span aria-hidden>{state.mark}</span>
                  {node.short}
                  <span className="sr-only">
                    {node.group ? `${node.group} ` : ''}
                    {node.name} {t(state.labelKey)}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
