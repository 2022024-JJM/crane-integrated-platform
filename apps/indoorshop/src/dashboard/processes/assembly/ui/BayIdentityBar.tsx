import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { PerformanceLink } from '../../../shared/entities/vessel'
import type { Location } from '../../../shared/entities/location/model/types'
import { LOCATION_STATUS_META } from '../../../shared/entities/location/model/types'
import type { LidarBlockInfo } from '../../../shared/features/bay-viewer/model/lidarBlock'
import { parseWstgCode } from '../../../shared/features/bay-viewer/model/lidarBlock'
import type { BlockModelManifest } from '../../../shared/features/bay-viewer/model/blockModel'
import { restExtents } from '../../../shared/features/bay-viewer/model/blockModel'
import { cn } from '../../../shared/lib/utils'

interface BayIdentityBarProps {
  location: Location
  /** 이 정반에서 인식된 것들 — 단위(중조립/대조립)와 정합 실패 수를 여기서 센다 */
  blocks: LidarBlockInfo[]
  /** 정반에 배정된 블록의 CAD 매니페스트 — 송선기호·전체 치수 출처 */
  manifest?: BlockModelManifest | null
  className?: string
}

const pill = 'inline-flex items-baseline gap-1.5 rounded-inshop-md bg-surface-secondary px-2 py-1'

/**
 * 이름표 + 값 한 쌍.
 *
 * 값만 나열하면 어느 숫자가 무엇인지 매번 다시 읽어야 하고, 값마다 칸을 크게 세우면
 * 머리글이 화면을 먹는다 — 그래서 이름은 작게 앞에 붙이고 값만 굵게 남긴다.
 * 레거시 필드명(WORK_CNTR 등)은 툴팁으로 넘긴다: 옮겨 적을 때만 필요한 정보다.
 */
function IdentityPill({
  label,
  value,
  code,
  detail,
  hint,
  muted = false,
}: {
  label: string
  value: string
  code: string
  /** 값 뒤에 옅게 붙는 보조 값 (정반 이름·송선기호 등) */
  detail?: string
  /** 툴팁에 덧붙일 설명 */
  hint?: string
  muted?: boolean
}) {
  return (
    <span className={pill} title={[`${label} (${code})`, hint].filter(Boolean).join(' · ')}>
      <span className="text-2xs font-medium text-foreground/54">{label}</span>
      <span
        className={cn(
          'font-mono text-inshop-sm font-bold leading-none',
          muted ? 'text-foreground/40' : 'text-foreground',
        )}
      >
        {value}
      </span>
      {detail && <span className="font-mono text-2xs text-foreground/54">{detail}</span>}
    </span>
  )
}

/**
 * 정반 머리글 — 이 화면이 **어느 정반의 · 어느 호선의 · 어느 블록**을 보고 있는지.
 *
 * 제목과 같은 줄에 서는 한 줄짜리다. 이 화면은 세로가 곧 뷰어 해상도라서,
 * 식별 정보가 한 줄 더 먹을 때마다 점군이 그만큼 작아진다.
 */
export function BayIdentityBar({ location, blocks, manifest, className }: BayIdentityBarProps) {
  const { t } = useTranslation()
  const status = LOCATION_STATUS_META[location.status]
  const statusLabel = t(status.labelKey)

  /*
   * 호선·블록의 신원 — **정반 배정이 있으면 그것, 없으면 인식된 블록에서 읽는다.**
   *
   * 목업 정반은 배정이 곧 신원이라 예전처럼 `location.projNo/blkNo` 를 쓴다. 실측 정반
   * (PBS 5BAY)에는 mock 배정이 없고(로스터 주석 참조) 대신 스캔이 정합한 13개 조립품이
   * 호선·블록을 실어 온다 — 그걸 읽지 않으면 화면이 '—' 만 내놓는다(W9-0 진단 #1·#2).
   *
   * ⚠️ **한 정반에 블록이 여럿일 수 있다.** 실측 5BAY 에는 553·726·736 셋이 함께 서
   * 있다. 하나만 골라 적으면 나머지 둘이 화면에서 사라지므로 `553 외 2` 로 말하고,
   * 통합실적 링크에도 셋을 다 실어 보낸다.
   */
  const uniq = (values: (string | undefined)[]) => [...new Set(values.filter(Boolean) as string[])]
  const projNos = location.projNo ? [location.projNo] : uniq(blocks.map((b) => b.projNo))
  const blkNos = location.blkNo ? [location.blkNo] : uniq(blocks.map((b) => b.blkNo))
  const assigned = projNos.length > 0 && blkNos.length > 0
  /** `553` 또는 `553 외 2` — 값이 여럿일 때만 꼬리를 붙인다 */
  const summarize = (values: string[]) =>
    values.length === 0
      ? t('common.none')
      : values.length === 1
        ? values[0]
        : t('assembly.bayIdentity.andMore', { first: values[0], rest: values.length - 1 })

  // 인식 단위 — 중·소조립 단위면 assySerNo 가 붙고, 대조립(블록) 단위면 없다
  const unitLabel = blocks.length
    ? blocks.some((block) => block.assySerNo)
      ? t('assembly.bayIdentity.unitAssembly')
      : t('assembly.bayIdentity.unitBlock')
    : null
  const unmatched = blocks.filter((block) => !block.cadRegistered).length

  const wstg = manifest ? parseWstgCode(manifest.wstgCode) : null
  const size = manifest ? restExtents(manifest) : null

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <IdentityPill
        label={t('assembly.bayIdentity.bay')}
        value={location.workCntr}
        code="WORK_CNTR"
        detail={location.name}
      />
      <IdentityPill
        label={t('assembly.bayIdentity.projNo')}
        value={summarize(projNos)}
        code="PROJ_NO"
        muted={!assigned}
        hint={projNos.length > 1 ? projNos.join(' · ') : undefined}
      />
      <IdentityPill
        label={t('assembly.bayIdentity.block')}
        value={summarize(blkNos)}
        code="BLK_NO"
        muted={!assigned}
        detail={
          wstg
            ? t('assembly.bayIdentity.wstg', { from: wstg.current, to: wstg.next })
            : undefined
        }
        hint={
          size
            ? t('assembly.bayIdentity.dimensions', {
                length: size[0].toFixed(1),
                width: size[2].toFixed(1),
                height: size[1].toFixed(1),
              })
            : undefined
        }
      />

      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />

      <span
        className={cn(pill, 'items-center text-inshop-xs font-medium', status.ink)}
        title={t('assembly.bayIdentity.statusTitle', { status: statusLabel })}
      >
        <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
        {statusLabel}
      </span>

      {unitLabel && (
        <span className={cn(pill, 'text-2xs text-foreground/58')} title={t('assembly.bayIdentity.unitTitle')}>
          {unitLabel}
          <span className="font-mono text-inshop-sm font-bold leading-none text-foreground">
            {blocks.length}
          </span>
          {t('assembly.bayIdentity.countUnit')}
        </span>
      )}

      {/* 이 정반의 블록을 통합실적에서 — 호선·블록을 실어 보내므로 도착해서 다시 고르지
          않는다. 배정이 없는 정반에는 보낼 블록도 없다. */}
      {assigned && <PerformanceLink projNo={projNos[0]} blockNo={blkNos} />}

      {unmatched > 0 && (
        <span
          className={cn(pill, 'bg-status-unhealthy/10 text-2xs text-status-unhealthy')}
          title={t('assembly.bayIdentity.unmatchedTitle')}
        >
          {t('assembly.bayIdentity.unmatched')}
          <span className="font-mono text-inshop-sm font-bold leading-none">{unmatched}</span>
        </span>
      )}
    </div>
  )
}
