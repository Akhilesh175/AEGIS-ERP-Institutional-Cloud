/**
 * nameUtils.ts – AEGIS ERP
 *
 * Shared name-formatting utilities.
 * Always use these instead of raw template literals so that an empty or
 * missing Last Name never produces a trailing space.
 *
 * Examples
 *   formatName('Leo', 'DaVinci')  → 'Leo DaVinci'
 *   formatName('Leo', '')         → 'Leo'
 *   formatName('Leo', null)       → 'Leo'
 *   formatName('Leo', undefined)  → 'Leo'
 *   formatName('', '')            → ''
 */

/** Build a display name from separate first / last parts. */
export function formatName(
  firstName?: string | null,
  lastName?: string | null
): string {
  return [firstName?.trim(), lastName?.trim()]
    .filter(Boolean)
    .join(' ');
}

/**
 * Build a display name from a user-like object that has
 * `firstName` / `lastName` camelCase fields.
 */
export function formatUserName(user?: {
  firstName?: string | null;
  lastName?: string | null;
} | null): string {
  if (!user) return '';
  return formatName(user.firstName, user.lastName);
}

/**
 * Build a display name from a DB row that has
 * `first_name` / `last_name` snake_case fields.
 */
export function formatDbName(row?: {
  first_name?: string | null;
  last_name?: string | null;
} | null): string {
  if (!row) return '';
  return formatName(row.first_name, row.last_name);
}
