import { useMemo } from 'react';
import { useTagCatalog } from '@crane/features/3d';
import { Combobox, type ComboboxOption } from '@crane/ui/molecules/combobox';
import type { InspectorT } from './inspector-fields';

/**
 * 태그 키 선택 콤보박스. 목록은 useTagCatalog(지금은 가상 태그, 나중엔
 * 서버 태그 합산)에서 온다. 자유 입력은 없다 — 손으로 치던 시절의 오타
 * 키를 없애려는 것이 이 변경의 목적이다.
 *
 * 현재 값이 카탈로그에 없으면(태그를 지웠거나 키를 바꿨거나 옛 씬) amber
 * sentinel 항목으로 값을 보존한다. NodeSelect 의 unresolved 와 같은 기법 —
 * 사용자가 다시 고르기 전까지는 지우지 않는다.
 */
export function TagKeyCombobox({
  value,
  onChange,
  className,
  t,
}: {
  value: string;
  onChange: (key: string) => void;
  className?: string;
  t: InspectorT;
}) {
  const catalog = useTagCatalog();
  const options = useMemo<ComboboxOption[]>(() => {
    const list: ComboboxOption[] = catalog.map((entry) => {
      const range =
        entry.min !== undefined && entry.max !== undefined
          ? `${entry.min} ~ ${entry.max}`
          : '';
      const description = [
        entry.name !== entry.key ? entry.name : '',
        entry.unit ?? '',
        range,
      ]
        .filter(Boolean)
        .join(' · ');
      return {
        value: entry.key,
        label: entry.key,
        description: description || undefined,
        badge: entry.source === 'virtual' ? 'sim' : 'srv',
      };
    });
    if (value && !list.some((o) => o.value === value)) {
      list.unshift({
        value,
        label: value,
        description: t('monitoring:inspector.mapping.tagUnknown'),
        badge: '?',
      });
    }
    return list;
  }, [catalog, t, value]);
  const unknown = value !== '' && !catalog.some((e) => e.key === value);

  return (
    <Combobox
      value={value || null}
      onValueChange={(next) => onChange(next ?? '')}
      options={options}
      placeholder={t('monitoring:inspector.mapping.tagPlaceholder')}
      searchPlaceholder={t('monitoring:inspector.mapping.tagSearch')}
      emptyText={t('monitoring:inspector.mapping.tagEmpty')}
      invalid={unknown}
      aria-label={t('monitoring:inspector.mapping.tag')}
      className={className}
    />
  );
}
