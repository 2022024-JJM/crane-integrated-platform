import { createInstance } from 'i18next'
import { describe, expect, it } from 'vitest'
import { ko } from '../../../../shared/lib/i18n/locales/ko'
import { fabricationKo } from '../../i18n/ko'
import { CHECKPOINT_ORDER, ROLL_CHECKPOINTS, codeLabel, ptnHead, stateLabel } from '../labels'

/*
 * 앱의 i18n 설정(`shared/lib/i18n/config`)은 import 시점에 document 를 만진다 — node 환경
 * 테스트에서는 같은 리소스로 별도 인스턴스를 세운다.
 */
const i18n = createInstance()
await i18n.init({
  lng: 'ko',
  fallbackLng: 'ko',
  resources: { ko: { translation: { ...ko, ...fabricationKo } } },
  interpolation: { escapeValue: false },
  returnNull: false,
})

/**
 * 코드값 → 문구 규칙 — 모르는 코드는 **코드 그대로** 보여야 한다.
 * 데이터를 대조하는 화면에서 빈칸이나 번역 키 문자열은 곧 잘못된 데이터로 읽힌다.
 */
describe('코드 라벨', () => {
  const t = i18n.getFixedT('ko')

  it('사전에 있는 코드는 문구로, 없는 코드는 코드 그대로', () => {
    expect(codeLabel(t, i18n, 'checkpoint', 'RECEIVING')).toBe('입고')
    expect(codeLabel(t, i18n, 'stus', '9')).toBe('반출(전처리)')
    expect(codeLabel(t, i18n, 'stus', '5')).toBe('5')
    expect(codeLabel(t, i18n, 'event', 'SOMETHING_NEW')).toBe('SOMETHING_NEW')
  })

  it('빈 코드는 공통 빈값 표기로', () => {
    expect(codeLabel(t, i18n, 'workClsf', null)).toBe('—')
    expect(codeLabel(t, i18n, 'workClsf', '')).toBe('—')
  })

  it('상태 id 는 fabrication.yml 이름으로 풀고, 사전에 없으면 id 그대로', () => {
    const states = [{ stateId: 'ROLL_RECEIVED', name: '강재 입고', terminal: false }]
    expect(stateLabel(states, 'ROLL_RECEIVED', '—')).toBe('강재 입고')
    expect(stateLabel(states, 'GONE_STATE', '—')).toBe('GONE_STATE')
    expect(stateLabel(states, null, '—')).toBe('—')
  })

  it('PTN_CLSF 는 1글자째가 작업 구분이다', () => {
    expect(ptnHead('O31')).toBe('O')
    expect(ptnHead('H55')).toBe('H')
  })

  it('절점 순서는 공정 흐름을 따르고 ROLL 대조표는 ROLL 축 4절점만 갖는다', () => {
    expect(CHECKPOINT_ORDER).toEqual(['RECEIVING', 'FIRST_PICK', 'SECOND_PICK', 'ISSUE', 'CUTTING'])
    expect(ROLL_CHECKPOINTS.map((step) => step.checkpoint)).toEqual(['RECEIVING', 'FIRST_PICK', 'SECOND_PICK', 'ISSUE'])
    /* 대조표의 기반 컬럼명은 legacy_sty01c 의 실제 컬럼이다 */
    expect(ROLL_CHECKPOINTS.map((step) => step.column)).toEqual([
      'ACPT_DATE',
      'FRST_PICK_ACTL_DATE_1',
      'SCND_PICK_ACTL_DATE',
      'ISS_ACTL_DATE',
    ])
  })
})
