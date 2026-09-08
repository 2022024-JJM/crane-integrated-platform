import type { TFunction } from 'i18next'
import type { BayAirMode, BayEnv } from '../lib/airEffect'
import type { BayOccupant } from '../lib/bayScene'
import { DEHUMIDIFIER, GAS_HEATER } from './equipmentIcon'

/*
 * 베이 라벨 — **3D 안에서 베이가 제 사정을 말한다** (R38).
 *
 * 조립 공장 뷰의 정반 라벨(`shared/features/bay-viewer/lib/labelCards` 의
 * `createBayStatusLabel`)과 **같은 말투**를 쓴다: 유리판 카드, 상태점 + 이름 + 코드 한 줄,
 * 그 아래 사정 한 줄, 카드 아래로 내려오는 지시선. 세 공정의 3D 가 같은 문법으로 말해야
 * 화면을 옮길 때 눈이 다시 배우지 않는다.
 *
 * 도장의 어휘로 채우는 것은 셋이다:
 *  · **환경 수치** — 온도(히터)·습도(제습기). 이 화면이 그리는 공기가 지금 몇 도, 몇 %인지.
 *  · **가동 대수** — 이 베이의 설비 몇 대가 지금 공기를 만들고 있는가.
 *  · **재실 블록** — BTS 귀속(로스터 `mapBay`)으로 이 베이에 서 있는 블록.
 *
 * ⚠️ 카드는 **한 번 만들고 값만 갈아 끼운다**(`update`). 폴링마다 라벨을 다시 만들면
 *    CSS2D 객체가 6초마다 씬에서 헐리고 다시 붙는다(그 되먹임이 화면을 검게 만들었던
 *    바로 그 문제다). 값 갱신은 React 밖 DOM 쓰기라 리렌더를 부르지 않는다.
 */

export interface BayLabelData {
  bay: string
  label: string
  /** 설비가 없는 베이는 null — 대기도 수치도 없다 */
  mode: BayAirMode | null
  runningCount: number
  unitCount: number
  env: BayEnv
  occupants: readonly BayOccupant[]
  selected: boolean
}

export interface BayLabelCard {
  element: HTMLElement
  update: (data: BayLabelData, t: TFunction) => void
  /**
   * 멀리서 볼 때는 **한 줄로 접는다.**
   *
   * 공장 하나가 한 화면에 들어오면 베이 열대여섯 면의 카드가 서로를 덮는다 — 그 상태의
   * 환경 수치는 읽히지도 않으면서 자리만 먹는다. 그래서 멀리서는 이름·가동 대수만 남기고,
   * 다가가면 수치와 재실이 돌아온다(가까이 가는 것이 곧 "이 베이를 보겠다"는 뜻이다).
   */
  setCompact: (compact: boolean) => void
}

/** 모드 → 상태점 색. 새 색을 정하지 않는다 — 지도·범례가 쓰는 설비색 그대로다 */
function modeColor(mode: BayAirMode | null): string {
  if (mode === 'heating') return GAS_HEATER
  if (mode === 'drying') return DEHUMIDIFIER
  if (mode === 'mixed') return `linear-gradient(135deg, ${GAS_HEATER} 50%, ${DEHUMIDIFIER} 50%)`
  return 'rgba(255,255,255,0.28)'
}

function modeText(mode: BayAirMode | null, t: TFunction): string {
  if (mode === 'heating') return t('painting.airView.bayMode.heating')
  if (mode === 'drying') return t('painting.airView.bayMode.drying')
  if (mode === 'mixed') return t('painting.airView.bayMode.mixed')
  if (mode === 'idle') return t('painting.airView.bayMode.idle')
  return t('painting.airView.bayMode.none')
}

/** 환경 한 줄 — 값이 없으면 0 을 적지 않고 '값 없음' 이라 말한다 */
function envText(data: BayLabelData, t: TFunction): string {
  if (data.unitCount === 0) return t('painting.airView.bayMode.none')
  const parts: string[] = []
  if (data.env.tempC != null) {
    const set =
      data.env.tempSetpoint != null
        ? ` (${t('painting.airView.bayEnvSet', { value: data.env.tempSetpoint })})`
        : ''
    parts.push(`${t('painting.airView.bayEnvTemp', { value: data.env.tempC })}${set}`)
  }
  if (data.env.humidityRh != null) {
    const set =
      data.env.humiditySetpoint != null
        ? ` (${t('painting.airView.bayEnvSet', { value: data.env.humiditySetpoint })})`
        : ''
    parts.push(`${t('painting.airView.bayEnvHumidity', { value: data.env.humidityRh })}${set}`)
  }
  return parts.length > 0 ? parts.join(' · ') : t('painting.airView.bayEnvNone')
}

/** 재실 블록 한 줄 — 한 장이면 그 블록을, 여럿이면 장수를 적는다 */
function occupantText(data: BayLabelData, t: TFunction): string {
  if (data.occupants.length === 0) return t('painting.airView.bayNoBlock')
  if (data.occupants.length === 1) {
    const one = data.occupants[0]
    const arrived = one.justArrived ? ` · ${t('painting.airView.bayArrived')}` : ''
    return `${t('painting.airView.bayBlockOne', { key: one.key })}${arrived}`
  }
  return t('painting.airView.bayBlockMany', { count: data.occupants.length })
}

const CARD_BASE =
  'flex flex-col items-stretch gap-0.5 whitespace-nowrap rounded-md glass-panel px-2 py-1 text-left transition-colors hover:bg-glass-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent'

/**
 * 라벨 카드 하나. `onClick` 을 주면 카드가 `<button>` 이 되어 **키보드로도** 베이를 고를
 * 수 있다 — 3D 위에서 라벨이 유일한 선택 수단이기 때문이다(조립 정반 라벨과 같은 이유).
 */
export function createBayLabelCard(
  data: BayLabelData,
  t: TFunction,
  onClick?: () => void
): BayLabelCard {
  const wrap = document.createElement('div')
  wrap.className = 'flex flex-col items-center'

  const card = document.createElement('button')
  card.type = 'button'
  card.className = CARD_BASE
  if (onClick) {
    /*
     * 카드만 이벤트를 받는다. 감싸개(`makeLabelObject` 가 pointer-events 를 끈다)는
     * 이벤트를 흘려보내야 지시선·여백 위에서 그대로 궤도 회전이 된다 — 라벨이 덮은
     * 면적에서 조작이 막히면 3D 가 라벨 그늘만큼 죽는다.
     */
    card.style.pointerEvents = 'auto'
    card.style.cursor = 'pointer'
    card.addEventListener('click', onClick)
  }

  const head = document.createElement('span')
  head.className = 'flex items-center gap-1.5'
  const dot = document.createElement('span')
  dot.setAttribute('aria-hidden', 'true')
  dot.className = 'h-1.5 w-1.5 shrink-0 rounded-full'
  const name = document.createElement('span')
  name.className = 'max-w-28 truncate text-xs font-semibold text-glass-foreground'
  const running = document.createElement('span')
  running.className = 'font-mono text-2xs tabular-nums text-glass-foreground/63'
  head.append(dot, name, running)

  const env = document.createElement('span')
  env.className = 'pl-3 text-2xs tabular-nums text-glass-foreground/75'

  const blocks = document.createElement('span')
  blocks.className = 'pl-3 text-2xs text-glass-foreground/63'

  card.append(head, env, blocks)

  const leader = document.createElement('div')
  leader.className = 'h-2.5 w-px bg-glass-accent/50'

  wrap.append(card, leader)

  const update = (next: BayLabelData, tr: TFunction) => {
    dot.style.background = modeColor(next.mode)
    name.textContent = next.label
    running.textContent =
      next.unitCount > 0
        ? tr('painting.airView.bayRunning', { running: next.runningCount, total: next.unitCount })
        : ''
    env.textContent = envText(next, tr)
    blocks.textContent = occupantText(next, tr)
    /* 이 카드가 무엇인지 한 문장으로 — 마우스를 얹거나 스크린리더로 들을 때 */
    card.title = `${next.label} · ${modeText(next.mode, tr)} · ${envText(next, tr)} · ${occupantText(next, tr)}`
    card.className = next.selected
      ? `${CARD_BASE} ring-1 ring-glass-accent`
      : CARD_BASE
    /* 가동 중인 베이가 겹침의 위로 — 정지한 면에 가려 "지금 도는 베이"가 안 보이면
     * 이 화면의 첫 번째 목적이 무너진다 (조립 정반 라벨의 zIndex 규칙과 같다) */
    wrap.style.zIndex = next.selected ? '3' : next.runningCount > 0 ? '2' : '1'
  }
  update(data, t)

  const setCompact = (compact: boolean) => {
    env.style.display = compact ? 'none' : ''
    blocks.style.display = compact ? 'none' : ''
  }

  return { element: wrap, update, setCompact }
}
