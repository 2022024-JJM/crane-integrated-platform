import { useEffect, useState } from 'react';
import {
  getAssetLibraryRepository,
  type AssetFileRef,
} from '@crane/domain/asset-library';
import { withBaseUrl } from '@crane/core/lib/asset-url';

export type AssetFileUrlState =
  | { status: 'loading'; url: null }
  | { status: 'ready'; url: string }
  | { status: 'missing'; url: null };

const LOADING: AssetFileUrlState = { status: 'loading', url: null };
const MISSING: AssetFileUrlState = { status: 'missing', url: null };

function refKey(ref: AssetFileRef | null | undefined): string {
  if (!ref) return '';
  return ref.storage === 'public' ? `public:${ref.path}` : `browser:${ref.key}`;
}

/**
 * 파일 참조를 화면에서 읽을 수 있는 URL 로 바꾼다.
 *
 * 배포 파일(public)은 동기로 풀린다 — 로딩 상태를 거치면 목록의 썸네일
 * 수십 개가 한 프레임씩 깜빡인다. 브라우저 저장분은 IndexedDB 에서 꺼내
 * object URL 을 만든다(저장소가 키마다 하나만 만들어 캐시한다). 파일이
 * 없으면 `missing` — 다른 브라우저에서 올린 파일을 가리키는 문서일 수 있다.
 */
export function useAssetFileUrl(
  ref: AssetFileRef | null | undefined,
): AssetFileUrlState {
  const key = refKey(ref);
  const [resolved, setResolved] = useState<{
    key: string;
    state: AssetFileUrlState;
  } | null>(null);

  useEffect(() => {
    if (!ref || ref.storage !== 'browser') return;
    let cancelled = false;
    getAssetLibraryRepository()
      .resolveUrl(ref)
      .then(
        (url) => {
          if (cancelled) return;
          setResolved({
            key,
            state: url ? { status: 'ready', url } : MISSING,
          });
        },
        () => {
          if (!cancelled) setResolved({ key, state: MISSING });
        },
      );
    return () => {
      cancelled = true;
    };
    // ref 는 매 렌더 새 객체일 수 있다 — 내용이 같은 동안은 다시 풀지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!ref) return MISSING;
  if (ref.storage === 'public') {
    return { status: 'ready', url: withBaseUrl(ref.path) };
  }
  return resolved?.key === key ? resolved.state : LOADING;
}
