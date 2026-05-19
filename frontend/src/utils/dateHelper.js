/**
 * Date helper for TASMAC POS.
 * 
 * If the current time is between 12:00 AM and 4:00 AM (midnight shift),
 * the effective business date is YESTERDAY, not today.
 * This is because TASMAC shops close around midnight-2AM and workers
 * finish entering data after closing.
 */

/**
 * Get the effective business date as a YYYY-MM-DD string.
 * Between 12:00 AM - 3:59 AM, returns yesterday's date.
 * Otherwise returns today's date.
 */
export function getEffectiveDate() {
  const now = new Date();
  const hour = now.getHours();

  // If between midnight (0) and 4 AM, treat as previous day's business
  if (hour >= 0 && hour < 4) {
    now.setDate(now.getDate() - 1);
  }

  return now.toISOString().split('T')[0];
}

/**
 * Format a Date object as YYYY-MM-DD
 */
export function formatDate(d) {
  return d.toISOString().split('T')[0];
}
