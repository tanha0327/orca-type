import { next } from '@vercel/functions'
import { withKeymapMeta } from './server/meta'
import { fetchSharedKeymap } from './server/sharedKeymap'
import { isKeymapId } from './src/lib/permalink'

/**
 * Vercel の Routing Middleware。共有リンク（/?k=<投稿ID>）のときだけ、
 * index.html の OGP（タイトル・説明・カード画像）をその投稿のものに差し替えて返す。
 * X などのクローラーは JavaScript を実行しないので、SPA 側で書き換えても読まれないため。
 * 何かに失敗したら手を出さず、普通の index.html（サイト共通のカード）をそのまま返す。
 */
export const config = { matcher: '/' }

export default async function middleware(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const id = url.searchParams.get('k')
  if (!isKeymapId(id)) return next()

  try {
    const [page, item] = await Promise.all([
      fetch(new URL('/index.html', url)),
      // 人が開くときもここを通るので、Supabase が遅いときは待たずに諦める
      fetchSharedKeymap(id, 1500),
    ])
    if (!page.ok || !item) return next()
    return new Response(withKeymapMeta(await page.text(), item, url.origin), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=0, must-revalidate',
      },
    })
  } catch {
    return next()
  }
}
