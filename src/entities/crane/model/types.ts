export type CraneStatus = "운행" | "대기" | "점검" | "경고" | "정지"

export interface CraneOperationalData {
  id: string
  name: string
  regionId: string
  status: CraneStatus
  load: number
  maxLoad: number
  windSpeed: number
  boomAngle: number
  hoistHeight: number
  slewAngle: number
  trolleyPosition: number
  lastUpdated: string
}
