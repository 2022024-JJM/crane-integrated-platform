import { publicAsset } from '../../../shared/lib/public-asset'
import type { BlockModelManifest, LoadedBlockModel } from '../model/types'

const cache = new Map<string, Promise<LoadedBlockModel>>()
const manifestCache = new Map<string, Promise<BlockModelManifest>>()

/**
 * 매니페스트(.json)만 로드한다 — geometry(.bin, 블록당 ~2MB)는 건드리지 않는다.
 *
 * 조립체 목록·부재 수·송선기호처럼 **형상을 그리지 않고 세기만 하는** 집계용이다.
 * 공장 목록처럼 여러 블록을 한 번에 훑는 화면에서 전체 모델을 받으면
 * 화면 하나에 10MB가 넘어가므로, 그런 곳은 반드시 이쪽을 쓴다.
 */
export function loadBlockManifest(projNo: string, blkNo: string): Promise<BlockModelManifest> {
  const key = `${projNo}_${blkNo}`

  // 전체 모델이 이미 (또는 곧) 있으면 그 안의 매니페스트를 그대로 쓴다
  const full = cache.get(key)
  if (full) return full.then((model) => model.manifest)

  const cached = manifestCache.get(key)
  if (cached) return cached

  const promise = (async (): Promise<BlockModelManifest> => {
    const response = await fetch(publicAsset(`/models/${key}.json`))
    if (!response.ok) throw new Error(`블록 매니페스트 로드 실패: ${key}`)
    return (await response.json()) as BlockModelManifest
  })()

  promise.catch(() => manifestCache.delete(key))
  manifestCache.set(key, promise)
  return promise
}

/**
 * public/models/{projNo}_{blkNo}.json + .bin 을 로드한다.
 * 블록당 ~2MB이므로 결과는 세션 내 캐시된다.
 */
export function loadBlockModel(projNo: string, blkNo: string): Promise<LoadedBlockModel> {
  const key = `${projNo}_${blkNo}`
  const cached = cache.get(key)
  if (cached) return cached

  const promise = (async (): Promise<LoadedBlockModel> => {
    const [manifestRes, binRes] = await Promise.all([
      fetch(publicAsset(`/models/${key}.json`)),
      fetch(publicAsset(`/models/${key}.bin`)),
    ])
    if (!manifestRes.ok || !binRes.ok) {
      throw new Error(`블록 모델 로드 실패: ${key}`)
    }
    const manifest = (await manifestRes.json()) as BlockModelManifest
    const buffer = await binRes.arrayBuffer()
    return { manifest, positions: new Float32Array(buffer) }
  })()

  // 실패 시 캐시에서 제거해 재시도 가능하게
  promise.catch(() => cache.delete(key))
  cache.set(key, promise)
  return promise
}
