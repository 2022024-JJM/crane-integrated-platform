import type { LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { getWeatherPresentation, WeatherIcon } from '@/entities/weather';
import { useHeaderWeather } from './use-header-weather';

type HeaderWeatherPillModel = {
  Icon: ComponentType<LucideProps>;
  label: string;
  temperatureText?: string;
};

export function useHeaderWeatherPill(): HeaderWeatherPillModel {
  const { t } = useTranslation();
  const weather = useHeaderWeather();
  const weatherPresentation = weather.snapshot
    ? getWeatherPresentation(weather.snapshot)
    : null;
  const label =
    weather.status === 'loading'
      ? t('header.weatherLoading')
      : weather.locationLabelKey
        ? t(weather.locationLabelKey)
        : t('header.weatherUnavailable');

  const temperatureText =
    weather.status === 'loading'
      ? undefined
      : weather.status === 'success' && weather.snapshot
        ? `${Math.round(weather.snapshot.temperature)}°`
        : '--°';

  const Icon: ComponentType<LucideProps> = (props) => (
    <WeatherIcon
      {...props}
      status={weather.status}
      iconKey={weatherPresentation?.iconKey}
    />
  );

  return {
    Icon,
    label,
    temperatureText,
  };
}
