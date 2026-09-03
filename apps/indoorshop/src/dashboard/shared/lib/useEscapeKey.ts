import { useEffect } from 'react'
import { hasEscapeClaims } from './escapeClaims'

/*
 * ESC 를 **문서 레벨에서** 받는 한 자리.
 *
 * 화면마다 ESC 청취를 따로 달다 보니 조건이 제각각으로 붙었다 — 어떤 것은 커서가 그
 * 위에 있어야(`:hover`), 어떤 것은 이미 무언가를 고른 뒤여야 반응했다. 그 결과 **딥링크로
 * 새로 연 화면에서 첫 ESC 가 먹지 않는다**: 아직 아무 데도 클릭하지 않았고 커서도 지나간
 * 적이 없으니 조건이 하나도 참이 아니다. 키보드로 들어온 사람에게 "먼저 마우스를 올려
 * 보라"고 요구하는 셈이다.
 *
 * 그래서 ESC 만은 조건 없이 document 에 건다. 대신 앱 전체가 지키던 예의는 그대로다:
 *  - 글자를 치는 중이면 삼킨다(검색창의 ESC 는 드롭다운 몫이다)
 *  - 이미 처리된 이벤트(`defaultPrevented`)는 건드리지 않는다
 *  - 위에 오버레이가 떠 있으면(`escapeClaims`) 그쪽이 먼저다 — 한 번에 한 동작
 *  - 이 자리가 소비했으면 `preventDefault` 로 못을 박는다
 *
 * 다른 단축키(+·-·1/3/7 …)는 여전히 화면 조건을 붙여도 된다 — 그것들은 "지금 보고 있는
 * 것"에 거는 조작이고, ESC 는 "여기서 나가겠다"는 전역 의사표시다.
 */

/** 지금 글자를 치고 있는 자리인가 — 그 ESC 는 입력의 몫이다 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.closest('[contenteditable="true"], [role="textbox"], [role="combobox"]') != null
}

/**
 * 이 ESC 가 지금 여기서 처리되어도 되는가 — 위 네 규칙의 앞 세 개.
 * (네 번째 `preventDefault` 는 소비가 확정된 뒤의 일이라 훅이 한다.)
 */
export function shouldHandleEscape(event: KeyboardEvent): boolean {
  if (event.key !== 'Escape' || event.defaultPrevented) return false
  if (isTypingTarget(event.target)) return false
  return !hasEscapeClaims()
}

export interface EscapeKeyOptions {
  /** 거짓이면 아무것도 걸지 않는다 (조건부 훅을 만들지 않으려는 자리용) */
  enabled?: boolean
}

/**
 * 문서 어디서든 ESC 를 받는다.
 *
 * `handler` 가 `false` 를 돌려주면 **이번 ESC 를 안 먹은 것**으로 치고 그대로 흘려보낸다
 * — 뒤에 선 다른 청취자(더 바깥 단계)가 이어받을 수 있게. 아무것도(또는 true 를)
 * 돌려주면 소비로 보고 `preventDefault` 한다.
 */
export function useEscapeKey(
  handler: () => boolean | void,
  { enabled = true }: EscapeKeyOptions = {}
): void {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!shouldHandleEscape(event)) return
      if (handler() === false) return
      event.preventDefault()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [handler, enabled])
}
