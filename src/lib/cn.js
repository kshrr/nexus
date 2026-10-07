/**
 * Tiny classname joiner. Filters falsy values so conditional classes read
 * cleanly: cn('base', isActive && 'active', error && 'border-rust-600').
 *
 * @param {...(string | false | null | undefined)} classes
 * @returns {string}
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default cn;
