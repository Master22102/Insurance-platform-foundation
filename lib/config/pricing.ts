export const PRICING = {
  tripUnlockUsd: 14.99,
  deepScanSingleUsd: 44.99,
  deepScanPack3Usd: 119.99,
  deepScanCreditsIncludedOnUnlock: 2,
} as const;

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
