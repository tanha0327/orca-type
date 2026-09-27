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

/**
 * テーブルがまだ無い（SQL が未実行）か、テーブルに API の権限が付いていないときのエラーか。
 * どちらもその機能の欄を出さずにアプリを動かし続けるために見分ける
 */
export function isFeatureUnavailableError(e: unknown): boolean {
  if (!e || typeof e !== 'object' || !('code' in e)) return false
  // PGRST205: スキーマにテーブルが無い / 42P01: テーブルが無い / 42501: 権限が無い
  return e.code === 'PGRST205' || e.code === '42P01' || e.code === '42501'
}
