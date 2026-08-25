export type FactoryHealth = 'healthy' | 'degraded' | 'unhealthy'

export interface Factory {
  id: string
  name: string
  displayName: string
  /** 조립Shop 코드 (ASSY_SHOP) */
  assyShop: string
  locationCount: number
  health: FactoryHealth
}
