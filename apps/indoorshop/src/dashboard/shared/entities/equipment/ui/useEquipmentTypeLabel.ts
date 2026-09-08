import { useCallback } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { InshopKey } from '../../../lib/i18n/keys'
import { equipmentTypeFallback, equipmentTypeLabelKey } from './typeLabel'

/*
 * 설비 종류를 **화면 이름으로** 읽는 훅 (W7-6D).
 *
 * 화면은 `equipmentTypeOf(id)?.name` 을 직접 쓰지 않는다 — 그 이름은 도면의 이름이라
 * 현장에서 부르는 말과 다르고, 그대로 내보내면 같은 설비가 자리마다 다른 이름으로 선다
 * (`typeLabel.ts` 주석 참조). 화면 라벨이 필요한 자리는 전부 이 훅을 지난다.
 */
export function useEquipmentTypeLabel(): (typeId: string) => string {
  const { t } = useTranslation()
  return useCallback(
    (typeId: string) => {
      const key = equipmentTypeLabelKey(typeId)
      return key ? t(key as InshopKey) : equipmentTypeFallback(typeId)
    },
    [t]
  )
}
