/*
 * 설비 버드뷰 — 공장 하나를 위에서 내려다본 2D 벡터 그림.
 * 그리드가 "무엇이 이상인가"를 답하면, 이 그림이 "그게 어느 자리인가"를 답한다.
 */
export { EquipmentBirdview, type EquipmentBirdviewProps } from './ui/EquipmentBirdview'
export type { BirdviewBay, BirdviewPoint } from './model/types'
export { boundsOfPoints, fitProjection, pathOf, LON_SQUEEZE } from './lib/projection'
export { convexHullOf } from './lib/hull'
export { declusterPoints, type DeclusterInput, type DeclusterOptions } from './lib/decluster'
export { birdviewBaysOf, birdviewPointsOf, type BirdviewPointInput } from './lib/fromEquipment'
