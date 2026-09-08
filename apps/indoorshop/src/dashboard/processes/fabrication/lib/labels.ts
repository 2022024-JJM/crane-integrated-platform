import type { i18n as I18n, TFunction } from 'i18next'
import type { InshopKey } from '../../../shared/lib/i18n/keys'
import type { StateInfo } from '../model/dashboard'

/**
 * 코드값 → 화면 문구.
 *
 * 절점·이벤트·상태·레거시 코드(STUS, WORK_CLSF, PTN_CLSF)는 백엔드가 코드 그대로 내려 준다.
 * 번역 조각(`fabrication.judgment.*`)에 있는 코드는 문구로, 없는 코드는 **코드 그대로**
 * 보여 준다 — 모르는 코드가 빈칸이나 키 문자열로 찍히면 데이터를 확인하는 화면의 뜻이 없다.
 */

type CodeGroup = 'checkpoint' | 'event' | 'stus' | 'workClsf' | 'prcsClsf' | 'issClsf' | 'ptnHead'

export function codeLabel(t: TFunction, i18n: I18n, group: CodeGroup, code: string | null | undefined): string {
  if (code === null || code === undefined || code === '') return t('common.none')
  const key = `fabrication.judgment.codes.${group}.${code}`
  return i18n.exists(key) ? t(key as InshopKey) : code
}

/** 상태 id → fabrication.yml 의 name. 사전에 없는 id(설정에서 사라진 상태)는 id 그대로. */
export function stateLabel(states: StateInfo[], stateId: string | null | undefined, none: string): string {
  if (!stateId) return none
  return states.find((state) => state.stateId === stateId)?.name ?? stateId
}

/** PTN_CLSF 1글자째 — K입고/S 1차선별/P 2차선별/O불출/E긴급/L가불출/H이적 */
export function ptnHead(ptnClsf: string): string {
  return ptnClsf.charAt(0)
}

/**
 * 절점을 화면에 세우는 순서 — 판별 결과 카운트(Map)는 순서가 없으므로 여기서 고정한다.
 * ROLL 축 4절점 뒤에 PART 축 절단이 선다 (기능정의서_가공 §3.2).
 */
export const CHECKPOINT_ORDER = ['RECEIVING', 'FIRST_PICK', 'SECOND_PICK', 'ISSUE', 'CUTTING'] as const

/** ROLL 체인의 절점 ↔ 기반 컬럼 ↔ 상태 id (RollTracePanel 의 대조표 행) */
export const ROLL_CHECKPOINTS = [
  { checkpoint: 'RECEIVING', column: 'ACPT_DATE', field: 'acptDate', stateId: 'ROLL_RECEIVED' },
  { checkpoint: 'FIRST_PICK', column: 'FRST_PICK_ACTL_DATE_1', field: 'frstPickActlDate1', stateId: 'ROLL_FIRST_PICKED' },
  { checkpoint: 'SECOND_PICK', column: 'SCND_PICK_ACTL_DATE', field: 'scndPickActlDate', stateId: 'ROLL_SECOND_PICKED' },
  { checkpoint: 'ISSUE', column: 'ISS_ACTL_DATE', field: 'issActlDate', stateId: 'ROLL_ISSUED' },
] as const
