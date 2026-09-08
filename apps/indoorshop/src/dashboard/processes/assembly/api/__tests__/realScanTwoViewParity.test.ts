import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fitWallAxis, wallToBayLocal } from '../../../../shared/features/bay-viewer/lib/realScanAnchor'
import {
  PLAN_AZIMUTH,
  PLAN_VIEWPOINT,
  planAlignedAzimuth,
} from '../../../../shared/features/bay-viewer/lib/viewpoint'
import { buildRealScanAnchor, loadRealBayDimensions, REAL_LOCATION_ID } from '../realScanData'
import { fetchFactoryLayout } from '../assemblyApi'

/*
 * **공장 전체 뷰와 베이 진입 뷰가 5BAY 를 두고 같은 말을 하는가.**
 *
 * 사용자가 짚은 자리다 — 공장 뷰의 5BAY 라벨은 '블록 13건' 이라 적혀 있는데 화면에는
 * 회백색 점 덩어리 하나만 서 있었고, 들어가면 갑자기 13개가 색으로 서 있었다. 옆 정반들은
 * 목업 블록을 색으로 세우고 있으니, **진짜 데이터를 가진 정반만 아무것도 인식 못 한
 * 것처럼** 읽혔다.
 *
 * 원인은 프리뷰 자산이 위치·음영만 싣고 라벨·편차를 안 실었던 것이다. 이제 넷을 다 싣고
 * 같은 재판정을 태우므로, 두 화면은 같은 덩이를 같은 색·같은 크기로 말한다.
 *
 * 자산은 생성물이라 이 검사는 **자산끼리의 정합**을 본다 — 스크립트를 다시 돌리거나
 * painting 이 원본을 다시 구웠을 때 한쪽만 갱신되면 여기서 걸린다.
 */

const DIR = '../shell/public/real-scan'
const manifest = JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf8'))
const bytes = (name: string) => new Uint8Array(readFileSync(`${DIR}/${name}`))
const floats = (name: string) => {
  const buf = readFileSync(`${DIR}/${name}`)
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4)
}

/** 프리뷰 라벨 값 규약 — 뷰어(shared)와 자산 로더가 같은 값을 쓴다 */
const FLOOR = 254
const UNLABELED = 255

describe('실측 5BAY — 두 화면의 데이터 정합', () => {
  const preview = floats('factory_preview.bin')
  const previewCount = preview.length / 3
  const labels = bytes('factory_preview_labels.bin')
  const dev = bytes('factory_preview_dev.bin')
  const shade = bytes('factory_preview_shade.bin')

  it('프리뷰의 네 자산이 같은 표본이다 — 길이가 어긋나면 엉뚱한 점이 블록색을 얻는다', () => {
    expect(labels.length).toBe(previewCount)
    expect(dev.length).toBe(previewCount)
    expect(shade.length).toBe(previewCount)
  })

  it('공장 뷰가 그리는 블록 종수가 베이 뷰의 인식 건수와 같다', () => {
    /* 베이 진입 뷰가 세는 것 — manifest 의 정합 블록 */
    const detected = manifest.factory.blocks.length
    expect(detected).toBe(13)

    /* 공장 뷰가 그릴 수 있는 것 — 프리뷰 표본에 남은 블록 인덱스 */
    const drawable = new Set<number>()
    for (const label of labels) if (label < FLOOR) drawable.add(label)

    expect(drawable.size).toBe(detected)
    /* 인덱스는 0..n-1 로 촘촘해야 한다 — 팔레트가 인덱스로 색을 고른다 */
    expect([...drawable].sort((a, b) => a - b)).toEqual(
      Array.from({ length: detected }, (_, i) => i)
    )
  })

  it('라벨 값은 블록 인덱스 · 바닥 · 미정합 셋뿐이다', () => {
    const values = new Set(labels)
    for (const value of values) {
      const known = value < manifest.factory.blocks.length || value === FLOOR || value === UNLABELED
      expect(known, `모르는 라벨 값 ${value}`).toBe(true)
    }
  })

  it('프리뷰는 원본과 같은 자리를 본다 — 경계상자가 홀을 벗어나지 않는다', () => {
    const hall = manifest.hall
    for (let i = 0; i < previewCount; i += 97 /* 성긴 표본이면 충분하다 */) {
      for (let k = 0; k < 3; k++) {
        expect(preview[i * 3 + k]).toBeGreaterThanOrEqual(hall.min[k] - 0.01)
        expect(preview[i * 3 + k]).toBeLessThanOrEqual(hall.max[k] + 0.01)
      }
    }
  })

  /*
   * 임계 재판정이 **양쪽에서 같은 식**인가. 라벨은 자산 임계(0.6m)의 것이고 화면 기본
   * 임계는 30cm 라, 재판정이 없으면 공장 뷰가 더 많은 점을 블록색으로 칠한다.
   */
  it('편차 배열이 화면 임계로 실제로 줄인다 — 재판정이 무의미하지 않다', () => {
    const assetToleranceM = manifest.factory.segmentation.toleranceM
    const cutoff = Math.round((0.3 / assetToleranceM) * 255)

    let labeled = 0
    let kept = 0
    for (let i = 0; i < previewCount; i++) {
      if (labels[i] >= FLOOR) continue
      labeled++
      if (dev[i] <= cutoff) kept++
    }

    expect(labeled).toBeGreaterThan(0)
    /* 줄어들되 다 사라지지는 않는다 — 다 사라지면 임계나 자산이 잘못된 것이다 */
    expect(kept).toBeLessThan(labeled)
    expect(kept / labeled).toBeGreaterThan(0.5)
  })
})

/**
 * ── 두 화면이 홀을 **같은 자세로** 세운다 ──
 *
 * 공장 전체 뷰는 실측 점군을 베이 로컬로 옮겨 그리고(`fetchRealScanOverlay`), 베이 진입
 * 뷰는 display 프레임을 그대로 그린다. 둘 다 three(y-up) 장면 좌표라, 그 사이 변환은
 * **회전이어야 한다**. 반사가 한 번 섞였던 동안 같은 홀이 두 화면에서 좌우 거울상으로
 * 섰다 — 지도에서 오른쪽 벽에 붙어 있던 블록이 진입하면 왼쪽 벽에 붙어 있었고, 카메라를
 * 장축에 맞춰 돌려 놔도(`loadRealScanDisplayAxis`) 그림이 이어지지 않았다.
 *
 * 눈으로는 두 그림이 각도까지 달라 판정하기 어려우므로 **화면 좌표로 견준다**: 13개
 * 블록의 화면 위치를 양쪽에서 구해, 한쪽을 회전·확대만으로 다른 쪽에 포갤 수 있는지 본다.
 * 포개진다 = 같은 자세다. 반사가 끼면 이 맞춤이 무너지고(잔차가 m 급으로 뛴다), 거울상
 * 맞춤 쪽이 이긴다.
 */
describe('실측 5BAY — 두 화면의 자세 정합', () => {
  const SIN_ELEVATION = Math.sin((PLAN_VIEWPOINT.elevationDeg * Math.PI) / 180)
  /** 방위 a 로 선 궤도 카메라가 지면점(x,z)을 떨구는 화면 좌표 (오른쪽+, 아래+) */
  const screenOf = (x: number, z: number, azimuth: number) => ({
    x: x * Math.cos(azimuth) - z * Math.sin(azimuth),
    y: (x * Math.sin(azimuth) + z * Math.cos(azimuth)) * SIN_ELEVATION,
  })
  const centroid = (pts: { x: number; y: number }[]) => ({
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  })
  /** 회전+확대만으로 a → b 를 맞춘 뒤 남는 RMS(m). `mirror` 면 a 를 뒤집고 맞춘다 */
  const fitResidual = (
    a: { x: number; y: number }[],
    b: { x: number; y: number }[],
    mirror = false
  ): number => {
    const ca = centroid(a)
    const cb = centroid(b)
    let sxx = 0
    let syx = 0
    let norm = 0
    let total = 0
    for (let i = 0; i < a.length; i++) {
      const ax = a[i].x - ca.x
      const ay = (a[i].y - ca.y) * (mirror ? -1 : 1)
      const bx = b[i].x - cb.x
      const by = b[i].y - cb.y
      sxx += ax * bx + ay * by
      syx += ax * by - ay * bx
      norm += ax * ax + ay * ay
      total += bx * bx + by * by
    }
    const fit = Math.hypot(sxx, syx)
    return Math.sqrt(Math.max(0, total - (fit * fit) / norm) / a.length)
  }

  it('블록 13건이 두 화면에서 같은 배열로 선다 — 거울상이 아니다', async () => {
    const cloud = floats('factory_preview.bin')
    const wall = fitWallAxis(cloud)
    expect(wall, '프리뷰 점군에서 벽선 프레임이 서야 한다').not.toBeNull()
    const bayDims = await loadRealBayDimensions()
    expect(bayDims, '지번 fixture 에서 5BAY 치수가 나와야 한다').not.toBeNull()
    const positionsOf = (group: string) =>
      manifest.factory.sensors
        .filter((sensor: { group: string }) => sensor.group === group)
        .map((sensor: { position: [number, number, number] }) => sensor.position)
    const built = buildRealScanAnchor(wall!, bayDims!, {
      north: positionsOf('g1'),
      south: positionsOf('g3'),
    })
    expect(built, '앵커 게이트를 통과해야 한다').not.toBeNull()

    /* 공장 전체 뷰의 5BAY 상자 — 점군은 이 상자 안(베이 로컬)에 실린다 */
    const layout = await fetchFactoryLayout('asm-pbs')
    const bay = layout.bays.find((b) => b.bayId === REAL_LOCATION_ID)
    expect(bay, '배치에 실측 베이가 있어야 한다').toBeDefined()
    const bayRad = ((bay!.rotationDeg ?? 0) * Math.PI) / 180

    /* 베이 진입 뷰의 카메라는 홀 장축에 맞춰 돌아간다(`loadRealScanDisplayAxis`) */
    const bayViewAzimuth = planAlignedAzimuth([Math.cos(wall!.angle), Math.sin(wall!.angle)])

    const inBayView: { x: number; y: number }[] = []
    const inFactoryView: { x: number; y: number }[] = []
    for (const block of manifest.factory.blocks as { center: [number, number, number] }[]) {
      inBayView.push(screenOf(block.center[0], block.center[2], bayViewAzimuth))
      const local = wallToBayLocal(built!.anchor, block.center[0], block.center[2])
      /* 베이 상자의 자세·자리까지 태워야 공장 장면의 좌표가 된다 */
      const wx = bay!.center[0] + local.x * Math.cos(bayRad) - local.y * Math.sin(bayRad)
      const wz = bay!.center[1] + local.x * Math.sin(bayRad) + local.y * Math.cos(bayRad)
      inFactoryView.push(screenOf(wx, wz, PLAN_AZIMUTH))
    }

    const direct = fitResidual(inBayView, inFactoryView)
    const mirrored = fitResidual(inBayView, inFactoryView, true)
    /* 그대로 포개진다 — 두 뷰의 카메라 방위 차이가 곧 좌표 변환의 회전이라 잔차가 없다 */
    expect(direct).toBeLessThan(0.05)
    /* 거울상 맞춤은 확연히 나빠야 한다 — 아니면 이 검사가 반사를 못 잡는다는 뜻이다 */
    expect(mirrored).toBeGreaterThan(1)
  })
})
