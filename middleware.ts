import { next } from '@vercel/functions'
import { isKeymapId } from './src/lib/permalink.js'

/**
 * Vercel の Routing Middleware。共有リンク（/?k=<投稿ID>）のときだけ、
 * index.html の OGP（タイトル・説明・カード画像）をその投稿のものに差し替えて返す。
 * X などのクローラーは JavaScript を実行しないので、SPA 側で書き換えても読まれないため。
 * 何かに失敗したら手を出さず、普通の index.html（サイト共通のカード）をそのまま返す。
 *
 * matcher が '/' なので、このファイルが読み込めないとトップページがまるごと 500
 * （MIDDLEWARE_INVOCATION_FAILED）になる。そうならないように:
 * - Vercel はこれを束ねずに Node の ES モジュールのまま動かすので、相対 import には .js を付ける
 *   （抜けていると読み込みで落ちる。npm run typecheck の tsconfig.server.json でエラーにしている）
 * - キーボード定義まで抱える重い処理は ?k= のときだけ読み込み、読み込みに失敗しても普通のページを返す
 */
export const config = { matcher: '/', runtime: 'nodejs' }

export default async function middleware(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const id = url.searchParams.get('k')
  if (!isKeymapId(id)) return next()

  try {
    const [{ withKeymapMeta }, { fetchSharedKeymap }] = await Promise.all([
      import('./server/meta.js'),
      import('./server/sharedKeymap.js'),
    ])
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
