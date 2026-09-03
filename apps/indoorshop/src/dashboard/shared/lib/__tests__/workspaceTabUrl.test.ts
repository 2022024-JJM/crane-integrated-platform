import { describe, expect, it } from 'vitest'
import {
  carryWorkspaceTab,
  VIEWER_TAB,
  WORKSPACE_TAB_PARAM,
  withWorkspaceTab,
  workspaceTabOf,
} from '../workspaceTabUrl'

/**
 * 착지 탭 URL 계약 (R28).
 *
 * 링크가 자기 도착지를 말하게 하는 한 겹이다. 여기서 잠그는 것은 두 가지 — **모르는 값에
 * 화면을 빈 칸으로 세우지 않는다**(null 이면 화면이 제 기본 탭에 그대로 선다), 그리고
 * **남의 쿼리를 밀어내지 않는다**(선택 승계 `?block=` 과 나란히 실린다).
 */
const TABS = ['status', 'viewer', 'blocks'] as const

describe('workspaceTabOf — URL 이 말한 축을 알아본다', () => {
  it('이 화면이 가진 축이면 그 축이다', () => {
    expect(workspaceTabOf('viewer', TABS)).toBe('viewer')
    expect(workspaceTabOf('status', TABS)).toBe('status')
  })

  it('모르는 값·빈 값은 null — 없는 탭을 지어내지 않는다', () => {
    expect(workspaceTabOf('air', TABS)).toBeNull()
    expect(workspaceTabOf('', TABS)).toBeNull()
    expect(workspaceTabOf(null, TABS)).toBeNull()
    expect(workspaceTabOf(undefined, TABS)).toBeNull()
  })

  it('화면마다 축 목록이 다르다 — 판정은 부르는 화면의 목록이 한다', () => {
    /* 도장 공장 현황의 축 — 조립의 `viewer` 는 여기 없는 철자다 */
    expect(workspaceTabOf('viewer', ['status', 'view', 'factory'])).toBeNull()
    expect(workspaceTabOf('view', ['status', 'view', 'factory'])).toBe('view')
  })
})

describe('withWorkspaceTab — 남의 쿼리를 밀어내지 않는다', () => {
  it('쿼리가 없으면 `?`, 있으면 `&` 로 이어 붙인다', () => {
    expect(withWorkspaceTab('/indoorshop/zones/assembly/asm-pbs', VIEWER_TAB)).toBe(
      `/indoorshop/zones/assembly/asm-pbs?${WORKSPACE_TAB_PARAM}=${VIEWER_TAB}`
    )
    expect(withWorkspaceTab('/indoorshop/zones/assembly/asm-pbs?block=2540-283', VIEWER_TAB)).toBe(
      `/indoorshop/zones/assembly/asm-pbs?block=2540-283&${WORKSPACE_TAB_PARAM}=${VIEWER_TAB}`
    )
  })

  it('선택 승계는 그대로 남는다 — 두 파라미터가 같이 실린다', () => {
    const href = withWorkspaceTab('/indoorshop/zones/outfitting/ofit-bos1/x?block=7004-530', VIEWER_TAB)
    const query = new URLSearchParams(href.split('?')[1])
    expect(query.get('block')).toBe('7004-530')
    expect(query.get(WORKSPACE_TAB_PARAM)).toBe(VIEWER_TAB)
  })
})

/**
 * 승계 (R30) — **화면 안 이동은 보던 축을 유지한다.**
 *
 * R28 이 링크에 도착지를 실어 준 뒤에도, 화면 **안**에서 일어나는 이동(3D 뷰어의
 * 공장→베이 드릴, 베이→공장 복귀, 베이 간 이동)은 경로만 갈아 끼우고 `?tab=` 을 두고
 * 갔다. 그래서 3D 를 보다 정반을 누르면 도착 화면이 현황으로 서고 몰입이 끊겼다.
 */
describe('carryWorkspaceTab — 화면 안 이동은 보던 축을 유지한다', () => {
  it('지금 축을 다음 자리에 그대로 싣는다 (공장 → 베이 드릴)', () => {
    expect(carryWorkspaceTab('/indoorshop/zones/assembly/asm-pbs/pbs-5bay', VIEWER_TAB)).toBe(
      `/indoorshop/zones/assembly/asm-pbs/pbs-5bay?${WORKSPACE_TAB_PARAM}=${VIEWER_TAB}`
    )
  })

  it('기본 탭(주소에 키가 없다)이면 승계할 것이 없다 — 경로를 건드리지 않는다', () => {
    for (const current of [null, undefined, '']) {
      expect(carryWorkspaceTab('/indoorshop/zones/assembly/asm-pbs', current)).toBe('/indoorshop/zones/assembly/asm-pbs')
    }
  })

  it('링크가 이미 제 도착지를 말했으면 그 말이 먼저다 — 승계가 덮지 않는다', () => {
    const said = `/indoorshop/zones/assembly/asm-pbs?${WORKSPACE_TAB_PARAM}=blocks`
    expect(carryWorkspaceTab(said, VIEWER_TAB)).toBe(said)
  })

  it('남의 쿼리는 그대로 실려 간다 (선택 승계 `?block=` 과 공존)', () => {
    const href = carryWorkspaceTab('/indoorshop/zones/outfitting/ofit-bos1/x?block=7004-530', VIEWER_TAB)
    const query = new URLSearchParams(href.split('?')[1])
    expect(query.get('block')).toBe('7004-530')
    expect(query.get(WORKSPACE_TAB_PARAM)).toBe(VIEWER_TAB)
  })

  it('판정은 도착 화면의 몫이다 — 모르는 값도 원값 그대로 나른다', () => {
    /* 여기서 한 번 더 거르면 유효 축의 판정이 두 곳으로 갈린다.
       실어 보내도 도착 화면은 `workspaceTabOf` 로 걸러 제 기본 탭에 그대로 선다. */
    expect(carryWorkspaceTab('/z', 'air')).toBe(`/z?${WORKSPACE_TAB_PARAM}=air`)
    expect(workspaceTabOf('air', TABS)).toBeNull()
  })
})
