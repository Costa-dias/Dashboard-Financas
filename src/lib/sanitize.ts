/**
 * Strip HTML/JS-injectable characters from free-form text.
 * Used on all user-entered fields before they are stored or rendered.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/** Sanitize and cap length; allow empty to pass through for optional fields. */
export function sanitizeTextLimit(input: string, max = 120): string {
  const s = sanitizeText(input);
  return s.length > max ? s.slice(0, max) : s;
}
