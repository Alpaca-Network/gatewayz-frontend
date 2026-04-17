/**
 * Format a credit amount for display.
 *
 * Uses floor-truncation to 2 decimal places to avoid JS toFixed rounding
 * (e.g. 97.9985.toFixed(2) === "98.00" — wrong).
 *
 * 1 credit = $1. No unit conversion.
 */
export function formatCredits(amount: number): string {
  const truncated = Math.floor(amount * 100) / 100;
  return truncated.toFixed(2);
}

/**
 * Format a credit amount as a dollar string: "$97.99"
 */
export function formatCreditsDollar(amount: number): string {
  return `$${formatCredits(amount)}`;
}
