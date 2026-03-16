/**
 * Strip TRC-20 / TRC20 suffix from currency codes for display.
 * e.g. "USDT-TRC20" → "USDT", "USDT TRC-20" → "USDT"
 */
export function cleanCurrencySymbol(symbol: string): string {
  return symbol.replace(/[-\s]?TRC-?20/gi, '').trim() || symbol;
}

/**
 * Format amount with currency symbol.
 */
export function formatAmount(amount: string, symbol: string): string {
  const clean = cleanCurrencySymbol(symbol);
  const num = parseFloat(amount);
  if (isNaN(num)) return `${clean}0.00`;
  return `${clean} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format date to a human-readable relative time or date string.
 */
/**
 * Format card number with spaces every 4 digits.
 */
export function formatCardNumber(cardNumber: string): string {
  return cardNumber.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Format date to a human-readable relative time or date string.
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Только что';
  if (diffMins < 60) return `${diffMins} мин. назад`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} ч. назад`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} дн. назад`;

  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}
