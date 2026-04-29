import { useCallback, useMemo, useRef, useState } from 'react';
import { getStorageItem, setStorageItem } from './safe-storage';

export interface SectionCollapseGroup {
  isCollapsed: (key: string) => boolean;
  toggle: (key: string) => void;
  setAll: (collapsed: boolean) => void;
  allCollapsed: boolean;
  allExpanded: boolean;
}

interface UseSectionCollapseGroupOptions {
  /** localStorage 키 prefix. 기존 호환을 위해 외부에서 지정. */
  storagePrefix: string;
  keys: readonly string[];
  /** 처음 진입 시 localStorage에 값이 없으면 적용할 기본값. */
  defaultCollapsed?: boolean;
}

function makeStorageKey(prefix: string, key: string) {
  return `${prefix}:${key}`;
}

/**
 * 여러 섹션의 펼침/접힘 상태를 상위에서 일괄 관리하는 hook.
 *
 * 기존에는 각 자식이 자기 useState를 갖고 부모가 globalCollapsed로 덮어썼는데,
 * 이 방식은 "전체 접힘 → 한 섹션만 펼치기" 같은 상호작용에서 다른 섹션들의
 * local 초기값(false)이 노출되어 의도치 않게 모두 펼쳐지는 문제가 있었다.
 * 단일 source of truth로 묶어 그 문제를 구조적으로 제거한다.
 */
export function useSectionCollapseGroup({
  storagePrefix,
  keys,
  defaultCollapsed = false,
}: UseSectionCollapseGroupOptions): SectionCollapseGroup {
  // keys 배열은 호출자가 매 렌더 새로 만들 수 있어 내용 동등성으로 안정화한다.
  // 이렇게 하지 않으면 useCallback/useMemo 의존성이 매 렌더 변해 setAll 함수
  // 참조가 매번 갈리고 자식 리렌더가 불필요하게 늘어난다.
  const stableKeysRef = useRef<readonly string[]>(keys);
  if (
    stableKeysRef.current.length !== keys.length ||
    stableKeysRef.current.some((k, i) => k !== keys[i])
  ) {
    stableKeysRef.current = keys;
  }
  const stableKeys = stableKeysRef.current;

  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      for (const key of stableKeys) {
        const raw = getStorageItem(makeStorageKey(storagePrefix, key));
        initial[key] = raw !== null ? raw === 'true' : defaultCollapsed;
      }
      return initial;
    },
  );

  const isCollapsed = useCallback(
    (key: string) => collapsedMap[key] ?? defaultCollapsed,
    [collapsedMap, defaultCollapsed],
  );

  const toggle = useCallback(
    (key: string) => {
      setCollapsedMap((prev) => {
        const next = !(prev[key] ?? defaultCollapsed);
        setStorageItem(makeStorageKey(storagePrefix, key), String(next));
        return { ...prev, [key]: next };
      });
    },
    [defaultCollapsed, storagePrefix],
  );

  const setAll = useCallback(
    (collapsed: boolean) => {
      setCollapsedMap((prev) => {
        const next: Record<string, boolean> = { ...prev };
        for (const key of stableKeys) {
          next[key] = collapsed;
          setStorageItem(makeStorageKey(storagePrefix, key), String(collapsed));
        }
        return next;
      });
    },
    [stableKeys, storagePrefix],
  );

  const { allCollapsed, allExpanded } = useMemo(() => {
    if (stableKeys.length === 0) {
      return { allCollapsed: false, allExpanded: false };
    }
    let collapsedCount = 0;
    for (const key of stableKeys) {
      if (collapsedMap[key] ?? defaultCollapsed) {
        collapsedCount += 1;
      }
    }
    return {
      allCollapsed: collapsedCount === stableKeys.length,
      allExpanded: collapsedCount === 0,
    };
  }, [collapsedMap, stableKeys, defaultCollapsed]);

  return { isCollapsed, toggle, setAll, allCollapsed, allExpanded };
}
