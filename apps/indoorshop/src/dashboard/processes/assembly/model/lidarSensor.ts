export type LidarSensorStatus = 'online' | 'offline' | 'error'

export interface LidarSensor {
  id: string
  locationId: string
  name: string
  status: LidarSensorStatus
  lastScanAt: string
}
