// Salt prefix to prevent rainbow table attacks on 6-digit PINs
const PIN_SALT = 'kanom_store_secure_salt_2026_';

/**
 * Hash a 6-digit PIN using SHA-256 and salt
 * @param {string} pin - 6-digit PIN
 * @returns {Promise<string>} Hexadecimal SHA-256 hash
 */
export async function hashPin(pin) {
  if (!pin) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(PIN_SALT + pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
