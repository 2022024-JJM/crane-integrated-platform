import type { WeatherIconKey, WeatherSnapshot } from '../model/types';

export function getWeatherPresentation(snapshot: WeatherSnapshot): {
  iconKey: WeatherIconKey;
  label: string;
} {
  const { conditionCode, isDay } = snapshot;

  if (conditionCode === 0) {
    return {
      iconKey: isDay ? 'sun' : 'moon',
      label: 'clear',
    };
  }

  if (conditionCode === 1 || conditionCode === 2) {
    return {
      iconKey: isDay ? 'cloud-sun' : 'cloud-moon',
      label: 'partly-cloudy',
    };
  }

  if (conditionCode === 3) {
    return {
      iconKey: 'cloud',
      label: 'cloudy',
    };
  }

  if (conditionCode === 45 || conditionCode === 48) {
    return {
      iconKey: 'cloud-fog',
      label: 'fog',
    };
  }

  if (
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(conditionCode)
  ) {
    return {
      iconKey: 'cloud-rain',
      label: 'rain',
    };
  }

  if ([71, 73, 75, 77, 85, 86].includes(conditionCode)) {
    return {
      iconKey: 'cloud-snow',
      label: 'snow',
    };
  }

  if ([95, 96, 99].includes(conditionCode)) {
    return {
      iconKey: 'cloud-lightning',
      label: 'thunderstorm',
    };
  }

  return {
    iconKey: 'cloud',
    label: 'cloudy',
  };
}
