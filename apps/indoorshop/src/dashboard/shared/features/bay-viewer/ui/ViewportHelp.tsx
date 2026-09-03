import { useState } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { InshopKey } from '../../../lib/i18n/keys'
import { cn } from '../../../lib/utils'
import { isLowGpuMode, setLowGpuMode } from '../lib/qualityMode'
import { dragActionOf, type DragAction, type DragModifiers } from '../../../lib/mapInteraction'

/** 동작 → 그 동작을 부르는 말 */
const ACTION_LABEL: Record<DragAction, InshopKey> = {
  pan: 'viewer.help.pan',
  rotate: 'viewer.help.rotate',
  zoom: 'viewer.help.zoomFocused',
}

/*
 * 기본 조작 표 — **문법에서 직접 만든다**(`shared/lib/mapInteraction`, 면은 `viewer`).
 *
 * 예전에는 표를 손으로 적어 뒀다. 그러면 배치를 바꿀 때 안내가 남아 거짓말을 하고,
 * 그 거짓말은 "왼쪽이 회전이라더니 이동하네" 하고 손이 먼저 알아챈다. 이제 안내와
 * 실제 배치가 같은 함수를 보므로 어긋날 수가 없다.
 */
const viewerAction = (button: number, modifiers: DragModifiers = {}): InshopKey =>
  ACTION_LABEL[dragActionOf(button, modifiers, 'viewer')]

const MOUSE: [InshopKey, InshopKey][] = [
  ['viewer.help.leftDrag', viewerAction(0)],
  ['viewer.help.rightDrag', viewerAction(2)],
  ['viewer.help.shiftDrag', viewerAction(0, { shiftKey: true })],
  /* 휠은 버튼이 아니라 배치표 밖이다 — 클릭 후에만 켜지는 사정까지 문구가 담는다 */
  ['viewer.help.wheel', 'viewer.help.zoomFocused'],
  ['viewer.help.middleDrag', viewerAction(1)],
]

/** 키 이름은 자판에 새겨진 그대로라 번역하지 않는다 — 동작 설명만 옮긴다 */
const KEYS: [string, InshopKey][] = [
  ['1 / 3 / 7', 'viewer.help.viewKeys'],
  ['Ctrl + 1 / 3 / 7', 'viewer.help.opposite'],
  ['.', 'viewer.help.frameSelected'],
  ['Home', 'viewer.help.home'],
  ['Esc', 'viewer.help.escape'],
  ['F', 'viewer.help.fullscreen'],
]

/**
 * 뷰포트 조작 안내.
 * 단축키는 알려주지 않으면 없는 기능이나 마찬가지라, 화면 안에 접어서 둔다.
 */
export function ViewportHelp({ className }: { className?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  /* 저사양 모드(FR-4) — 값의 주인은 qualityMode(localStorage), 여기는 스위치일 뿐 */
  const [lowGpu, setLowGpu] = useState(isLowGpuMode)

  const handleLowGpuChange = (next: boolean) => {
    setLowGpu(next)
    setLowGpuMode(next)
  }

  return (
    <div className={cn('absolute bottom-4 right-4 flex flex-col items-end gap-2', className)}>
      {open && (
        <div className="w-60 animate-fade-in rounded-inshop-lg glass-panel p-2.5">
          <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-glass-foreground/54">
            {t('viewer.help.mouse')}
          </p>
          <dl className="mb-2.5 space-y-0.5">
            {MOUSE.map(([key, action]) => (
              <div key={key} className="flex items-baseline justify-between gap-3">
                <dt className="font-mono text-2xs text-glass-foreground/75">{typeof key === "string" && key.startsWith("viewer.") ? t(key as InshopKey) : key}</dt>
                <dd className="text-2xs text-glass-foreground/63">{t(action)}</dd>
              </div>
            ))}
          </dl>
          <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-glass-foreground/54">
            {t('viewer.help.keyboard')}
          </p>
          <dl className="space-y-0.5">
            {KEYS.map(([key, action]) => (
              <div key={key} className="flex items-baseline justify-between gap-3">
                <dt className="font-mono text-2xs text-glass-foreground/75">{typeof key === "string" && key.startsWith("viewer.") ? t(key as InshopKey) : key}</dt>
                <dd className="text-2xs text-glass-foreground/63">{t(action)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 border-t border-glass-border/70 pt-1.5 text-2xs leading-relaxed text-glass-foreground/50">
            {t('viewer.help.note')}
          </p>
          {/* 저사양 환경에서 렌더 품질을 낮춘다 (FR-4) — 픽셀 밀도를 눌러 프레임을 지킨다 */}
          <label className="mt-2 flex cursor-pointer items-center gap-2 border-t border-glass-border/70 pt-2 text-2xs text-glass-foreground/75">
            <input
              type="checkbox"
              checked={lowGpu}
              onChange={(event) => handleLowGpuChange(event.target.checked)}
              className="h-3 w-3 accent-(--glass-accent)"
            />
            {t('viewer.help.lowSpec')}
          </label>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t('viewer.help.label')}
        className={cn(
          'rounded-inshop-md glass-panel px-2 py-1 font-mono text-2xs transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent',
          open ? 'text-glass-accent' : 'text-glass-foreground/68 hover:text-glass-foreground',
        )}
      >
        {t('viewer.help.toggle')}
      </button>
    </div>
  )
}
