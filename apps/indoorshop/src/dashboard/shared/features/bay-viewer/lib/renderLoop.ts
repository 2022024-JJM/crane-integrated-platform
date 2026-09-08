import { nowMs } from '../../../lib/now'
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
 * ⚠️ **손이 닿아 있는 동안은 절전을 하지 않는다.** 위 규칙 1(`controls.update()` 가
 * 움직였다고 답한 프레임만 그린다)은 절전에는 맞지만 **반응성에는 위험한 가정**이다 —
 * 드래그 중에도 카메라가 안 움직이는 프레임이 있다(극각·거리 한계에 걸린 순간, 포인터가
 * 멈춘 순간, 이벤트가 한 프레임 늦게 도착한 순간). 그 프레임을 건너뛰면 손은 움직이는데
 * 화면이 한 박자 늦게 따라오는, 정확히 '끊긴다'고 느끼는 그림이 된다.
 *
 * 그래서 조작이 시작되면(`setInteracting(true)`) 그 동안은 **모든 프레임을 무조건**
 * 그린다. 조작이 끝나면 유예(관성 감쇠가 잦아들 시간)를 다시 열고, 그 뒤에야 0fps 로
 * 내려간다. 절전은 손을 뗀 뒤의 이야기다.
 *
 * ⚠️ **빈 화면으로 서 있지 않는다 (P0).** 예전에는 이 셋이 전부 `requestAnimationFrame`
 * 한 갈래에 매달려 있었다 — 루프는 만들어질 때 `document.hidden` 을 한 번 보고 시작
 * 여부를 정했고, `requestRender()` 는 `pending` 만 켤 뿐 **잠든 루프를 깨우지 못했다.**
 * 그래서 그 한 번의 판정이 어긋나면(창이 다른 창에 완전히 가려진 순간에 마운트되거나,
 * 백그라운드로 복원된 탭이거나, rAF 가 얼어 있는 환경) 씬도 자산도 멀쩡한데 캔버스만
 * **영영 검은 채로** 남았다. 살릴 계기가 `visibilitychange` 하나뿐이었기 때문이다.
 *
 * 이제 루프는 두 갈래로 깨어난다:
 *  - 보이면 → rAF 루프를 다시 돌린다.
 *  - 숨어 있으면 → 루프는 재우되 **타이머로 딱 한 장** 갚는다(`catchUpMs`).
 * 어느 쪽이든 "요청했는데 아무것도 안 그려지는" 상태가 없다. 숨은 탭이 초당 60장을
 * 그리는 일은 여전히 없고(요청 한 묶음당 최대 한 장), 그 한 장의 값이 검은 화면을 없앤다.
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
  /**
   * 숨어 있는 동안 밀린 요청을 갚는 지연(ms). 이때는 rAF 루프를 돌리지 않고 한 장만 그린다
   * — rAF 는 숨은 탭에서 얼어 있으므로 타이머여야 한다.
   */
  catchUpMs?: number
  now?: () => number
  requestFrame?: (callback: () => void) => number
  cancelFrame?: (handle: number) => void
  setTimer?: (callback: () => void, ms: number) => number
  clearTimer?: (handle: number) => void
  /** 가시성 소스 — 없으면 늘 보이는 것으로 본다(문서가 없는 환경) */
  visibility?: {
    isHidden: () => boolean
    subscribe: (listener: () => void) => () => void
  }
}

export interface RenderLoopHandle {
  /**
   * 반드시 한 장 그린다 (그리고 유예 시간을 다시 연다).
   * 잠들었거나 아예 시작하지 못한 루프도 이 호출로 깨어난다 — 씬 준비·자산 도착·탭
   * 활성·리사이즈가 전부 이 문을 지난다.
   */
  requestRender: () => void
  /**
   * 조작 중 표시 — `true` 인 동안 **매 프레임 그린다**(유휴 판정을 아예 하지 않는다).
   * 포인터를 누른 순간 켜고 뗀 순간 끄면 된다(OrbitControls 의 `start`/`end`).
   * 끄면 그 시점부터 유예가 다시 열려 관성 감쇠가 끝까지 그려진다.
   */
  setInteracting: (active: boolean) => void
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
    catchUpMs = 200,
    now = nowMs,
    requestFrame = (cb) => requestAnimationFrame(cb),
    cancelFrame = (handle) => cancelAnimationFrame(handle),
    setTimer = (cb, ms) => setTimeout(cb, ms) as unknown as number,
    clearTimer = (handle) => clearTimeout(handle),
    visibility = documentVisibility(),
  } = options

  let handle: number | null = null
  let timer: number | null = null
  let stopped = false
  let pending = true // 첫 장은 무조건 그린다
  let interacting = false // 손이 닿아 있는 동안은 유휴 판정을 하지 않는다
  let lastActivity = now()
  let rendered = 0

  const markActive = () => {
    lastActivity = now()
  }

  const drawOnce = () => {
    pending = false
    rendered += 1
    render()
  }

  function frame() {
    if (stopped) return
    handle = requestFrame(frame)

    /* 댐핑을 진행시키려면 그리지 않는 프레임에도 update() 는 불러야 한다 */
    const moved = controls.update()
    if (moved) markActive()

    if (interacting || moved || pending || now() - lastActivity < graceMs) drawOnce()
  }

  const clearCatchUp = () => {
    if (timer !== null) {
      clearTimer(timer)
      timer = null
    }
  }

  /** 숨어 있는 동안의 요청 — 루프는 재우고 딱 한 장만 갚는다 (요청이 몰려도 한 장) */
  const scheduleCatchUp = () => {
    if (stopped || timer !== null) return
    timer = setTimer(() => {
      timer = null
      /* 그 사이 루프가 다시 돌기 시작했으면 그쪽이 그린다 */
      if (stopped || handle !== null) return
      drawOnce()
    }, catchUpMs)
  }

  const pause = () => {
    if (handle !== null) {
      cancelFrame(handle)
      handle = null
    }
  }

  /**
   * 잠든 루프를 깨운다 — **모든 계기(씬 준비·자산 도착·탭 활성·리사이즈)가 지나는 문**.
   * 보이면 rAF 루프를 다시 돌리고, 숨어 있으면 한 장만 갚는다.
   */
  const wake = () => {
    if (stopped || handle !== null) return
    if (visibility?.isHidden()) {
      scheduleCatchUp()
      return
    }
    clearCatchUp()
    frame()
  }

  const unsubscribe =
    visibility?.subscribe(() => {
      if (visibility.isHidden()) pause()
      else {
        /* 다시 보이면 한 장은 그려서 되돌린다 */
        pending = true
        markActive()
        wake()
      }
    }) ?? (() => {})

  wake()

  return {
    requestRender: () => {
      pending = true
      markActive()
      wake()
    },
    setInteracting: (active: boolean) => {
      interacting = active
      /*
       * 손을 뗀 순간에도 유예를 다시 연다 — 감쇠가 남아 있으면 그 동안 계속 그려야
       * 관성이 뚝 끊기지 않는다. 손을 댄 순간에는 잠든 루프를 깨우는 일이 겸사겸사다.
       */
      markActive()
      if (active) wake()
    },
    stop: () => {
      stopped = true
      pause()
      clearCatchUp()
      unsubscribe()
    },
    renderedFrames: () => rendered,
  }
}
