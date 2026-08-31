import { Link } from 'react-router-dom'
import { useTranslation } from '../../lib/i18n/useTranslation'
import {
  PARCEL_CATEGORY_COLORS,
  colorOfProcess,
} from '../../entities/yard-parcels'
import type { ProcessMapLocation } from '../../model/processMapDrilldown'
import { cn } from '../../lib/utils'
import { CloseIcon, PinIcon } from '../../ui/icons'
import type { BaySummary } from './bayDetail'
import { toggleSpottedLot } from './lotSpot'

/**
 * 지도에서 베이 한 칸을 눌렀을 때 열리는 카드 — 드릴다운의 마지막 한 단계.
 *
 * 공장을 누르면 그 공장이 베이로 갈라지고, 베이를 **한 번** 누르면 여기까지다. 한 번의
 * 클릭이 곧장 공정 상세 화면으로 나가 버리면 지도에서 베이를 훑어볼 수가 없다 — 눌러
 * 보는 것이 곧 화면을 떠나는 일이 되기 때문이다. 그래서 첫 클릭은 여기서 멈추고, 나가는
 * 문은 카드 안의 명시적인 링크와 **같은 베이를 한 번 더 누르는 것**이 맡는다
 * (`mapSpotlight.bayClickIntent`). 그 문이 없는 베이도 있다 — 지도의 베이와 공정의 작업
 * 위치는 다른 자료라 짝이 없을 수 있고, 그때는 재클릭도 여느 때처럼 선택 해제다.
 *
 * 지번 줄에 적는 것은 원본 자료의 **설명** 열 그대로다 — 우리가 지어낸 이름이 아니라
 * 현장이 그 칸을 부르는 이름이라야 지도와 현장이 같은 말을 한다.
 *
 * 그 줄은 **누를 수 있다**(`onSelectLot`). 이름과 면적만으로는 `PB3B01` 이 베이의 어느
 * 끝인지 알 길이 없어, 목록과 지도 사이를 사람이 눈으로 맞춰야 했다. 줄에 손을 얹으면
 * 지도가 그 칸을 짚어 보이고(미리보기), 누르면 그 짚기가 남는다 — 목록을 훑는 동안
 * 지도가 계속 대답하게 하려는 것이다. 짚기는 **선택이 아니다**: 드릴다운 단계를 만들지
 * 않고 카메라도 움직이지 않으므로, 베이 재클릭으로 상세에 들어가는 길과 다투지 않는다.
 */
export function BayDetailCard({
  bay,
  locationNoun,
  linkedLocation,
  highlightedLot = null,
  onSelectLot,
  onHoverLot,
  onBack,
  onClose,
}: {
  bay: BaySummary
  /** 이 공정이 작업 위치를 부르는 말 — 공정 모듈이 준다 (PRD FR-3). 나가는 문이 있을 때만 쓴다 */
  locationNoun?: string
  /**
   * 지번이 겹치는 공정 작업 위치.
   *  - 위치 하나 = 그 위치로 나가는 문을 연다.
   *  - `null` = 찾아봤지만 짝이 없다 — 그 사정을 문 자리에 적는다.
   *  - **생략** = 이 화면에는 작업 위치라는 단계가 아예 없다(도장 배치도) — 문 자리를
   *    만들지 않는다. "없다"고 말할 것도 없는 곳에서 없다고 말하면 빠진 것처럼 읽힌다.
   */
  linkedLocation?: ProcessMapLocation | null
  /**
   * **눌러 둔** 지번코드 — 그 줄이 눌린 형태가 된다.
   *
   * 호버 미리보기(`onHoverLot`)로 지도가 잠시 짚는 것은 여기 오지 않는다. 그것까지 섞으면
   * 손이 얹힌 줄이 이미 눌린 것으로 보여 다음 클릭이 **해제**가 되어 버린다 — 누를 수
   * 없는 버튼이 되는 셈이다. 미리보기는 지도에서만 이기고, 줄의 상태는 눌린 것만 말한다.
   */
  highlightedLot?: string | null
  /**
   * 지번 줄 클릭 — 같은 줄을 다시 누르면 짚기를 푼다(null). 주지 않으면 줄은 지금까지처럼
   * 읽기 전용이다(짚어 볼 지도가 없는 자리에 누를 수 있는 척하는 줄을 만들지 않는다).
   */
  onSelectLot?: (lot: string | null) => void
  /** 지번 줄 호버 — 벗어나면 null. 짚기의 미리보기다 */
  onHoverLot?: (lot: string | null) => void
  /** 공장 요약으로 되돌아가기 (베이 선택만 푼다) */
  onBack: () => void
  /** 공장 선택까지 통째로 닫기 */
  onClose: () => void
}) {
  const { t } = useTranslation()
  const processColor = bay.process ? colorOfProcess(bay.process) : '#9a9890'

  return (
    <section className="pointer-events-auto flex max-h-full min-h-0 flex-col overflow-hidden rounded-xl border border-white/12 bg-[#0b0e12]/95 text-white shadow-[0_18px_48px_rgba(0,0,0,0.38)] backdrop-blur-xl">
      <div className="h-0.5 w-full shrink-0" style={{ backgroundColor: processColor }} />

      <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-3">
        <div className="min-w-0 space-y-1">
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 flex max-w-full items-center gap-1 rounded-inshop-sm px-1 py-0.5 text-2xs text-white/55 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <span aria-hidden="true">←</span>
            <span className="truncate">{bay.factory}</span>
          </button>
          <h3 className="truncate text-inshop-xl font-semibold leading-tight tracking-[-0.03em]">
            {bay.label}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('dashboard.map.close')}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-inshop-lg border border-white/8 text-white/48 transition-colors hover:border-white/15 hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <CloseIcon size={16} />
        </button>
      </div>

      {/*
        머리(베이 이름·닫기)와 나가는 문은 고정, 그 사이 본문만 스크롤한다 — 낮은 해상도에서
        카드 높이가 모자라도 줄이 중간에서 잘리지 않게 한다.
      */}
      <div className="scroll-thin scroll-shadow-y flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* 세로가 빠듯한 화면(≤900px)에서는 이 요약 칸이 여백과 숫자를 한 단계 줄여
          아래 목록에 줄을 내준다 — 스크롤로 밀어내기 전에 먼저 자리를 만든다 */}
      <dl className="grid shrink-0 grid-cols-2 gap-2 border-y border-white/8 bg-white/[0.018] p-3 text-inshop-xs [@media(max-height:900px)]:gap-1.5 [@media(max-height:900px)]:p-2">
        <div className="rounded-inshop-lg border border-white/8 bg-white/[0.035] p-3 [@media(max-height:900px)]:p-2">
          <dt className="text-2xs text-white/45">{t('dashboard.map.lots')}</dt>
          <dd className="mt-1 text-inshop-2xl font-semibold tracking-[-0.04em] tabular-nums [@media(max-height:900px)]:text-inshop-xl">
            {bay.lots.length}
          </dd>
        </div>
        <div className="rounded-inshop-lg border border-white/8 bg-white/[0.035] p-3 [@media(max-height:900px)]:p-2">
          <dt className="text-2xs text-white/45">{t('dashboard.map.area')}</dt>
          <dd className="mt-1 text-inshop-2xl font-semibold tracking-[-0.04em] tabular-nums [@media(max-height:900px)]:text-inshop-xl">
            {Math.round(bay.area).toLocaleString()}
            <span className="ml-1 text-2xs font-normal text-white/42">m²</span>
          </dd>
        </div>
        <div className="flex items-center justify-between px-2 py-1">
          <dt className="text-white/48">{t('dashboard.map.indoor')}</dt>
          <dd className="font-medium tabular-nums text-white/86">{bay.indoor}</dd>
        </div>
        <div className="flex items-center justify-between px-2 py-1">
          <dt className="text-white/48">{t('dashboard.map.outdoor')}</dt>
          <dd className="font-medium tabular-nums text-white/86">{bay.outdoor}</dd>
        </div>
      </dl>

      {/* 지번 목록 — 코드와 **원본 설명**을 나란히.
          `shrink-0`: 이 칸이 눌리면 안의 목록이 칸 밖으로 삐져나와 아랫줄과 겹쳐 그려진다.
          모자란 높이는 칸을 줄여서가 아니라 바깥 본문 스크롤로 낸다. */}
      <div className="flex shrink-0 flex-col px-3 py-3">
        <p className="mb-2 shrink-0 px-1 text-2xs font-medium text-white/55">
          {t('dashboard.map.bayLotList')}
          <span className="ml-1.5 font-mono text-white/30">{bay.lots.length}</span>
        </p>
        <ul
          className="scroll-thin min-h-0 space-y-1 overflow-y-auto pr-0.5"
          onMouseLeave={onHoverLot ? () => onHoverLot(null) : undefined}
        >
          {bay.lots.map((lot) => {
            const spotted = lot.lot === highlightedLot
            const body = (
              <>
                <div className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: PARCEL_CATEGORY_COLORS[lot.category] ?? '#9a9890' }}
                  />
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-inshop-xs font-medium',
                      spotted ? 'text-white' : 'text-white/88'
                    )}
                  >
                    {lot.description}
                  </span>
                  {/* 짚은 줄에만 서는 조준 표시 — 지도 위의 패와 같은 뜻이다 */}
                  {spotted && (
                    <PinIcon size={12} className="shrink-0 text-white/80" />
                  )}
                  <span
                    className={cn(
                      'shrink-0 rounded border px-1 py-px font-mono text-2xs leading-4',
                      spotted ? 'bg-white/12 text-white' : 'text-white/62'
                    )}
                    style={{ borderColor: spotted ? '#ffffff8c' : `${processColor}4d` }}
                  >
                    {lot.lot}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 pl-3.5 text-2xs text-white/48">
                  <span className="tabular-nums">{Math.round(lot.area).toLocaleString()} m²</span>
                  {lot.place && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{lot.place}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="min-w-0 truncate">{lot.category}</span>
                </div>
              </>
            )
            return (
              <li key={lot.lot}>
                {onSelectLot ? (
                  <button
                    type="button"
                    aria-pressed={spotted}
                    title={t('dashboard.map.bayLotSpotHint')}
                    onClick={() => onSelectLot(toggleSpottedLot(highlightedLot, lot.lot))}
                    onMouseEnter={() => onHoverLot?.(lot.lot)}
                    onFocus={() => onHoverLot?.(lot.lot)}
                    onBlur={() => onHoverLot?.(null)}
                    className={cn(
                      'w-full rounded-inshop-md px-2 py-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                      spotted
                        ? 'bg-white/12 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.32)]'
                        : 'hover:bg-white/[0.07]'
                    )}
                  >
                    {body}
                  </button>
                ) : (
                  <div className="rounded-inshop-md px-2 py-1.5 transition-colors hover:bg-white/[0.05]">
                    {body}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      </div>

      {/* 나가는 문 — 지번이 겹치는 작업 위치가 있을 때만. 없으면 그 사정을 말한다.
          작업 위치라는 단계 자체가 없는 화면(prop 생략)에서는 이 자리를 만들지 않는다 */}
      {linkedLocation !== undefined && (
      <div className="shrink-0 border-t border-white/8 px-4 py-3">
        {linkedLocation ? (
          <>
            <Link
              to={linkedLocation.detailPath}
              className="flex items-center gap-2 rounded-inshop-md px-2 py-1.5 text-inshop-xs font-medium text-white/78 transition-colors hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              style={{ boxShadow: `inset 0 0 0 1px ${processColor}59` }}
            >
              <span className="min-w-0 flex-1 truncate">
                {t('dashboard.map.bayOpenLocation', {
                  noun: locationNoun,
                  name: linkedLocation.displayName,
                })}
              </span>
              <span aria-hidden="true" className="shrink-0 text-2xs text-white/45">
                →
              </span>
            </Link>
            {/* 지도에서 같은 베이를 한 번 더 누르면 같은 곳으로 간다 — 눈에 보이지 않는
                동작이라 여기서 말해 준다 (링크가 있을 때만 참인 말이다) */}
            <p className="mt-1.5 px-2 text-2xs text-white/38">
              {t('dashboard.map.bayReopenHint')}
            </p>
          </>
        ) : (
          <p className="px-2 text-2xs text-white/45">
            {t('dashboard.map.bayNoLinkedLocation', { noun: locationNoun })}
          </p>
        )}
      </div>
      )}
    </section>
  )
}
