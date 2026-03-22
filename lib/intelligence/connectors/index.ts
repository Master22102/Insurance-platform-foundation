import { registerAxisProvider } from './registry';
import { coverageItineraryMatchProvider } from './providers/coverage-itinerary-match';
import { openMeteoHyperlocalProvider } from './providers/open-meteo-hyperlocal';
import { frankfurterCurrencyProvider } from './providers/frankfurter-currency';

let initialized = false;

export function initConnectorRegistry() {
  if (initialized) return;
  registerAxisProvider(coverageItineraryMatchProvider);
  registerAxisProvider(openMeteoHyperlocalProvider);
  registerAxisProvider(frankfurterCurrencyProvider);
  initialized = true;
}

export * from './types';
export * from './registry';

