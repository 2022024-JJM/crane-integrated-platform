/**
 * 3D 뷰어의 **그리기 루프** — 놀 때는 쉬고, 안 보일 때는 멈춘다.
 *
 * 뷰어들은 지금까지 `requestAnimationFrame` 으로 **쉬지 않고** 그렸다. 아무도 손대지 않는
 * 정지 화면도, 탭이 뒤로 넘어가 보이지도 않는 화면도 초당 60번씩 GPU 를 돌린다 — 노트북
 * 팬이 돌고 배터리가 닳는 이유가 대개 이것이다.
 *
 * 규칙은 셋이고, **화면의 모습은 하나도 바뀌지 않는다**:
 *  1. 카메라가 움직였으면 그린다. `controls.update()` 는 지난 호출 이후 카메라(위치·방향·
 *     타깃·줌)가 바뀌었는지 **스스로 판정해 알려 준다** — 댐핑이 잦아드는 동안도, 코드가
 *     카메라를 직접 옮긴 경우도 여기에 잡힌다.
 *  2. 누가 `requestRender()` 로 요청했으면 그린다 (리사이즈·라벨 갱신·장면 변경).
 *  3. 마지막 변화로부터 **유예 시간** 동안은 계속 그린다. 우리가 미처 표시하지 못한
 *     변경(어딘가에서 재질 색을 바꾸는 코드 등)이 한 프레임 늦게 반영되는 사고를 막는
 *     안전망이다. 유예가 지나야 비로소 0fps 로 내려간다.
 *
 * 그리고 탭이 숨으면(`document.hidden`) 루프 자체를 멈춘다 — 보이지 않는 화면은 그릴
 * 이유가 없고, 다시 보이는 순간 한 장 그려서 되돌린다.
 *
 * 시계·rAF·document 를 전부 주입받는다 — 브라우저 없이(노드) 테스트하기 위해서다.
 */

/** 카메라 조작기 — `update()` 가 "이번 프레임에 카메라가 바뀌었나"를 답한다 */
export interface RenderLoopControls {
  update: () => boolean
}

export interface RenderLoopOptions {
  controls: RenderLoopControls
  /** 한 장 그리기 (renderer.render + labelRenderer.render) */
  render: () => void
  /**
   * 마지막 변화 뒤 이만큼(ms)은 계속 그린다 — 표시하지 못한 변경의 안전망.
   * 기본 400ms(≈24프레임): 사람이 알아채기 전에 반영되고, 노는 화면은 곧 0fps 로 내려간다.
   */
  graceMs?: number
  /* ── 주입 (테스트용) ── */
  now?: () => number
  requestFrame?: (callback: () => void) => number
  cancelFrame?: (handle: number) => void
  /** 가시성 소스 — 없으면 늘 보이는 것으로 본다(문서가 없는 환경) */
  visibility?: {
    isHidden: () => boolean
    subscribe: (listener: () => void) => () => void
  }
}

export interface RenderLoopHandle {
  /** 다음 프레임에 반드시 한 장 그린다 (그리고 유예 시간을 다시 연다) */
  requestRender: () => void
  /** 루프를 완전히 멈춘다 — 언마운트에서 부른다 */
  stop: () => void
  /** 지금까지 실제로 그린 장수 — 진단·테스트용 */
  renderedFrames: () => number
}

/** 브라우저의 document 가 있으면 그것을 가시성 소스로 쓴다 */
function documentVisibility(): RenderLoopOptions['visibility'] {
  if (typeof document === 'undefined') return undefined
  return {
    isHidden: () => document.hidden,
    subscribe: (listener) => {
      document.addEventListener('visibilitychange', listener)
      return () => document.removeEventListener('visibilitychange', listener)
    },
  }
}

export function startRenderLoop(options: RenderLoopOptions): RenderLoopHandle {
  const {
    controls,
    render,
    graceMs = 400,
    now = () => Date.now(),
    requestFrame = (cb) => requestAnimationFrame(cb),
    cancelFrame = (handle) => cancelAnimationFrame(handle),
    visibility = documentVisibility(),
  } = options

  let handle: number | null = null
  let stopped = false
  let pending = true // 첫 장은 무조건 그린다
  let lastActivity = now()
  let rendered = 0

  const markActive = () => {
    lastActivity = now()
  }

  function frame() {
    if (stopped) return
    handle = requestFrame(frame)

    /* 댐핑을 진행시키려면 그리지 않는 프레임에도 update() 는 불러야 한다 */
    const moved = controls.update()
    if (moved) markActive()

    if (moved || pending || now() - lastActivity < graceMs) {
      pending = false
      rendered += 1
      render()
    }
  }

  const pause = () => {
    if (handle !== null) {
      cancelFrame(handle)
      handle = null
    }
  }

  const resume = () => {
    if (stopped || handle !== null) return
    pending = true // 다시 보이면 한 장은 그려서 되돌린다
    markActive()
    frame()
  }

  const unsubscribe =
    visibility?.subscribe(() => {
      if (visibility.isHidden()) pause()
      else resume()
    }) ?? (() => {})

  if (!visibility?.isHidden()) frame()

  return {
    requestRender: () => {
      pending = true
      markActive()
      /* 숨어 있는 동안의 요청은 다시 보일 때 한 장으로 갚는다 — 지금 깨우지 않는다 */
    },
    stop: () => {
      stopped = true
      pause()
      unsubscribe()
    },
    renderedFrames: () => rendered,
  }
}
