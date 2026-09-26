type FontWeight = 400 | 700 | 900

export interface LoadedFont {
  name: string
  data: ArrayBuffer
  weight: FontWeight
  style: 'normal'
}

/**
 * Google Fonts から、カードに出す文字だけを含むサブセットを取ってくる（text= 指定）。
 * 日本語フォントを丸ごと関数に同梱すると Edge のサイズ上限を超えるため。
 * User-Agent を付けずに取ると TrueType が返り、そのまま Satori に渡せる。
 */
async function loadGoogleFont(family: string, weight: FontWeight, text: string): Promise<LoadedFont> {
  const params = new URLSearchParams({ family: `${family}:wght@${weight}`, text })
  const css = await (await fetch(`https://fonts.googleapis.com/css2?${params}`)).text()
  const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1]
  if (!src) throw new Error(`font not found: ${family} ${weight}`)
  const res = await fetch(src)
  if (!res.ok) throw new Error(`font fetch failed: ${family} ${weight}`)
  return { name: family, data: await res.arrayBuffer(), weight, style: 'normal' }
}

/**
 * アプリと同じ Noto Sans JP（本文）と Archivo（ロゴ）。
 * スクロールパッドの ⇑ ⇓ などの記号は Noto Sans JP に無いので、記号用の Noto も後ろに足しておく
 * （Satori は渡したフォントを順に探して字形を拾う。どれにも無い字形と絵文字は @vercel/og が自動で補う）。
 * 取れなかったフォントは外すだけにして、画像そのものは出す。
 */
export async function loadCardFonts(text: string, logoText: string): Promise<LoadedFont[]> {
  const results = await Promise.allSettled([
    loadGoogleFont('Noto Sans JP', 700, text),
    loadGoogleFont('Noto Sans JP', 900, text),
    loadGoogleFont('Archivo', 900, logoText),
    loadGoogleFont('Noto Sans Math', 400, text),
    loadGoogleFont('Noto Sans Symbols 2', 400, text),
  ])
  return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
}
