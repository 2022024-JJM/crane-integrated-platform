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
import { STATUS_HEX } from '../../../shared/ui/statusPalette'
import { cn } from '../../../shared/lib/utils'
import { EquipmentGrid } from '../../../shared/features/equipment-grid'
import { paintingCells } from '../lib/equipmentCells'

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
 *
 * ── 색 규약 (감사 P2 — 값 색의 뜻이 정의돼 있지 않다는 지적) ──
 * 상태 램프는 앱 상태 팔레트의 다크 램프를 그대로 쓴다: 초록=정상, 앰버=주의, 빨강=이상,
 * 소등=값 없음. 그리고 **색 단독으로 말하지 않는다** — 램프마다 모양이 다르고(StatusDot)
 * 손을 얹으면 상태 이름이 뜬다. 빛(글로우)은 이상에만 준다 — 켜진 램프가 전부 빛나면
 * 진짜 경보가 그 빛 속에 묻힌다(R18).
 * 리드아웃(수치)의 색은 상태가 아니라 **값의 종류**를 뜻한다:
 *   청록(CYAN) = 설정값(SP)·환경 측정값(온습도) · 초록 = 가동 중인 설비의 실측값(PV)
 *   흐린 회색(TXT_DIM) = 값 없음 또는 정지 중이라 읽을 뜻이 없는 값
 * 즉 초록 PV 는 "정상"이 아니라 "지금 돌면서 낸 값"이다 — 이상 여부는 FAULT 램프가 말한다.
 */

// ── 인더스트리얼 팔레트 ──
const PANEL_BG = '#0b1016'
const SECTION_BG = '#0e141c'
const INSET_BG = '#070b0f'
const STEEL = '#232f3c'
const STEEL_SOFT = 'rgba(255,255,255,0.06)'
const AMBER = '#e6a63c'
const CYAN = '#4fc3dd'
const TXT = '#c2cdd8'
const TXT_DIM = '#79848f'
/*
 * LED 색은 **앱의 상태 팔레트를 그대로** 쓴다(다크 램프).
 * 이 패널만 제 색을 고르면 같은 이상이 SCADA 에서는 다른 빨강이 되고, 화면을 오갈 때
 * 눈이 다시 적응해야 한다. 산업 패널 느낌은 배색이 아니라 바탕·테두리·모노스페이스가 낸다.
 */
const LED_GREEN = STATUS_HEX.dark.done
const LED_RED = STATUS_HEX.dark.error
const LED_AMBER = STATUS_HEX.dark.warning
const LED_OFF = '#2a3947'







/**
 * 상태 칩 — LED 점 + 사람이 읽는 말 한 단어. 상세의 램프열을 한 줄로 접는 컴팩트 표현.
 * 켜지면(lit) 점에 색이 들고 글자가 서고, alarm 이면 칩이 붉게 맥동하며 점이 빛난다
 * (정상 점등은 빛나지 않는다 — R18).
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
          /*
           * 글로우는 **이상에만**(R18). 정상 점등은 색으로 충분하고, 켜진 램프가 전부
           * 빛나면 진짜 경보가 그 빛 속에 묻힌다.
           */
          boxShadow: alarm
            ? `0 0 6px ${color}, 0 0 2px ${color}`
            : lit
              ? 'none'
              : 'inset 0 0 2px rgba(0,0,0,0.7)',
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


/**
 * 랙 본문 (요약 지표 + 모듈 그리드) — 공장 카드가 펴질 때 그 안에 들어가는 내용물.
 * 바깥 프레임(카드/패널)은 호출부가 두르므로 여기는 SCADA 속살만 그린다.
 */
/**
 * 펼침 상세 — 셀을 골랐을 때만 서는 값들.
 *
 * 예전 카드가 늘 보여 주던 `SP`(설정값)·가동시간·fault 코드가 이 자리로 왔다. 압축 셀은
 * `PV` 한 줄만 든다(레퍼런스 §3.4) — 정상 86칸에 설정값까지 적으면 그게 배경이 된다.
 */
function ScadaCellDetail({
  item,
  status,
}: {
  item: PaintingEquipment
  status: PaintingEquipmentStatus | undefined
}) {
  const { t } = useTranslation()
  if (!status) {
    return (
      <p className="text-[10px] text-glass-foreground/45">{t('painting.workspace.scada.pending')}</p>
    )
  }
  const unit = statusUnit(item.kind)
  const hours = Math.floor(status.runtimeMinutesToday / 60)
  const minutes = status.runtimeMinutesToday % 60
  return (
    <dl className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-glass-foreground/55">
      <div className="flex gap-1">
        <dt>SP</dt>
        <dd className="font-mono tabular-nums text-glass-foreground/72">{status.setpoint}{unit}</dd>
      </div>
      <div className="flex gap-1">
        <dt>PV</dt>
        <dd className="font-mono tabular-nums text-glass-foreground/72">{status.actualValue}{unit}</dd>
      </div>
      <div className="flex gap-1">
        <dt>{t('painting.workspace.scada.runtime')}</dt>
        <dd className="font-mono tabular-nums text-glass-foreground/72">{hours}h {minutes}m</dd>
      </div>
      <div className="flex gap-1">
        <dt>LINK</dt>
        <dd className={cn('font-mono', status.modbusLink === 'OK' ? 'text-foreground/72' : 'text-status-unhealthy')}>
          {status.modbusLink}
        </dd>
      </div>
      {status.faultCode !== 0 && (
        <div className="flex gap-1 text-glass-unhealthy">
          <dt>FAULT</dt>
          <dd className="font-mono tabular-nums">{status.faultCode}</dd>
        </div>
      )}
      <div className="flex gap-1">
        <dt>{t('painting.workspace.scada.bay')}</dt>
        <dd className="font-mono text-glass-foreground/72">{item.bay || '-'}</dd>
      </div>
    </dl>
  )
}

export function ScadaRackBody({
  equipment,
  statusById,
  selectedId,
  polledAt,
  onSelect,
  trendById,
}: {
  equipment: readonly PaintingEquipment[]
  statusById: Map<string, PaintingEquipmentStatus>
  selectedId: string | null
  polledAt: number | null
  onSelect: (id: string) => void
  /** 설비별 실측값 추이 — 이상·선택 셀에만 그려진다(없으면 그리지 않는다) */
  trendById?: Map<string, readonly { label: string; value: number }[]>
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

      {/*
        모듈 본문 — **세 공정이 공유하는 압축 셀**(R13 · 레퍼런스 §3.4).
        예전 카드는 LED 3 + `SP`/`PV` 두 줄이라 조립·의장 셀보다 컸다. 권고대로 `PV` 한 줄만
        셀에 남기고 `SP`·가동시간·fault 는 셀을 골랐을 때 편다 — SCADA 의 겉테(요약표·종류
        탭·강철 배색)는 그대로다. 스크롤은 바깥 공장 패널이 맡는다.
      */}
      <div className="p-2">
        <EquipmentGrid
          cells={paintingCells(
            equipment.filter((item) => kindFilter === 'all' || item.kind === kindFilter),
            {
              statusOf: (item) => statusById.get(item.id),
              pendingText: t('painting.workspace.scada.pending'),
              trendOf: (item) => trendById?.get(item.id),
              detailOf: (item, status) => <ScadaCellDetail item={item} status={status} />,
            }
          )}
          selectedId={selectedId}
          onSelect={(id) => onSelect(id ?? '')}
          showControls={false}
          /* 랙은 늘 어두운 강철 판 위다(테마와 무관) — 유리 램프를 쓴다 */
          tone="glass"
        />
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
