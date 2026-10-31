import { startTransition, useCallback, useDeferredValue, useEffect, useState } from 'react'

/**
 * 주소가 원본인 선택(탭·갈래)을 **누르는 즉시** 바꿔 보이고, 무거운 내용은 한 박자 뒤에 그린다
 * (사용자 지적: 탭 전환 딜레이).
 *
 * 라우터는 주소 변경을 트랜지션(급하지 않은 업데이트)으로 그리므로, 그 값으로만 그리면 새 내용을
 * 다 그릴 때까지 탭이 이전 자리에 머문다. 그래서
 *
 *  - `selected` — 누른 값을 잠깐 들고(주소가 따라오면 내려놓는다) 탭 강조에 쓴다. 즉시 바뀐다.
 *  - `shown` — `selected` 를 미뤄 둔 값. 내용은 이것으로 그린다 — 그리는 동안 이전 내용이 남고,
 *    그 사이 또 누르면 미뤄 둔 그리기는 버려진다.
 *
 * 원본은 여전히 주소다 — 뒤로가기·링크로 주소가 바뀌면 들고 있던 값을 버린다.
 */
export function useSnappyChoice<T>(fromUrl: T): { selected: T; shown: T; choose: (next: T) => void } {
  const [pending, setPending] = useState<{ value: T } | null>(null)
  useEffect(() => setPending(null), [fromUrl])
  const selected = pending ? pending.value : fromUrl
  const shown = useDeferredValue(selected)
  const choose = useCallback((next: T) => setPending({ value: next }), [])
  return { selected, shown, choose }
}

/**
 * 탭 부품 **안에서만** 강조를 즉시 바꾸고, 바깥(화면) 전환은 트랜지션으로 넘긴다.
 *
 * `useSnappyChoice` 는 화면 쪽 state 라, 누를 때마다 그 화면(현황 보드·3D 뷰어를 품은 큰 트리)이
 * 급한 업데이트로 다시 그려진다 — 탭 줄이 그 트리 안에 있으면 강조 하나를 바꾸는 데도 트리 전체를
 * 기다린다(사용자 지적: 선택 강조가 느리다). 이 훅은 탭 부품에서 쓰여 그 부품만 급하게 다시 그리고,
 * `onChange` 는 `startTransition` 안에서 불러 화면 쪽 갱신을 뒤로 민다. 바깥 값이 바뀌면 그 값을 따른다.
 */
export function useInstantChoice<K>(value: K, onChange: (next: K) => void): [K, (next: K) => void] {
  const [local, setLocal] = useState<{ value: K } | null>(null)
  useEffect(() => setLocal(null), [value])
  const choose = useCallback(
    (next: K) => {
      setLocal({ value: next })
      startTransition(() => onChange(next))
    },
    [onChange]
  )
  return [local ? local.value : value, choose]
}
