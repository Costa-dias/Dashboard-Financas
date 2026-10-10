/**
 * Normalize plain text. React escapes it when rendering; storing HTML entities
 * here would encode the same text again on each edit/import.
 */
export function sanitizeText(input: string): string {
  return input
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

/** Sanitize and cap length; allow empty to pass through for optional fields. */
export function sanitizeTextLimit(input: string, max = 120): string {
  const s = sanitizeText(input);
  return s.length > max ? s.slice(0, max) : s;
}
