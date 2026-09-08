import { useContext } from 'react'
import { FixedViewportContext } from './context'

/** 셸(LayoutWrapper)이 현재 모드를 읽는다 */
export function useFixedViewport(): boolean {
  return useContext(FixedViewportContext).fixed
}
