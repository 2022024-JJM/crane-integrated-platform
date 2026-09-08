/**
 * 야드 맵 팔레트·상태색 — `shared/features/yard-map` 이 소유한다.
 * 야드 모듈 안의 기존 참조를 그대로 두기 위해 다시 내보낸다(re-export).
 */
export {
  YARD_PALETTES,
  paletteOf,
  moveColor,
  bayColor,
  type YardPalette,
} from '../../../shared/features/yard-map/lib/yardColors'
