/** Minimal className joiner — keeps conditional Tailwind readable without deps. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
