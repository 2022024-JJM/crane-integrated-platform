import * as THREE from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import type { TFunction } from 'i18next'
import type { LidarBlockInfo } from '../../../entities/lidar-block/model/types'
import { formatDetectionId } from '../../../entities/lidar-block/model/types'

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
  compact = false
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
  const wrap = document.createElement('div')
  wrap.className = 'flex flex-col items-center'
  wrap.style.transform = 'translateY(-6px)'
  wrap.innerHTML = `
    <div class="flex items-center gap-1.5 whitespace-nowrap rounded-md glass-panel px-1.5 py-0.5 transition-colors hover:bg-white/12">
      <span class="font-mono text-2xs font-semibold ${idClass}">${idText}</span>
      ${
        compact
          ? `<span class="h-1.5 w-1.5 rounded-full ${confidenceDotClass(block.confidence)}" title="${pct}%"></span>`
          : `<span class="max-w-32 truncate text-2xs text-glass-foreground/63">${nameText}</span>
      <span class="rounded px-1 py-px font-mono text-2xs font-semibold ${confidenceClasses(block.confidence)}">${pct}%</span>`
      }
      ${registrationBadge}
    </div>
    <div class="h-2.5 w-px bg-glass-accent/60"></div>
    <div class="h-1 w-1 rounded-full bg-glass-accent shadow-[0_0_5px] shadow-glass-accent/70"></div>
  `
  return makeLabelObject(wrap, position, onClick)
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
    <div class="flex items-center gap-1.5 whitespace-nowrap rounded-md glass-panel px-2 py-1 transition-colors hover:bg-white/12">
      <span class="text-xs font-semibold text-glass-foreground">${name}</span>
      <span class="font-mono text-2xs text-glass-foreground/63">${t('viewer.bayLabel', { code: workCntr })}</span>
    </div>
    <div class="h-2.5 w-px bg-glass-accent/50"></div>
  `
  return makeLabelObject(wrap, position, onClick, onHover)
}
