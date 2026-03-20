export type WeatherConditionCode =
  | 0
  | 1
  | 2
  | 3
  | 45
  | 48
  | 51
  | 53
  | 55
  | 56
  | 57
  | 61
  | 63
  | 65
  | 66
  | 67
  | 71
  | 73
  | 75
  | 77
  | 80
  | 81
  | 82
  | 85
  | 86
  | 95
  | 96
  | 99;

export type WeatherFetchState = 'loading' | 'success' | 'unavailable';

export type WeatherIconKey =
  | 'sun'
  | 'moon'
  | 'cloud-sun'
  | 'cloud-moon'
  | 'cloud'
  | 'cloud-rain'
  | 'cloud-snow'
  | 'cloud-fog'
  | 'cloud-lightning';

export type WeatherLocationSource = 'current-location' | 'region';

export interface WeatherSnapshot {
  temperature: number;
  conditionCode: WeatherConditionCode;
  isDay: boolean;
}

export interface WeatherLocationTarget {
  latitude: number;
  longitude: number;
  labelKey: string;
  source: WeatherLocationSource;
}
