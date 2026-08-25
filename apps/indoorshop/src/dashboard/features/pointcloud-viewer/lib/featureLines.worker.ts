import * as THREE from 'three'
import { FEATURE_LINE_THRESHOLD_DEG } from './outlineGeometry'

/**
 * 특징선 추출 워커.
 *
 * 블록 하나(6만 삼각형)당 약 164ms 라 메인 스레드에서 돌리면 도면 모드 전환이
 * 초 단위로 멈춘다. 여기서 블록 하나씩 순차 처리하고, 호출부는 도착하는 대로
 * scene 에 붙인다 — 솔리드가 먼저 뜨고 선이 뒤따라 채워진다.
 */

export interface FeatureLinesRequest {
  id: number
  soup: Float32Array
}

export interface FeatureLinesResponse {
  id: number
  positions: Float32Array
}

self.onmessage = (event: MessageEvent<FeatureLinesRequest>) => {
  const { id, soup } = event.data

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(soup, 3))
  const edges = new THREE.EdgesGeometry(geometry, FEATURE_LINE_THRESHOLD_DEG)
  const positions = new Float32Array(edges.getAttribute('position').array as Float32Array)
  edges.dispose()
  geometry.dispose()

  const response: FeatureLinesResponse = { id, positions }
  // 결과는 워커가 새로 만든 버퍼이므로 transfer 해도 안전하다
  ;(self as unknown as Worker).postMessage(response, [positions.buffer])
}
