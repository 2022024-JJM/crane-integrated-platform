import { beforeAll, describe, expect, it } from 'vitest'
import i18n from '../../../../shared/lib/i18n/config'
import { addProcessMessages } from '../../../../shared/lib/testing/processMessages'
import { paintingKo } from '../../i18n/ko'
import { paintingEn } from '../../i18n/en'
import { createBayLabelCard, type BayLabelData } from '../bayLabel'

addProcessMessages(paintingKo, paintingEn)

/**
 * 베이 라벨 — **화면에 베이 정보가 나온다** (R38).
 *
 * 사용자 지적의 절반이 이것이었다: 큐브만 있고 "베이 정보도 나와야 하지 않겠냐". 라벨은
 * CSS2D(=DOM)라 3D 없이도 그대로 검사할 수 있다 — 그래서 무엇을 적는지를 여기서 잠근다.
 */

const BASE: BayLabelData = {
  bay: 'B3',
  label: 'B3BAY',
  mode: 'mixed',
  runningCount: 2,
  unitCount: 3,
  env: { tempC: 21.5, tempSetpoint: 26, humidityRh: 58, humiditySetpoint: 45 },
  occupants: [{ key: '2543-141', projNo: '2543', blockNo: '141', justArrived: false }],
  selected: false,
}

const t = i18n.t.bind(i18n)

/* 이 테스트는 문구를 직접 읽는다 — 언어를 고정해야 무엇을 보는지 분명하다 */
beforeAll(async () => {
  await i18n.changeLanguage('ko')
})

describe('라벨이 적는 것', () => {
  it('베이 이름을 적는다', () => {
    const card = createBayLabelCard(BASE, t)
    expect(card.element.textContent).toContain('B3BAY')
  })

  it('환경 수치를 적는다 — 실측과 목표를 함께', () => {
    const card = createBayLabelCard(BASE, t)
    const text = card.element.textContent ?? ''
    expect(text).toContain('21.5')
    expect(text).toContain('58')
    expect(text).toContain('26')
    expect(text).toContain('45')
  })

  it('가동 대수를 적는다', () => {
    const card = createBayLabelCard(BASE, t)
    expect(card.element.textContent).toContain('2/3')
  })

  it('재실 블록을 적는다 — 한 장이면 그 블록을', () => {
    const card = createBayLabelCard(BASE, t)
    expect(card.element.textContent).toContain('2543-141')
  })

  it('재실이 여럿이면 장수로 접는다 — 카드가 목록이 되면 겹친다', () => {
    const card = createBayLabelCard(
      {
        ...BASE,
        occupants: [
          { key: '2543-141', projNo: '2543', blockNo: '141', justArrived: false },
          { key: '2543-660', projNo: '2543', blockNo: '660', justArrived: true },
        ],
      },
      t
    )
    expect(card.element.textContent).toContain('2')
    expect(card.element.textContent).not.toContain('2543-660')
  })

  it('값을 못 받았으면 0 을 적지 않는다 — 없다고 말한다', () => {
    const card = createBayLabelCard(
      {
        ...BASE,
        env: { tempC: null, tempSetpoint: null, humidityRh: null, humiditySetpoint: null },
      },
      t
    )
    expect(card.element.textContent).toContain('값 없음')
  })

  it('설비가 없는 베이는 그렇다고 말한다', () => {
    const card = createBayLabelCard(
      { ...BASE, mode: null, unitCount: 0, runningCount: 0 },
      t
    )
    expect(card.element.textContent).toContain('설비 없음')
  })
})

describe('라벨은 다시 만들지 않고 값만 갈아 끼운다', () => {
  it('update 뒤 같은 DOM 노드에 새 값이 적힌다', () => {
    const card = createBayLabelCard(BASE, t)
    const before = card.element
    card.update({ ...BASE, runningCount: 0, env: { ...BASE.env, tempC: 30 } }, t)
    expect(card.element).toBe(before)
    expect(card.element.textContent).toContain('0/3')
    expect(card.element.textContent).toContain('30')
  })
})

describe('선택과 겹침', () => {
  it('카드는 버튼이다 — 3D 위에서 키보드로도 베이를 고를 수 있어야 한다', () => {
    const card = createBayLabelCard(BASE, t)
    expect(card.element.firstElementChild?.tagName).toBe('BUTTON')
  })

  it('누르면 그 베이를 고른다', () => {
    let picked: string | null = null
    const card = createBayLabelCard(BASE, t, () => {
      picked = BASE.bay
    })
    ;(card.element.firstElementChild as HTMLButtonElement).click()
    expect(picked).toBe('B3')
  })

  it('카드가 이벤트를 받는다 — 감싸개가 pointer-events 를 끄므로 카드가 스스로 켠다', () => {
    const card = createBayLabelCard(BASE, t, () => {})
    const button = card.element.firstElementChild as HTMLElement
    expect(button.style.pointerEvents).toBe('auto')
    expect(button.style.cursor).toBe('pointer')
  })

  it('멀리서는 한 줄로 접는다 — 수치가 옆 카드를 덮지 않게', () => {
    const card = createBayLabelCard(BASE, t)
    card.setCompact(true)
    expect(card.element.textContent).toContain('B3BAY')
    const rows = [...(card.element.firstElementChild?.children ?? [])]
    expect(rows.filter((row) => (row as HTMLElement).style.display === 'none')).toHaveLength(2)
    card.setCompact(false)
    expect(
      [...(card.element.firstElementChild?.children ?? [])].filter(
        (row) => (row as HTMLElement).style.display === 'none'
      )
    ).toHaveLength(0)
  })

  it('가동 중인 베이가 정지한 베이 위로 온다 — 겹쳐서 가려지면 안 된다', () => {
    const running = createBayLabelCard(BASE, t)
    const idle = createBayLabelCard({ ...BASE, runningCount: 0, mode: 'idle' }, t)
    expect(Number(running.element.style.zIndex)).toBeGreaterThan(
      Number(idle.element.style.zIndex)
    )
  })
})
