/**
 * 共有された配列 1 件を指すリンク（`/?k=<投稿ID>`）。
 * パス（/k/<id>）ではなくクエリにしておけば、ホスティング側に SPA 用の
 * リライト設定が無くても index.html がそのまま返るので、どこに置いても開ける。
 */
const PARAM = 'k'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 投稿 ID（uuid）の形をしているか。uuid 列に変な値を投げないため、DB に聞く前に弾く */
export function isKeymapId(id: string | null | undefined): id is string {
  return !!id && UUID_RE.test(id)
}

/** 今の URL が指している投稿 ID（形式がおかしければ null） */
export function keymapIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const id = new URLSearchParams(window.location.search).get(PARAM)
  return isKeymapId(id) ? id : null
}

/** X などに貼る、その投稿へ直接飛べる URL */
export function keymapPermalink(id: string): string {
  const url = new URL(window.location.pathname, window.location.origin)
  url.searchParams.set(PARAM, id)
  return url.toString()
}

/** アドレスバーの ?k= を書き換える（履歴は増やさない） */
export function setUrlKeymapId(id: string | null) {
  const url = new URL(window.location.href)
  if (id) url.searchParams.set(PARAM, id)
  else url.searchParams.delete(PARAM)
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url)
}
