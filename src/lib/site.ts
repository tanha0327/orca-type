/**
 * X のポストなど、サイトの外に出すリンクに載せる本番サイトの URL。
 * テスト用のサイト（staging）で操作しても、ポストにテスト用の URL が載らないようにする。
 * 独自ドメインに移ったときは VITE_PUBLIC_SITE_URL で差し替えられる。
 * ログイン後の戻り先などサイト内の移動には、これではなく window.location.origin を使うこと。
 */
export const PUBLIC_SITE_URL: string =
  (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.replace(/\/+$/, '')
  || 'https://orca-map.vercel.app'
