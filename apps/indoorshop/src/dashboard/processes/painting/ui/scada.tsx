import { useState } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import type { PaintingEquipment, PaintingEquipmentKind } from '../model/equipment'
import {
  isStale,
  linkState,
  statusUnit,
  type PaintingEquipmentStatus,
} from '../model/equipmentStatus'
import { EquipmentChip, equipmentColor } from './equipmentIcon'

/*
 * ── 도장 설비의 산업 SCADA 'PLC 랙 패널' 룩 ──
 *
 * 참조: FTMS(FMCS) SCADA 관제 화면. 설비 1대 = 하드웨어 **모듈 카드**(종류 글리프 +
 * 세로 LED 램프열 + SP/PV 디지털 리드아웃 + ID 슬롯 칩), 공장 = **랙 섹션**(타이틀 바 +
 * 모듈 카드 정렬 + 지표 테이블). 다크 배경 + LED 점등 + 모노스페이스 수치 + 구획 테두리.
 *
 * 색은 앱 테마와 무관하게 **고정 다크 인더스트리얼**로 둔다 — 이 패널은 강제 다크 맵 위에
 * 떠서 항상 어두워야 SCADA 감성과 LED 대비가 산다(맵과 같은 규칙). LED 는 폴링 상태값을
 * 그대로 반영하므로 값이 바뀌면 램프가 함께 점등/소등된다.
 */

// ── 인더스트리얼 팔레트 ──
const PANEL_BG = '#0b1016'
const SECTION_BG = '#0e141c'
const CARD_BG = '#0d131a'
const INSET_BG = '#070b0f'
const STEEL = '#232f3c'
const STEEL_SOFT = 'rgba(255,255,255,0.06)'
const AMBER = '#e6a63c'
const CYAN = '#4fc3dd'
const TXT = '#c2cdd8'
const TXT_DIM = '#79848f'
const LED_GREEN = '#28d081'
const LED_RED = '#f24b4b'
const LED_AMBER = '#f0a92e'
const LED_OFF = '#2a3947'

type LedState = 'on' | 'off' | 'warn' | 'alarm'

function ledColor(state: LedState): string {
  return state === 'on'
    ? LED_GREEN
    : state === 'alarm'
      ? LED_RED
      : state === 'warn'
        ? LED_AMBER
        : LED_OFF
}

/** 상태 LED 램프 한 개 (라벨 우측) */
function Led({ label, state }: { label: string; state: LedState }) {
  const color = ledColor(state)
  const lit = state !== 'off'
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{
          background: color,
          border: `1px solid ${lit ? color : '#37434f'}`,
          boxShadow: lit
            ? `0 0 5px ${color}, 0 0 2px ${color}`
            : 'inset 0 0 2px rgba(0,0,0,0.7)',
        }}
      />
      <span
        className="font-mono text-[9px] font-medium tracking-wider"
        style={{ color: lit ? TXT : TXT_DIM }}
      >
        {label}
      </span>
    </div>
  )
}

/** LED 상태 산출 — 폴링 상태값 → 램프 (없으면 통신 두절로 본다) */
function ledStates(status: PaintingEquipmentStatus | undefined) {
  const link = status ? linkState(status.modbusLink) : 'offline'
  return {
    run: (status?.operatingMode ? 'on' : 'off') as LedState,
    link: (link === 'online' ? 'on' : link === 'error' ? 'alarm' : 'warn') as LedState,
    fault: ((status?.faultCode ?? 0) !== 0 ? 'alarm' : 'off') as LedState,
  }
}

/**
 * 상태 칩 — LED 점 + 사람이 읽는 말 한 단어. 상세의 램프열을 한 줄로 접는 컴팩트 표현.
 * 켜지면(lit) 점이 빛나고 글자가 서고, alarm 이면 칩이 붉게 맥동한다.
 */
function StatusPill({
  color,
  label,
  lit,
  alarm = false,
}: {
  color: string
  label: string
  lit: boolean
  alarm?: boolean
}) {
  const dot = lit ? color : LED_OFF
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[3px] px-1.5 py-[3px] ${alarm ? 'animate-pulse' : ''}`}
      style={{
        background: INSET_BG,
        border: `1px solid ${lit ? `${color}66` : STEEL}`,
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{
          background: dot,
          boxShadow: lit ? `0 0 5px ${color}, 0 0 2px ${color}` : 'inset 0 0 2px rgba(0,0,0,0.7)',
        }}
      />
      <span
        className="font-mono text-[9px] font-semibold tracking-wider"
        style={{ color: lit ? TXT : TXT_DIM }}
      >
        {label}
      </span>
    </span>
  )
}

/**
 * 설비 종류 라벨 키 — 카드·상세가 아이콘 옆에 "제습기/가스히터"를 사람이 읽는 말로
 * 붙일 때 쓴다 (범례와 같은 번역 키 = 지도 범례와 같은 표기).
 */
function kindLabelKey(kind: PaintingEquipmentKind) {
  return kind === '가스히터'
    ? ('painting.workspace.legend.gasHeater' as const)
    : ('painting.workspace.legend.dehumidifier' as const)
}

/** ID 슬롯 칩 — 랙 슬롯 번호 자리 */
function SlotChip({ id }: { id: string }) {
  return (
    <span
      className="rounded-[3px] px-1 py-px font-mono text-[9px] font-semibold tracking-wider"
      style={{ background: '#17212c', color: AMBER, border: `1px solid ${STEEL}` }}
    >
      {id}
    </span>
  )
}

/** SP/PV 미니 디지털 리드아웃 (LCD 인셋) */
function Readout({
  label,
  value,
  unit,
  tone = TXT,
}: {
  label: string
  value: string
  unit?: string
  tone?: string
}) {
  return (
    <div
      className="flex items-center justify-between gap-1 rounded-[3px] px-1.5 py-[3px]"
      style={{ background: INSET_BG, border: `1px solid ${STEEL}` }}
    >
      <span className="font-mono text-[8px] font-semibold tracking-wider" style={{ color: TXT_DIM }}>
        {label}
      </span>
      <span className="font-mono text-[10px] font-semibold tabular-nums" style={{ color: tone }}>
        {value}
        {unit && <span style={{ color: TXT_DIM }}> {unit}</span>}
      </span>
    </div>
  )
}

/** 섹션 타이틀 바 (랙 섹션 헤더) */
function SectionHeader({
  title,
  meta,
  accent = AMBER,
  badge,
}: {
  title: string
  meta?: string
  accent?: string
  badge?: React.ReactNode
}) {
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5"
      style={{
        background: 'linear-gradient(180deg,#17212d,#121a24)',
        borderBottom: `1px solid ${STEEL}`,
      }}
    >
      <span
        className="h-3 w-[3px] shrink-0 rounded-inshop-sm"
        style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
      />
      <span
        className="truncate font-mono text-[11px] font-semibold tracking-wider"
        style={{ color: accent }}
      >
        {title}
      </span>
      {badge}
      {meta && (
        <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums" style={{ color: TXT_DIM }}>
          {meta}
        </span>
      )}
    </div>
  )
}

/** 조밀한 인더스트리얼 지표 테이블 (라벨 좌 · 값 우) */
function MetricsTable({
  title,
  rows,
}: {
  title: string
  rows: { label: string; value: React.ReactNode; tone?: string }[]
}) {
  return (
    <div style={{ borderBottom: `1px solid ${STEEL}` }}>
      <div
        className="px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: CYAN, background: '#0c131b', borderBottom: `1px solid ${STEEL_SOFT}` }}
      >
        {title}
      </div>
      <dl className="px-2.5 py-1.5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-3 py-[3px]"
            style={{ borderBottom: `1px solid ${STEEL_SOFT}` }}
          >
            <dt className="font-mono text-[9.5px] uppercase tracking-wider" style={{ color: TXT_DIM }}>
              {r.label}
            </dt>
            <dd
              className="font-mono text-[11px] font-semibold tabular-nums"
              style={{ color: r.tone ?? TXT }}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ── 모듈 카드 (목록 항목) ──
function ModuleCard({
  item,
  status,
  selected,
  onSelect,
}: {
  item: PaintingEquipment
  status: PaintingEquipmentStatus | undefined
  selected: boolean
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation()
  const led = ledStates(status)
  const unit = statusUnit(item.kind)
  const color = equipmentColor(item.kind)
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className="flex flex-col gap-1.5 rounded-[4px] p-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
      style={{
        background: CARD_BG,
        border: `1px solid ${selected ? color : STEEL}`,
        boxShadow: selected ? `0 0 0 1px ${color}, 0 0 8px ${color}44` : undefined,
      }}
    >
      {/* 지도 마커와 같은 칩 + 종류 이름 — "지도의 저 마커 = 이 카드"가 바로 이어진다 */}
      <div className="flex items-center gap-1">
        <EquipmentChip kind={item.kind} size={16} />
        <span
          className="min-w-0 truncate font-mono text-[9px] font-semibold tracking-wider"
          style={{ color }}
        >
          {t(kindLabelKey(item.kind))}
        </span>
        <span className="ml-auto shrink-0">
          <SlotChip id={item.id} />
        </span>
      </div>
      {/* LED 세 줄 → 한 줄 스트립 — 카드 높이가 줄어 그리드에 더 많은 모듈이 들어온다 */}
      <div
        className="flex items-center justify-between gap-1 rounded-[3px] px-1.5 py-1"
        style={{ background: '#0a0f15' }}
      >
        <Led label="RUN" state={led.run} />
        <Led label="LINK" state={led.link} />
        <Led label="FAULT" state={led.fault} />
      </div>
      <div className="flex flex-col gap-1">
        <Readout
          label="SP"
          value={status ? String(status.setpoint) : '--'}
          unit={unit}
          tone={CYAN}
        />
        <Readout
          label="PV"
          value={status ? String(status.actualValue) : '--'}
          unit={unit}
          tone={status?.operatingMode ? LED_GREEN : TXT_DIM}
        />
      </div>
    </button>
  )
}

/**
 * 랙 본문 (요약 지표 + 모듈 그리드) — 공장 카드가 펴질 때 그 안에 들어가는 내용물.
 * 바깥 프레임(카드/패널)은 호출부가 두르므로 여기는 SCADA 속살만 그린다.
 */
export function ScadaRackBody({
  equipment,
  statusById,
  selectedId,
  polledAt,
  onSelect,
}: {
  equipment: readonly PaintingEquipment[]
  statusById: Map<string, PaintingEquipmentStatus>
  selectedId: string | null
  polledAt: number | null
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation()
  /* 설비 모듈 종류 탭 — 전체/제습기/가스히터. 카드가 접히면 언마운트라 상태도 초기화된다 */
  const [kindFilter, setKindFilter] = useState<'all' | PaintingEquipmentKind>('all')

  let operating = 0
  let online = 0
  let fault = 0
  let rhSum = 0
  let rhN = 0
  let cSum = 0
  let cN = 0
  for (const item of equipment) {
    const s = statusById.get(item.id)
    if (s?.operatingMode) {
      operating += 1
      if (item.kind === '제습기') {
        rhSum += s.actualValue
        rhN += 1
      } else {
        cSum += s.actualValue
        cN += 1
      }
    }
    if (!s || s.modbusLink === 'OK') online += 1
    if (s && (s.modbusLink !== 'OK' || s.faultCode !== 0)) fault += 1
  }
  const total = equipment.length
  const avgRh = rhN > 0 ? (rhSum / rhN).toFixed(1) : '--'
  const avgC = cN > 0 ? (cSum / cN).toFixed(1) : '--'

  return (
    <div style={{ background: PANEL_BG }}>
      <MetricsTable
        title={t('painting.workspace.scada.summary')}
        rows={[
          {
            label: t('painting.workspace.summary.running'),
            value: `${operating} / ${total}`,
            tone: LED_GREEN,
          },
          { label: t('painting.workspace.summary.online'), value: `${online} / ${total}` },
          {
            label: 'FAULT',
            value: String(fault),
            tone: fault > 0 ? LED_RED : TXT_DIM,
          },
          { label: t('painting.workspace.scada.avgRh'), value: `${avgRh} %RH`, tone: CYAN },
          { label: t('painting.workspace.scada.avgC'), value: `${avgC} °C`, tone: CYAN },
          {
            label: t('painting.workspace.scada.lastPoll'),
            value: polledAt ? new Date(polledAt).toLocaleTimeString() : '--',
            tone: TXT_DIM,
          },
        ]}
      />
      <div
        className="px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: CYAN, background: '#0c131b', borderBottom: `1px solid ${STEEL_SOFT}` }}
      >
        {t('painting.workspace.scada.modules')} · {total}
      </div>

      {/* 종류 탭 — 전체/제습기/가스히터만 골라 본다. 활성 탭은 종류색으로 선다 */}
      <div
        className="flex gap-1 px-2 py-1.5"
        style={{ borderBottom: `1px solid ${STEEL_SOFT}` }}
        role="tablist"
        aria-label={t('painting.workspace.filter.kindLegend')}
      >
        {(
          [
            { key: 'all', label: t('painting.workspace.filter.all'), color: CYAN },
            {
              key: '제습기',
              label: t('painting.workspace.legend.dehumidifier'),
              color: equipmentColor('제습기'),
            },
            {
              key: '가스히터',
              label: t('painting.workspace.legend.gasHeater'),
              color: equipmentColor('가스히터'),
            },
          ] as const
        ).map((tab) => {
          const active = kindFilter === tab.key
          const count =
            tab.key === 'all' ? total : equipment.filter((e) => e.kind === tab.key).length
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setKindFilter(tab.key)}
              className="flex items-center gap-1 rounded-[3px] px-1.5 py-[3px] font-mono text-[9px] font-semibold tracking-wider transition-colors focus:outline-none focus-visible:ring-1"
              style={{
                background: active ? INSET_BG : 'transparent',
                border: `1px solid ${active ? `${tab.color}88` : STEEL}`,
                color: active ? tab.color : TXT_DIM,
                boxShadow: active ? `0 0 6px ${tab.color}33` : undefined,
              }}
            >
              {tab.label}
              <span style={{ color: active ? TXT : TXT_DIM }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* 스크롤은 바깥 공장 패널이 한 줄로 맡는다 — 여기서 또 말면 스크롤바가 겹으로 생긴다 */}
      <div className="p-2">
        <div className="grid grid-cols-2 gap-1.5">
          {equipment
            .filter((item) => kindFilter === 'all' || item.kind === kindFilter)
            .map((item) => (
              <ModuleCard
                key={item.id}
                item={item}
                status={statusById.get(item.id)}
                selected={item.id === selectedId}
                onSelect={onSelect}
              />
            ))}
        </div>
      </div>
    </div>
  )
}

// ── 모듈 상세 (설비 1대) ──
export function ScadaModuleDetail({
  equipment,
  status,
  now,
  onBack,
}: {
  equipment: PaintingEquipment
  status: PaintingEquipmentStatus | undefined
  now: number
  onBack: () => void
}) {
  const { t } = useTranslation()
  const unit = statusUnit(equipment.kind)
  const color = equipmentColor(equipment.kind)
  const link = status ? linkState(status.modbusLink) : 'offline'
  const stale = status ? isStale(status, now) : true
  const secondsAgo = status ? Math.max(0, Math.round((now - status.receivedAt) / 1000)) : null

  return (
    <div
      className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-inshop-lg shadow-xl"
      style={{ background: PANEL_BG, border: `1px solid ${STEEL}` }}
    >
      {/* 소속 도장 공장 이름이 **제일 위** — 그 아래 설비 ID · 종류가 온다 */}
      <SectionHeader
        title={equipment.factory}
        meta={`${equipment.id} · ${t(kindLabelKey(equipment.kind))}`}
      />

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <button
          type="button"
          onClick={onBack}
          className="flex w-full items-center gap-1 px-2.5 py-1.5 text-left font-mono text-[10px] tracking-wider transition-colors focus:outline-none"
          style={{ color: TXT_DIM, background: SECTION_BG, borderBottom: `1px solid ${STEEL_SOFT}` }}
        >
          ‹ {t('painting.workspace.backToList')}
        </button>

        {/* 모듈 카드 (확대) — 칩 + 종류 이름 + 상태 칩 한 줄. LED 램프 다섯 줄 대신
            뜻이 겹치는 것(RUN/STOP)은 하나로 접고 사람이 읽는 말로 말한다 */}
        <div
          className="flex items-center gap-2.5 p-2.5"
          style={{ borderBottom: `1px solid ${STEEL}` }}
        >
          {/* 지도 마커와 같은 칩 — 물방울 = 제습기, 불꽃 = 가스히터 */}
          <EquipmentChip kind={equipment.kind} size={28} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span
              className="font-mono text-[10px] font-semibold tracking-wider"
              style={{ color }}
            >
              {t(kindLabelKey(equipment.kind))}
            </span>
            {/* 원래 램프열에 있던 다섯 항목(RUN·STOP·LINK·FAULT·MAINT)을 전부 칩으로
                보인다 — 켜진 것은 점등, 꺼진 것은 흐리게. 램프판의 문법 그대로다 */}
            <div className="flex flex-wrap gap-1">
              <StatusPill
                color={LED_GREEN}
                lit={status?.operatingMode ?? false}
                label={t('painting.workspace.status.operating')}
              />
              <StatusPill
                color={LED_AMBER}
                lit={status != null && !status.operatingMode}
                label={t('painting.workspace.status.stopped')}
              />
              <StatusPill
                color={link === 'online' ? LED_GREEN : link === 'error' ? LED_RED : LED_AMBER}
                lit={link !== 'offline'}
                alarm={link === 'error'}
                label={t(`painting.workspace.link.${link}`)}
              />
              <StatusPill
                color={LED_RED}
                lit={(status?.faultCode ?? 0) !== 0}
                alarm={(status?.faultCode ?? 0) !== 0}
                label={
                  (status?.faultCode ?? 0) !== 0
                    ? t('painting.workspace.faultCode', { code: status?.faultCode })
                    : t('painting.workspace.noFault')
                }
              />
              <StatusPill
                color={LED_AMBER}
                lit={false}
                label={t('painting.workspace.status.maint')}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-2.5" style={{ borderBottom: `1px solid ${STEEL}` }}>
          <BigReadout label="SP" value={status ? String(status.setpoint) : '--'} unit={unit} tone={CYAN} />
          <BigReadout
            label="PV"
            value={status ? String(status.actualValue) : '--'}
            unit={unit}
            tone={status?.operatingMode ? LED_GREEN : TXT_DIM}
          />
        </div>

        <MetricsTable
          title={t('painting.workspace.scada.registers')}
          rows={[
            {
              label: t('painting.workspace.field.setpoint'),
              value: status ? `${status.setpoint} ${unit}` : '--',
            },
            {
              label: t('painting.workspace.field.actual'),
              value: status ? `${status.actualValue} ${unit}` : '--',
              tone: status?.operatingMode ? LED_GREEN : TXT,
            },
            {
              label: t('painting.workspace.field.runtime'),
              value: status ? `${status.runtimeMinutesToday} min` : '--',
            },
            {
              label: 'MODBUS',
              value: status?.modbusLink ?? 'OFFLINE',
              tone: link === 'online' ? LED_GREEN : link === 'error' ? LED_RED : LED_AMBER,
            },
            {
              label: 'FAULT',
              value: status ? String(status.faultCode) : '--',
              tone: (status?.faultCode ?? 0) !== 0 ? LED_RED : TXT_DIM,
            },
            {
              label: t('painting.workspace.field.freshness'),
              value:
                secondsAgo === null
                  ? t('painting.workspace.noSignal')
                  : `${secondsAgo}s${stale ? ' · ' + t('painting.workspace.stale') : ''}`,
              tone: secondsAgo === null ? LED_RED : stale ? LED_AMBER : TXT,
            },
            {
              label: t('painting.workspace.field.coords'),
              value: `${equipment.lat.toFixed(4)}, ${equipment.lon.toFixed(4)}`,
              tone: TXT_DIM,
            },
          ]}
        />
        <p className="px-2.5 py-1.5 font-mono text-[8.5px]" style={{ color: TXT_DIM }}>
          {t('painting.workspace.demoHint')}
        </p>
      </div>
    </div>
  )
}

function BigReadout({
  label,
  value,
  unit,
  tone,
}: {
  label: string
  value: string
  unit: string
  tone: string
}) {
  return (
    <div
      className="flex flex-1 flex-col gap-0.5 rounded-[4px] px-2.5 py-1.5"
      style={{ background: INSET_BG, border: `1px solid ${STEEL}` }}
    >
      <span className="font-mono text-[8px] font-semibold tracking-widest" style={{ color: TXT_DIM }}>
        {label}
      </span>
      <span className="font-mono text-[18px] font-bold leading-none tabular-nums" style={{ color: tone }}>
        {value}
        <span className="ml-0.5 text-[9px] font-medium" style={{ color: TXT_DIM }}>
          {unit}
        </span>
      </span>
    </div>
  )
}
