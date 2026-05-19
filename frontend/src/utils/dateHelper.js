/**
 * Date helper for TASMAC POS.
 * 
 * If the current time is between 12:00 AM and 4:00 AM (midnight shift),
 * the effective business date is YESTERDAY, not today.
 * This is because TASMAC shops close around midnight-2AM and workers
 * finish entering data after closing.
 */

/**
 * Format a Date object as YYYY-MM-DD using LOCAL timezone (not UTC).
 */
export function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get the effective business date as a YYYY-MM-DD string (LOCAL timezone).
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

  return formatDate(now);
}
