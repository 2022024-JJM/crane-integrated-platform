import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useDrilldownEscape } from '../useDrilldownEscape'
import { DrawingViewerModal } from '../../features/drawing-viewer'

/*
 * ESC 는 **한 번에 한 가지만** 한다 — W7-6C 조작 문법 통일의 적대적 검증(W7-6V).
 *
 * `useDrilldownEscape` 는 document 에 ESC 를 걸고 "한 단계 위"로 올린다. 화면 안에서
 * ESC 를 이미 쓰던 것들(도면 모달·팝오버·뷰어 선택 해제)과 같은 키를 나눠 쓰므로,
 * 안쪽이 ESC 를 먹었으면 바깥은 가만히 있어야 한다. `useDrilldownEscape` 는 그 신호를
 * `event.defaultPrevented` 로 읽는다 — 즉 **안쪽이 preventDefault() 를 불러 줘야** 한다.
 *
 * ⚠️ **미해소 (W7-6V 반박)** — 안쪽 청취자들이 preventDefault() 를 부르지 않아서, ESC 한
 * 번에 두 가지가 함께 일어난다. 확인된 자리 셋:
 *   · `DrawingViewerModal` (drawing-viewer/ui/DrawingViewerModal.tsx L82) — 조립 설비 패널
 *     `EquipmentInventoryPanel` 과 의장 맵 진입 `OutfittingMapEntry` 안에서 열린다. 둘 다
 *     `useDrilldownEscape` 가 살아 있는 화면이다(ProcessMapEntry.tsx L360).
 *   · `useDismissable` (lib/useDismissable.ts L22) — 헤더의 `AlarmMenu`·`UserMenu`. 헤더는
 *     `LayoutWrapper` 라 지도 화면 위에도 늘 떠 있다.
 *
 * **수리됨 (W7-6C)** — 두 갈래를 다 했다: 안쪽 청취자(모달·useDismissable·드로어·뷰어)가
 * `event.preventDefault()` 를 부르고, 리스너 순서에 기대지 않도록 오버레이가 열려 있는
 * 동안 ESC 우선권 장부(`shared/lib/escapeClaims`)에 등록한다 — `useDrilldownEscape` 는
 * 장부가 비어 있을 때만 움직인다.
 */

describe('ESC 는 한 번에 한 가지만 한다', () => {
  it('도면 모달이 열려 있을 때 ESC 는 모달만 닫는다 (드릴다운은 그대로)', () => {
    const up = vi.fn()
    const onClose = vi.fn()

    function Screen() {
      useDrilldownEscape(up)
      return (
        <DrawingViewerModal
          src="/gbs.png"
          title="조립 5공장 (GBS)"
          subtitle="HOOP-HEC-EL-170808-00 · R0"
          width={1600}
          height={1131}
          onClose={onClose}
        />
      )
    }

    render(<Screen />)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose, '모달이 닫히지 않았다').toHaveBeenCalledTimes(1)
    expect(
      up,
      'ESC 한 번에 모달이 닫히고 드릴다운까지 한 단계 올라갔다 — 모달이 preventDefault() 를 부르지 않는다'
    ).not.toHaveBeenCalled()
  })

  it('모달이 닫힌 뒤의 ESC 는 드릴다운 몫이다 — 우선권이 새어 남지 않는다', () => {
    const up = vi.fn()

    function Screen({ open }: { open: boolean }) {
      useDrilldownEscape(up)
      return open ? (
        <DrawingViewerModal
          src="/gbs.png"
          title="조립 5공장 (GBS)"
          subtitle="HOOP-HEC-EL-170808-00 · R0"
          width={1600}
          height={1131}
          onClose={() => {}}
        />
      ) : null
    }

    const view = render(<Screen open />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(up).not.toHaveBeenCalled()

    /* 모달이 내려가면(언마운트) 우선권도 함께 놓여야 한다 — 안 놓이면 ESC 가 영영 죽는다 */
    view.rerender(<Screen open={false} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(up).toHaveBeenCalledTimes(1)
  })
})
