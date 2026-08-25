import { useRef } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import type { LoadedBlockModel } from '../../../entities/block-model/model/types'
import { useInViewport } from '../../../shared/lib/useInViewport'
import { cn } from '../../../shared/lib/utils'
import { AssemblyOrbitPreview } from './AssemblyOrbitPreview'
import { AssemblyThumbnail } from './AssemblyThumbnail'

interface BlockShapePreviewProps {
  model: LoadedBlockModel
  assemblyIds: string[]
  /** 정적 썸네일 캐시 키 — 블록 id */
  cacheKey: string
  /** 눌렀을 때 이 블록 단독 뷰로 — 조작 가능한 프리뷰에서는 쓰지 않는다 */
  onSelect?: () => void
  /**
   * 사용자가 직접 각도를 잡을 수 있는가.
   * 선택된 카드 하나만 true 다 — 나머지는 돌아가기만 하고, 누르면 선택된다.
   */
  interactive?: boolean
  className?: string
}

/**
 * 목록 카드의 형상 프리뷰.
 *
 * **기본이 회전이다.** 정지 썸네일은 한 각도에서 겹쳐 보이는 부재를 구분하지
 * 못해서, 블록 두 개가 같은 그림으로 보이는 일이 흔하다.
 *
 * 다만 카드마다 WebGL 캔버스를 하나씩 물리면 컨텍스트 한도(대개 16개)에 닿는다 —
 * 그래서 **화면 근처에 온 카드만** 라이브 캔버스를 물고, 멀리 있는 카드는 캐시된
 * 정적 썸네일로 되돌아간다. 스크롤해서 도착할 즈음이면 이미 돌고 있다.
 */
export function BlockShapePreview({
  model,
  assemblyIds,
  cacheKey,
  onSelect,
  interactive = false,
  className,
}: BlockShapePreviewProps) {
  const { t } = useTranslation()
  const holderRef = useRef<HTMLDivElement>(null)
  const near = useInViewport(holderRef, '300px')

  return (
    <div ref={holderRef} className={cn('relative', className)}>
      {!near ? (
        <AssemblyThumbnail
          model={model}
          assemblyIds={assemblyIds}
          cacheKey={cacheKey}
          onClick={onSelect}
          className="h-full w-full"
        />
      ) : interactive ? (
        <AssemblyOrbitPreview
          model={model}
          assemblyIds={assemblyIds}
          className="h-full w-full"
        />
      ) : (
        /*
         * 조작을 받지 않는 프리뷰는 통째로 "이 블록 보기" 버튼이다.
         * 캔버스에 pointer-events 를 끊어 두어, 클릭이 궤도 조작으로 새지 않고
         * 버튼까지 그대로 올라온다.
         */
        <button
          type="button"
          onClick={onSelect}
          title={t('blocks.viewAlone')}
          className={cn(
            'block h-full w-full overflow-hidden rounded-inshop-md transition-opacity',
            onSelect ? 'cursor-pointer hover:opacity-85' : 'cursor-default',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          )}
        >
          <AssemblyOrbitPreview
            model={model}
            assemblyIds={assemblyIds}
            interactive={false}
            className="pointer-events-none h-full w-full"
          />
        </button>
      )}
    </div>
  )
}
