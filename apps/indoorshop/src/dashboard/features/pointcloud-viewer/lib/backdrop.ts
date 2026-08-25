import * as THREE from 'three'

/**
 * 위아래 그라디언트 배경.
 *
 * 단색 바탕은 점군을 허공에 띄워 놓은 것처럼 보이게 한다 — 위를 살짝 들어 올리면
 * 바닥이 어디인지가 읽히고, 같은 점이라도 형상으로 보인다.
 * (4×256 이면 충분하다 — 세로로만 변하는 그라디언트다)
 */
export function createBackdrop(topHex: number, bottomHex: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  const css = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`
  gradient.addColorStop(0, css(topHex))
  gradient.addColorStop(1, css(bottomHex))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
