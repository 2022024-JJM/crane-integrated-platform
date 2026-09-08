import { describe, expect, it } from 'vitest'
import { EQUIPMENT_TYPES, equipmentTypeOf } from '../..'
import { colorOfType } from '../EquipmentSymbol'
import { equipmentTypeColorOf, hasEquipmentTypeColor } from '../typeColor'
import { STATUS_HEX } from '../../../../ui/statusPalette'

/*
 * 종류 **표시색** — 색을 넣은 뜻이 살아 있는가.
 *
 * 배치도에 종류색을 넣은 이유는 하나다: 12px 심볼에서 라이다·캐비닛·Edge PC 가 갈려야
 * 한다는 것. 레지스트리 값 그대로는 캐비닛(#37474f)과 Edge PC(#5d6d7e)가 둘 다 채도
 * 낮은 청회색이라 같은 회색 상자로 보였다 — 색은 넣었는데 아무것도 안 갈리는 상태였다.
 */

/** #rrggbb → 상대 휘도 (WCAG) */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** 두 색이 눈에 갈리는가 — RGB 채널 합의 거리로 거칠게 본다 */
function distance(a: string, b: string): number {
  const ch = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const [x, y] = [ch(a), ch(b)]
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

/** 다크 관제 화면의 바탕 (`globals.css` 의 `--surface`) */
const DARK_SURFACE = '#23262c'

describe('종류 표시색 — 갈려야 색이다', () => {
  it('캐비닛과 Edge PC 가 서로 갈린다 (레지스트리 값은 둘 다 청회색이었다)', () => {
    const registryGap = distance(equipmentTypeOf('PNL')!.color, equipmentTypeOf('EDGE')!.color)
    const shownGap = distance(equipmentTypeColorOf('PNL'), equipmentTypeColorOf('EDGE'))
    expect(registryGap).toBeLessThan(80)
    expect(shownGap).toBeGreaterThan(120)
  })

  it('라이다와도 갈린다 — 한 배치도에 셋이 함께 선다', () => {
    const lidar = equipmentTypeColorOf('LIDAR')
    expect(distance(lidar, equipmentTypeColorOf('PNL'))).toBeGreaterThan(120)
    expect(distance(lidar, equipmentTypeColorOf('EDGE'))).toBeGreaterThan(80)
  })

  /* 캐비닛은 바탕에 잠겨 있었다(1.6:1). Edge PC 는 잠기지는 않았고 캐비닛과 안 갈렸다 */
  it('어두운 바탕에서 판이 뜬다 — 캐비닛은 잠겨 있었다', () => {
    expect(contrast(equipmentTypeOf('PNL')!.color, DARK_SURFACE)).toBeLessThan(2)
    for (const typeId of ['PNL', 'EDGE', 'LIDAR']) {
      expect(contrast(equipmentTypeColorOf(typeId), DARK_SURFACE)).toBeGreaterThan(2.4)
    }
  })

  /* 판 위에는 흰 글리프가 얹힌다 — 판이 밝아지면 그림이 사라진다 */
  it('흰 글리프가 판 위에서 살아남는다', () => {
    for (const typeId of ['PNL', 'EDGE', 'LIDAR']) {
      expect(contrast(equipmentTypeColorOf(typeId), '#ffffff')).toBeGreaterThan(3)
    }
  })

  /* 상태색은 `statusPalette` 의 뜻이다 — 종류색이 그 자리를 넘보면 뜻이 겹친다 */
  it('상태색을 종류색으로 쓰지 않는다', () => {
    for (const [typeId] of [['PNL'], ['EDGE']]) {
      for (const hex of Object.values(STATUS_HEX.dark)) {
        expect(distance(equipmentTypeColorOf(typeId), hex)).toBeGreaterThan(60)
      }
    }
  })
})

describe('종류 표시색 — 레지스트리와의 관계', () => {
  it('따로 정하지 않은 종류는 레지스트리 색 그대로다 (없는 색을 지어내지 않는다)', () => {
    for (const type of EQUIPMENT_TYPES) {
      if (hasEquipmentTypeColor(type.id)) continue
      expect(equipmentTypeColorOf(type.id)).toBe(type.color)
    }
  })

  it('모르는 종류도 색이 있다 — 빈칸을 남기지 않는다', () => {
    expect(equipmentTypeColorOf('없는종류')).toMatch(/^#[0-9a-f]{6}$/i)
  })

  /* 화면이 여기 한 곳만 부르므로 지도 심볼·목록 칩·범례가 늘 같은 색으로 선다 */
  it('화면이 부르는 `colorOfType` 이 이 층을 지난다', () => {
    for (const type of EQUIPMENT_TYPES) {
      expect(colorOfType(type.id)).toBe(equipmentTypeColorOf(type.id))
    }
  })
})
