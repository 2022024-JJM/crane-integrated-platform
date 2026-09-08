import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/*
 * 이식하면서 개명한 스케일을 tailwind-merge 에 알려 준다.
 *
 * 셸의 shadcn 토큰과 이름이 겹쳐 `text-xs` → `text-inshop-xs`, `rounded-md` →
 * `rounded-inshop-md` 로 바꿨는데, tailwind-merge 는 모르는 `text-*` 를 **글자색**으로
 * 분류한다. 그래서 `cn('text-inshop-xs text-foreground')` 에서 앞의 것이 "같은
 * 그룹의 뒤에 온 클래스"에 밀려 조용히 사라졌다 — 글자 크기가 16px 기본값으로
 * 튀거나, 순서가 반대면 글자색이 사라졌다. 여기서 그룹을 바로잡으면 원본과 같은
 * 병합 결과가 나온다.
 */
const INSHOP_TEXT_SIZES = ['inshop-xs', 'inshop-sm', 'inshop-base', 'inshop-lg', 'inshop-xl', 'inshop-2xl', '2xs']
const INSHOP_RADII = ['inshop-xs', 'inshop-sm', 'inshop-md', 'inshop-lg', 'inshop-xl', 'inshop-2xl', 'inshop-3xl']

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: INSHOP_TEXT_SIZES }],
      rounded: [{ rounded: INSHOP_RADII }],
      'rounded-t': [{ 'rounded-t': INSHOP_RADII }],
      'rounded-b': [{ 'rounded-b': INSHOP_RADII }],
      'rounded-l': [{ 'rounded-l': INSHOP_RADII }],
      'rounded-r': [{ 'rounded-r': INSHOP_RADII }],
      'rounded-tl': [{ 'rounded-tl': INSHOP_RADII }],
      'rounded-tr': [{ 'rounded-tr': INSHOP_RADII }],
      'rounded-bl': [{ 'rounded-bl': INSHOP_RADII }],
      'rounded-br': [{ 'rounded-br': INSHOP_RADII }],
      'font-family': [{ font: ['inshop-sans'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
