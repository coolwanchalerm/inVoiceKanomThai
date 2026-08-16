/**
 * Utility functions for handling number inputs smoothly without leading zero glitches.
 */

/**
 * Strips unnecessary leading zeros while supporting:
 * - Empty string "" (allows clearing field)
 * - Single zero "0"
 * - Decimals like "0.5", "0.25"
 *
 * Examples:
 * "05" -> "5"
 * "007" -> "7"
 * "0" -> "0"
 * "" -> ""
 * "0.5" -> "0.5"
 */
export function cleanNumberInput(value) {
  if (value === '' || value === null || value === undefined) return '';
  const str = String(value);
  if (str === '-') return '-';
  if (str.startsWith('-')) {
    return '-' + str.slice(1).replace(/^0+(?=\d)/, '');
  }
  // Remove leading zeros followed by any digit (preserves decimals like '0.5' and single '0')
  return str.replace(/^0+(?=\d)/, '');
}

/**
 * Automatically selects the entire input text on focus for quick typing over existing values.
 */
export function handleNumberFocus(e) {
  if (e && e.target && typeof e.target.select === 'function') {
    e.target.select();
  }
}
