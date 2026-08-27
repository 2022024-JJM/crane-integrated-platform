import { Keyboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from '@crane/ui/molecules/popover';

// 수식키 표기 — Mac에서는 Ctrl 대신 ⌘가 실제로 동작하는 키다
// (핸들러가 ctrlKey || metaKey를 받는다). 모듈 상수라 렌더마다 재계산되지 않는다.
const MOD =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform ?? '')
    ? '⌘'
    : 'Ctrl';

interface ShortcutRow {
  /** 키 조합. 각 항목이 <kbd> 하나가 된다. */
  keys: string[];
  /** i18n 키(monitoring:editor.shortcuts.*). */
  label: string;
}

interface ShortcutGroup {
  title: string;
  rows: ShortcutRow[];
}

/**
 * 편집기에 실제로 바인딩된 단축키와 1:1로 유지한다 — 목록이 코드와 어긋나면
 * 없는 기능을 안내하게 된다. 바인딩 위치: scene-objects-edit-page.tsx
 * (키보드), scene-objects-edit-canvas.tsx(OrbitControls 마우스 버튼),
 * use-marquee-selection.ts(드래그 선택).
 */
const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'groupFile',
    rows: [{ keys: [MOD, 'S'], label: 'save' }],
  },
  {
    title: 'groupEdit',
    rows: [
      { keys: [MOD, 'Z'], label: 'undo' },
      { keys: [MOD, 'Y'], label: 'redo' },
      { keys: [MOD, 'D'], label: 'duplicate' },
      { keys: [MOD, 'A'], label: 'selectAll' },
      { keys: ['Delete'], label: 'delete' },
    ],
  },
  {
    title: 'groupSelect',
    rows: [
      { keys: ['click'], label: 'select' },
      { keys: [MOD, 'click'], label: 'toggleSelect' },
      { keys: ['drag'], label: 'marquee' },
    ],
  },
  {
    title: 'groupCamera',
    rows: [
      { keys: ['F'], label: 'focusSelected' },
      { keys: ['wheel'], label: 'zoom' },
      { keys: ['middleDrag'], label: 'rotate' },
      { keys: ['rightDrag'], label: 'pan' },
    ],
  },
];

/** 마우스 동작처럼 번역이 필요한 키 토큰. 나머지는 키 이름 그대로 표시. */
const TRANSLATED_KEYS = new Set([
  'click',
  'drag',
  'wheel',
  'middleDrag',
  'rightDrag',
]);

const OVERLAY_BUTTON_CLASS =
  'border-border bg-card/95 text-muted-foreground hover:bg-card hover:text-foreground data-popup-open:text-foreground absolute right-3 bottom-3 z-10 flex size-8 cursor-pointer items-center justify-center rounded-md border shadow-sm backdrop-blur-sm transition';

/** 캔버스 우측 하단의 단축키 도움말 버튼 + 팝업. */
export function SceneShortcutsHelp() {
  const { t } = useTranslation();
  const title = t('monitoring:editor.keyboardShortcuts');

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={title}
            title={title}
            className={OVERLAY_BUTTON_CLASS}
          />
        }
      >
        <Keyboard className="size-4" />
      </PopoverTrigger>
      <PopoverPopup side="top" align="end" className="w-72 p-3">
        <p className="text-foreground mb-2 text-sm font-semibold">{title}</p>
        <div className="flex flex-col gap-3">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="text-muted-foreground mb-1 text-[11px] font-medium tracking-[0.04em] uppercase">
                {t(`monitoring:editor.shortcuts.${group.title}`)}
              </h3>
              <ul className="flex flex-col gap-1">
                {group.rows.map((row) => (
                  <li
                    key={`${row.label}-${row.keys.join('+')}`}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-foreground">
                      {t(`monitoring:editor.shortcuts.${row.label}`)}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {row.keys.map((key, index) => (
                        <span key={key} className="flex items-center gap-1">
                          {index > 0 ? (
                            <span className="text-muted-foreground">+</span>
                          ) : null}
                          <kbd className="bg-muted border-border text-foreground rounded border px-1.5 py-0.5 font-mono text-[11px] leading-none">
                            {TRANSLATED_KEYS.has(key)
                              ? t(`monitoring:editor.shortcuts.${key}`)
                              : key}
                          </kbd>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
