import { cn } from '../../lib/utils'

/*
 * 로딩 뼈대(skeleton) — **자리를 먼저 잡아 두는** 로딩 표시.
 *
 * 스피너 하나만 두면 내용이 도착하는 순간 레이아웃이 통째로 다시 서면서 화면이 튄다.
 * 뼈대는 올 내용과 **같은 크기·같은 배치**로 미리 서 있으므로, 도착은 자리 이동이
 * 아니라 색이 채워지는 일이 된다. 그래서 변형이 화면 유형별로 나뉜다 — 카드 한 장,
 * 줄이 반복되는 목록, 지도 위 유리 패널.
 *
 * 배색은 두 갈래다(`tone`).
 *   `surface` 본문 위 — 테마를 따라간다(라이트/다크 토큰).
 *   `glass`   지도 오버레이 위 — 바탕이 두 테마 모두 어두우므로 흰 램프로 고정한다
 *             (globals.css 의 유리 주석과 같은 이유).
 *
 * 움직임은 `motion-safe` 안에만 둔다 — 모션 저감 설정에서는 정지한 회색 판으로 남는다.
 */

export type StateTone = 'surface' | 'glass'

const BAR_TONE: Record<StateTone, string> = {
  surface: 'bg-foreground/8',
  glass: 'bg-white/10',
}

/** 뼈대 한 조각 — 글자 한 줄이나 값 하나가 설 자리 */
export function SkeletonBlock({
  className,
  tone = 'surface',
}: {
  className?: string
  tone?: StateTone
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block rounded motion-safe:animate-pulse',
        BAR_TONE[tone],
        /* 높이를 안 주면 0 이 되어 자리를 못 잡는다 — 기본은 본문 한 줄 */
        'h-3',
        className,
      )}
    />
  )
}

interface SkeletonProps {
  tone?: StateTone
  className?: string
  /** 스크린리더가 읽을 문구 — 무엇을 기다리는 중인지 */
  label?: string
}

/**
 * 로딩 중임을 **한 번만** 알리는 껍데기.
 *
 * 뼈대 조각 하나하나에 role 을 달면 스크린리더가 같은 말을 수십 번 읽는다. 조각은
 * 전부 `aria-hidden` 이고, 이 껍데기가 그 영역을 대표해 한 마디만 한다.
 */
function SkeletonFrame({
  label,
  className,
  children,
}: {
  label?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      {children}
      <span className="sr-only">{label}</span>
    </div>
  )
}

/**
 * 카드 뼈대 — 제목 줄 + 값 몇 개 + 본문 두 줄.
 * 통합실적의 요약/절점 카드처럼 "제목-수치-보조설명" 골격을 가진 카드가 쓴다.
 */
export function CardSkeleton({
  tone = 'surface',
  className,
  label,
  rows = 3,
}: SkeletonProps & { /** 본문 줄 수 */ rows?: number }) {
  return (
    <SkeletonFrame
      label={label}
      className={cn(
        'rounded-inshop-lg border p-5',
        tone === 'glass' ? 'border-white/10 bg-white/[0.025]' : 'border-border bg-surface',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <SkeletonBlock tone={tone} className="h-4 w-28" />
        <SkeletonBlock tone={tone} className="ml-auto h-4 w-12" />
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        {Array.from({ length: rows }, (_, index) => (
          <SkeletonBlock
            key={index}
            tone={tone}
            /* 줄 끝을 들쭉날쭉하게 — 문단은 오른쪽이 가지런하지 않다 */
            className={index === rows - 1 ? 'w-1/2' : index % 2 === 0 ? 'w-full' : 'w-4/5'}
          />
        ))}
      </div>
    </SkeletonFrame>
  )
}

/**
 * 목록 뼈대 — 같은 줄이 반복되는 자리(설비 목록·이벤트 그리드).
 * 줄마다 상태점·이름·오른쪽 수치가 서므로 뼈대도 그 세 자리를 그대로 낸다.
 */
export function ListSkeleton({
  tone = 'surface',
  className,
  label,
  rows = 4,
}: SkeletonProps & { /** 줄 수 */ rows?: number }) {
  return (
    <SkeletonFrame label={label} className={cn('flex flex-col gap-1.5', className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className={cn(
            'flex items-center gap-2.5 rounded-inshop-lg border px-3 py-2.5',
            tone === 'glass' ? 'border-white/10 bg-white/[0.025]' : 'border-border bg-surface',
          )}
        >
          <SkeletonBlock tone={tone} className="h-1.5 w-1.5 shrink-0 rounded-full" />
          <SkeletonBlock tone={tone} className={index % 2 === 0 ? 'w-40' : 'w-28'} />
          <SkeletonBlock tone={tone} className="ml-auto h-3 w-10 shrink-0" />
        </div>
      ))}
    </SkeletonFrame>
  )
}

/**
 * 맵 패널 뼈대 — 지도 우측 패널의 접이 카드 본문이 채워지기를 기다리는 자리.
 *
 * 패널은 폭이 좁고(≈384px) 구획(제목 + 줄 몇)이 반복되는 구조라, 카드/목록 뼈대를
 * 그대로 쓰면 조각이 패널 밖으로 밀린다. 기본 배색이 `glass` 인 것도 이 자리 때문이다.
 */
export function MapPanelSkeleton({
  tone = 'glass',
  className,
  label,
  sections = 2,
}: SkeletonProps & { /** 구획 수 */ sections?: number }) {
  return (
    <SkeletonFrame label={label} className={cn('flex flex-col gap-2.5 px-3 py-2.5', className)}>
      {Array.from({ length: sections }, (_, index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <SkeletonBlock tone={tone} className="h-2.5 w-20" />
          <div className="flex items-center justify-between gap-2">
            <SkeletonBlock tone={tone} className="w-24" />
            <SkeletonBlock tone={tone} className="w-10" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <SkeletonBlock tone={tone} className="w-16" />
            <SkeletonBlock tone={tone} className="w-12" />
          </div>
        </div>
      ))}
    </SkeletonFrame>
  )
}
