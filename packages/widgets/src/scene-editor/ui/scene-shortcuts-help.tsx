import { Keyboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Kbd } from '@crane/ui/atoms/kbd';
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from '@crane/ui/molecules/popover';
import { SHORTCUT_MOD as MOD } from '../lib/shortcut-modifier';

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
 * (키보드), scene-objects-edit-canvas.tsx(OrbitControls 마우스 버튼,
 * 더블클릭 drill-in — handleDoubleSelectModel, 잠긴 모델 제외),
 * use-marquee-selection.ts(드래그 선택). 도구 모음 툴팁의 Kbd 병기
 * (editor-header-bar, editor-selection-bar)도 같은 표다.
 */
const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'groupFile',
    rows: [{ keys: [MOD, 'S'], label: 'save' }],
  },
  {
    title: 'groupTools',
    rows: [
      { keys: ['W'], label: 'toolTranslate' },
      { keys: ['E'], label: 'toolRotate' },
      { keys: ['R'], label: 'toolScale' },
    ],
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
      { keys: ['doubleClick'], label: 'selectNode' },
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
      { keys: ['Shift', 'rightDrag'], label: 'rotate' },
      { keys: ['rightDrag'], label: 'pan' },
    ],
  },
];

/** 마우스 동작처럼 번역이 필요한 키 토큰. 나머지는 키 이름 그대로 표시. */
const TRANSLATED_KEYS = new Set([
  'click',
  'doubleClick',
  'drag',
  'wheel',
  'middleDrag',
  'rightDrag',
]);

/**
 * 팝업 두 칸 배치 — 왼쪽은 키보드 위주(파일·도구·편집), 오른쪽은 마우스
 * 위주(선택·카메라). 그룹 이름으로 SHORTCUT_GROUPS 에서 찾는다.
 */
const SHORTCUT_COLUMNS: string[][] = [
  ['groupFile', 'groupTools', 'groupEdit'],
  ['groupSelect', 'groupCamera'],
];

const OVERLAY_BUTTON_CLASS =
  'border-border bg-card/95 text-muted-foreground hover:bg-card hover:text-foreground data-popup-open:text-foreground absolute right-3 bottom-3 z-10 flex size-8 cursor-pointer items-center justify-center rounded-md border shadow-sm backdrop-blur-sm transition';

/** 캔버스 우측 하단의 단축키 도움말 버튼 + 팝업. */
export function SceneShortcutsHelp() {
  const { t } = useTranslation();
  const title = t('monitoring:editor.shortcuts.title');

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
      <PopoverPopup side="top" align="end" className="w-fit p-3">
        <p className="text-foreground mb-2 text-sm font-semibold">{title}</p>
        <div className="flex items-stretch gap-4">
          {SHORTCUT_COLUMNS.map((titles, columnIndex) => (
            <div key={titles[0]} className="contents">
              {columnIndex > 0 ? (
                <span aria-hidden className="bg-border w-px self-stretch" />
              ) : null}
              <div className="flex w-60 flex-col gap-3">
                {titles
                  .map((groupTitle) =>
                    SHORTCUT_GROUPS.find((g) => g.title === groupTitle),
                  )
                  .filter((group) => group !== undefined)
                  .map((group) => (
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
                                <span
                                  key={key}
                                  className="flex items-center gap-1"
                                >
                                  {index > 0 ? (
                                    <span className="text-muted-foreground">
                                      +
                                    </span>
                                  ) : null}
                                  <Kbd>
                                    {TRANSLATED_KEYS.has(key)
                                      ? t(`monitoring:editor.shortcuts.${key}`)
                                      : key}
                                  </Kbd>
                                </span>
                              ))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
