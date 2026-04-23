import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  fetchOpenMeteoCurrentWeather,
  getSiteWeatherTarget,
  type WeatherFetchState,
  type WeatherLocationTarget,
  type WeatherSnapshot,
} from '@crane/domain/weather';

type HeaderWeatherState = {
  status: WeatherFetchState;
  snapshot: WeatherSnapshot | null;
  locationLabelKey: string | null;
};

type HeaderWeatherRequest =
  | {
      type: 'site';
      key: string;
      target: WeatherLocationTarget;
    }
  | {
      type: 'unavailable';
      key: string;
    };

type HeaderWeatherResult = {
  requestKey: string;
  status: Exclude<WeatherFetchState, 'loading'>;
  snapshot: WeatherSnapshot | null;
};

const UNAVAILABLE_WEATHER_STATE: HeaderWeatherState = {
  status: 'unavailable',
  snapshot: null,
  locationLabelKey: null,
};

export function useHeaderWeather(): HeaderWeatherState {
  const { pathname } = useLocation();
  const request = useMemo(
    () => resolveHeaderWeatherRequest(pathname),
    [pathname],
  );
  const [result, setResult] = useState<HeaderWeatherResult>({
    requestKey: '',
    status: 'unavailable',
    snapshot: null,
  });

  useEffect(() => {
    if (request.type === 'unavailable') {
      return undefined;
    }

    const abortController = new AbortController();
    let isDisposed = false;

    void loadWeather(request.target, abortController.signal).then(
      (snapshot) => {
        queueMicrotask(() => {
          if (isDisposed || abortController.signal.aborted) {
            return;
          }

          setResult({
            requestKey: request.key,
            status: snapshot ? 'success' : 'unavailable',
            snapshot,
          });
        });
      },
    );

    return () => {
      isDisposed = true;
      abortController.abort();
    };
  }, [request]);

  if (request.type === 'unavailable') {
    return UNAVAILABLE_WEATHER_STATE;
  }

  if (result.requestKey !== request.key) {
    return {
      status: 'loading',
      snapshot: null,
      locationLabelKey: request.target.labelKey,
    };
  }

  if (result.status === 'success' && result.snapshot) {
    return {
      status: 'success',
      snapshot: result.snapshot,
      locationLabelKey: request.target.labelKey,
    };
  }

  return UNAVAILABLE_WEATHER_STATE;
}

async function loadWeather(
  target: WeatherLocationTarget,
  signal: AbortSignal,
): Promise<WeatherSnapshot | null> {
  return fetchOpenMeteoCurrentWeather(
    target.latitude,
    target.longitude,
    signal,
  );
}

function resolveHeaderWeatherRequest(pathname: string): HeaderWeatherRequest {
  if (isSiteWeatherSupportedPath(pathname)) {
    return {
      type: 'site',
      key: 'site:default',
      target: getSiteWeatherTarget(),
    };
  }

  return {
    type: 'unavailable',
    key: `unavailable:${pathname}`,
  };
}

export type { HeaderWeatherState };

function isSiteWeatherSupportedPath(pathname: string) {
  return (
    pathname === '/' ||
    pathname === '/region-overview' ||
    pathname.startsWith('/monitoring') ||
    /^\/(?:outdoor-work|indoor-work)\/[^/]+(?:\/.*)?$/.test(pathname)
  );
}
