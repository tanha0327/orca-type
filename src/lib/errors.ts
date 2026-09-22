/**
 * Supabase のエラー（PostgrestError）は Error を継承していないので、
 * instanceof Error だけで見るとメッセージが拾えない。
 */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string' && e.message) {
    return e.message
  }
  return '不明なエラー'
}
