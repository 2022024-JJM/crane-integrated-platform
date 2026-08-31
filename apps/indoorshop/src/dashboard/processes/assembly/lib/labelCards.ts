import * as THREE from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import type { TFunction } from 'i18next'
import type { InshopKey } from '../../../shared/lib/i18n/keys'
import type { LidarBlockInfo } from '../model/lidarBlock'
import { formatDetectionId } from '../model/lidarBlock'
import type { LidarSensorStatus } from '../model/lidarSensor'
import type { BayWorkState, SensorStatusCounts } from './bayStatusSummary'

/*
 * 뷰포트 위에 뜨는 CSS2D 라벨 카드 — 시뮬레이션 뷰어와 실측 스캔 뷰어가 같은
 * 라벨을 쓰도록 여기서 단일 출처로 관리한다.
 */

export function makeLabelObject(
  el: HTMLElement,
  position: THREE.Vector3,
  onClick?: () => void,
  onHover?: (hovering: boolean) => void
): CSS2DObject {
  /*
   * 라벨이 덮은 면적에서는 뷰포트 조작(궤도 회전 등)이 막힌다.
   * 그래서 래퍼는 이벤트를 통과시키고, 실제 카드에만 클릭을 받게 한다 —
   * 지시선·여백 위에서는 그대로 회전할 수 있다.
   */
  el.style.pointerEvents = 'none'
  if (onClick) {
    const card = el.firstElementChild as HTMLElement | null
    const target = card ?? el
    target.style.cursor = 'pointer'
    target.style.pointerEvents = 'auto'
    target.addEventListener('click', onClick)
  }
  if (onHover) {
    const card = (el.firstElementChild as HTMLElement | null) ?? el
    card.style.pointerEvents = 'auto'
    card.addEventListener('mouseenter', () => onHover(true))
    card.addEventListener('mouseleave', () => onHover(false))
  }
  const label = new CSS2DObject(el)
  label.position.copy(position)
  label.center.set(0.5, 1) // 앵커 끝(하단)이 대상 지점을 가리키도록
  return label
}

export function confidenceClasses(confidence: number): string {
  /* 라벨은 어두운 유리 위에 뜬다 — 본문용 라이트 상태색은 여기서 읽히지 않아 유리 램프를 쓴다 */
  if (confidence >= 0.9) return 'bg-glass-healthy/20 text-glass-healthy'
  if (confidence >= 0.8) return 'bg-glass-degraded/20 text-glass-degraded'
  return 'bg-glass-unhealthy/20 text-glass-unhealthy'
}

/** 신뢰도 구간을 점 하나로 — 폭이 없는 카드(compact)에서 숫자 대신 쓴다 */
function confidenceDotClass(confidence: number): string {
  if (confidence >= 0.9) return 'bg-glass-healthy'
  if (confidence >= 0.8) return 'bg-glass-degraded'
  return 'bg-glass-unhealthy'
}

/**
 * 블록/조립품 위에 뜨는 인식 라벨 카드.
 *
 * 정반 하나에 라벨이 열 개 넘게 뜬다 — 카드가 크면 서로 겹쳐 가리고, 무엇보다
 * **점군을 덮는다**. 형상이 주인공이므로 여기서는 한 줄(ID·이름·신뢰도)만 낸다.
 * 상세는 이 라벨을 눌러 들어간 단독 뷰가 뷰포트 왼쪽 위 패널로 보여준다.
 *
 * `compact` 는 이름과 신뢰도 숫자를 빼고 **ID + 신뢰도 점**만 남긴다. 실측 스캔처럼
 * 조립품 아홉 개가 한 정반에 붙어 서면 카드 폭이 그대로 겹침이 되기 때문이다 —
 * 이름은 ID 를 되풀이할 뿐이고, 정확한 신뢰도는 옆 목록·단독 뷰가 이미 보여준다.
 */
export function createBlockLabel(
  block: LidarBlockInfo,
  position: THREE.Vector3,
  t: TFunction,
  onClick?: () => void,
  compact = false,
  /**
   * 이 블록의 세그멘테이션 색 (CSS hex). 주면 카드 테두리·지시선이 그 색을 쓴다 —
   * 라벨과 점 무리를 색으로 잇지 않으면, 블록이 열 개 넘게 붙어 선 정반에서 어느
   * 라벨이 어느 덩어리 것인지 위치만으로 가늠하게 된다.
   */
  accentHex?: string
): CSS2DObject {
  const pct = Math.round(block.confidence * 100)
  const idText = block.cadRegistered ? formatDetectionId(block) : t('viewer.unidentified')
  const idClass = block.cadRegistered ? 'text-glass-accent' : 'text-glass-unhealthy'
  const nameText = block.cadRegistered ? block.blockName : t('viewer.pcdCluster')
  const registrationBadge = block.cadRegistered
    ? ''
    : `<span class="rounded px-1 py-px text-2xs font-semibold bg-glass-unhealthy/20 text-glass-unhealthy">${t(
        'viewer.unregistered'
      )}</span>`
  const cardStyle = accentHex ? ` style="border-color:${accentHex}"` : ''
  const leaderStyle = accentHex ? ` style="background:${accentHex}"` : ''
  const dotStyle = accentHex ? ` style="background:${accentHex};box-shadow:0 0 5px ${accentHex}"` : ''
  const leaderClass = accentHex ? 'h-2.5 w-px' : 'h-2.5 w-px bg-glass-accent/60'
  const dotClass = accentHex
    ? 'h-1 w-1 rounded-full'
    : 'h-1 w-1 rounded-full bg-glass-accent shadow-[0_0_5px] shadow-glass-accent/70'
  const wrap = document.createElement('div')
  wrap.className = 'flex flex-col items-center'
  wrap.style.transform = 'translateY(-6px)'
  wrap.innerHTML = `
    <div class="flex items-center gap-1.5 whitespace-nowrap rounded-md glass-panel px-1.5 py-0.5 transition-colors hover:bg-glass-hover"${cardStyle}>
      <span class="font-mono text-2xs font-semibold ${idClass}">${idText}</span>
      ${
        compact
          ? `<span class="h-1.5 w-1.5 rounded-full ${confidenceDotClass(block.confidence)}" title="${pct}%"></span>`
          : `<span class="max-w-32 truncate text-2xs text-glass-foreground/63">${nameText}</span>
      <span class="rounded px-1 py-px font-mono text-2xs font-semibold ${confidenceClasses(block.confidence)}">${pct}%</span>`
      }
      ${registrationBadge}
    </div>
    <div class="${leaderClass}"${leaderStyle}></div>
    <div class="${dotClass}"${dotStyle}></div>
  `
  return makeLabelObject(wrap, position, onClick)
}

/** 베이 대표 상태 → 라벨 상태점·글자색·문구 (색만으로 전하지 않는다 — 상태 텍스트가 항상 붙는다) */
const BAY_STATUS_STYLE: Record<
  LidarSensorStatus,
  { dot: string; ink: string; labelKey: InshopKey }
> = {
  online: {
    dot: 'bg-glass-healthy',
    ink: 'text-glass-healthy',
    labelKey: 'sensors.status.online',
  },
  offline: {
    dot: 'bg-glass-foreground/40',
    ink: 'text-glass-foreground/63',
    labelKey: 'sensors.status.offline',
  },
  error: {
    dot: 'bg-glass-unhealthy',
    ink: 'text-glass-unhealthy',
    labelKey: 'sensors.status.error',
  },
  calibrating: {
    dot: 'bg-glass-degraded',
    ink: 'text-glass-degraded',
    labelKey: 'sensors.status.calibrating',
  },
}

export interface BayStatusLabelData {
  name: string
  workCntr: string
  /** 대표 LiDAR 상태 (worstSensorStatus) — null 이면 데이터 미수신 */
  sensorStatus: LidarSensorStatus | null
  sensorCounts: SensorStatusCounts
  workState: BayWorkState
  blockCount: number
  /** 현재 공정 단계(송선 현공정 코드) — 없으면 표시하지 않는다 */
  stageCode: string | null
}

/**
 * 공장 뷰 정반 라벨 — 베이명 + 대표 상태 + 현재 작업 (PRD FR-2).
 *
 * 카드 본체는 `<button>` 이다 — CSS2D 라벨이 3D 위 유일한 선택 수단이므로
 * 키보드 Tab 으로도 정반을 고를 수 있어야 한다 (PRD §9 접근성).
 * `compact` 는 밀집 공장에서 이름·상태점만 남긴다 — 선택·이상 정반 라벨이
 * 우선권을 갖고, 나머지는 줄여 겹침을 던다 (FR-3 라벨 축약).
 */
export function createBayStatusLabel(
  data: BayStatusLabelData,
  position: THREE.Vector3,
  t: TFunction,
  onClick?: () => void,
  onHover?: (hovering: boolean) => void,
  compact = false
): CSS2DObject {
  const style = data.sensorStatus ? BAY_STATUS_STYLE[data.sensorStatus] : null
  const statusText = style ? t(style.labelKey) : t('viewer.bayStatus.noData')
  const workText =
    data.workState === 'working'
      ? t('viewer.bayStatus.working', { count: data.blockCount })
      : data.workState === 'idle'
        ? t('viewer.bayStatus.idle')
        : t('viewer.bayStatus.noData')
  const summary = t('viewer.bayStatus.sensorSummary', { ...data.sensorCounts })
  const failing = data.sensorStatus === 'error' || data.sensorStatus === 'offline'

  const wrap = document.createElement('div')
  wrap.className = 'flex flex-col items-center'
  /*
   * 이상 정반 라벨은 항상 겹침의 맨 위로 — 밀집 구간에서 정상 라벨에 가려
   * "문제 있는 베이"가 안 보이면 이 화면의 첫 번째 목적이 무너진다 (FR-3).
   */
  wrap.style.zIndex = data.sensorStatus === 'error' ? '3' : failing ? '2' : '1'
  wrap.innerHTML = `
    <button type="button" title="${summary}" class="flex flex-col items-stretch gap-0.5 whitespace-nowrap rounded-md glass-panel px-2 py-1 text-left transition-colors hover:bg-glass-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent${
      data.sensorStatus === 'error' ? ' ring-1 ring-glass-unhealthy/70' : ''
    }">
      <span class="flex items-center gap-1.5">
        <span aria-hidden="true" class="h-1.5 w-1.5 shrink-0 rounded-full ${style?.dot ?? 'bg-glass-foreground/30'}"></span>
        <span class="max-w-28 truncate text-xs font-semibold text-glass-foreground">${data.name}</span>
        <span class="font-mono text-2xs tabular-nums text-glass-foreground/63">${data.workCntr}</span>
      </span>
      ${
        compact
          ? ''
          : `<span class="flex items-center gap-1 pl-3">
        <span class="text-2xs font-medium ${style?.ink ?? 'text-glass-foreground/63'}">${statusText}</span>
        <span aria-hidden="true" class="text-2xs text-glass-foreground/40">·</span>
        <span class="text-2xs tabular-nums text-glass-foreground/75">${workText}</span>
        ${
          data.stageCode
            ? `<span class="rounded bg-glass-hover px-1 font-mono text-2xs text-glass-foreground/75">${data.stageCode}</span>`
            : ''
        }
      </span>`
      }
    </button>
    <div class="h-2.5 w-px ${failing ? 'bg-glass-unhealthy/60' : 'bg-glass-accent/50'}"></div>
  `
  return makeLabelObject(wrap, position, onClick, onHover)
}

/** 공장 뷰에서 정반 위에 뜨는 라벨 카드 */
export function createBayLabel(
  name: string,
  workCntr: string,
  position: THREE.Vector3,
  t: TFunction,
  onClick?: () => void,
  onHover?: (hovering: boolean) => void
): CSS2DObject {
  const wrap = document.createElement('div')
  wrap.className = 'flex flex-col items-center'
  wrap.innerHTML = `
    <div class="flex items-center gap-1.5 whitespace-nowrap rounded-md glass-panel px-2 py-1 transition-colors hover:bg-glass-hover">
      <span class="text-xs font-semibold text-glass-foreground">${name}</span>
      <span class="font-mono text-2xs text-glass-foreground/63">${t('viewer.bayLabel', { code: workCntr })}</span>
    </div>
    <div class="h-2.5 w-px bg-glass-accent/50"></div>
  `
  return makeLabelObject(wrap, position, onClick, onHover)
}
