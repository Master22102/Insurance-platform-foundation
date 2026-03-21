import { AxisProvider } from '../types';

async function fetchJsonWithTimeout(url: string, timeoutMs = 6000): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function weatherCodeLabel(code?: number): string {
  if (code === undefined || code === null) return 'unknown conditions';
  if (code === 0) return 'clear skies';
  if ([1, 2, 3].includes(code)) return 'partly cloudy conditions';
  if ([45, 48].includes(code)) return 'fog potential';
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle risk';
  if ([61, 63, 65, 66, 67].includes(code)) return 'rain risk';
  if ([71, 73, 75, 77].includes(code)) return 'snow risk';
  if ([80, 81, 82].includes(code)) return 'rain shower risk';
  if ([95, 96, 99].includes(code)) return 'thunderstorm risk';
  return 'variable weather';
}

export const openMeteoHyperlocalProvider: AxisProvider = {
  id: 'open-meteo.hyperlocal-weather',
  axis: 'hyperlocal_weather',
  enabled: true,
  async fetch(context) {
    const firstLocation = context.locations?.[0];
    if (!firstLocation) {
      return {
        axis: 'hyperlocal_weather',
        source: 'open-meteo',
        status: 'degraded',
        summary: 'No location detected for weather enrichment.',
        fetchedAt: new Date().toISOString(),
      };
    }

    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(firstLocation)}&count=1&language=en&format=json`;
      const geo = await fetchJsonWithTimeout(geoUrl);
      const top = geo?.results?.[0];
      if (!top?.latitude || !top?.longitude) {
        return {
          axis: 'hyperlocal_weather',
          source: 'open-meteo',
          status: 'degraded',
          summary: `Could not geocode ${firstLocation} for weather checks.`,
          fetchedAt: new Date().toISOString(),
        };
      }

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${top.latitude}&longitude=${top.longitude}&current=temperature_2m,weather_code,wind_speed_10m&daily=precipitation_probability_max&timezone=auto&forecast_days=2`;
      const wx = await fetchJsonWithTimeout(weatherUrl);
      const temp = wx?.current?.temperature_2m;
      const wind = wx?.current?.wind_speed_10m;
      const weatherCode = wx?.current?.weather_code;
      const precip = wx?.daily?.precipitation_probability_max?.[0];

      const summary = `${top.name}: ${weatherCodeLabel(weatherCode)}${typeof temp === 'number' ? `, ${Math.round(temp)}°` : ''}${typeof wind === 'number' ? `, wind ${Math.round(wind)} km/h` : ''}${typeof precip === 'number' ? `, precip chance ${Math.round(precip)}%` : ''}.`;
      return {
        axis: 'hyperlocal_weather',
        source: 'open-meteo',
        status: 'ok',
        summary,
        details: {
          location: top.name,
          latitude: top.latitude,
          longitude: top.longitude,
          temperature_2m: temp,
          wind_speed_10m: wind,
          weather_code: weatherCode,
          precipitation_probability_max: precip,
        },
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      return {
        axis: 'hyperlocal_weather',
        source: 'open-meteo',
        status: 'degraded',
        summary: context.locations?.length
          ? `Weather provider unavailable for ${context.locations[0]}.`
          : 'Weather provider unavailable.',
        fetchedAt: new Date().toISOString(),
      };
    }

  },
};

