import { useSyncExternalStore } from 'react'
import { activeProcessPaletteId, subscribeProcessPalette } from '../../../entities/yard-parcels'

/** 지금 고른 공정 색 시안 id — 시안이 바뀌면 다시 그린다(`ProcessPaletteSwitcher`) */
export function useProcessPaletteId(): string {
  return useSyncExternalStore(subscribeProcessPalette, activeProcessPaletteId, activeProcessPaletteId)
}
