export const TERMINAL_STATUSES = new Set(['applied', 'expired', 'rejected'])

export function normalizeStatus(status: string | null | undefined): string {
  return (status || '').toLowerCase()
}
