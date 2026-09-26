import { ImageResponse } from '@vercel/og'
import type { ReactElement } from 'react'
import { loadCardFonts } from '../server/fonts'
import { CARD_HEIGHT, CARD_WIDTH, LOGO_TEXT, buildCard, collectText } from '../server/ogCard'
import { fetchSharedKeymap } from '../server/sharedKeymap'

/**
 * GET /api/og?k=<投稿ID> — 共有された配列のカード画像（OGP の og:image）。
 * middleware.ts が ?k= 付きのページの og:image をここに向ける。
 * 投稿が見つからなければ、サイト共通のカード画像に回す。
 */
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get('k') ?? ''
  const fallback = () => Response.redirect(new URL('/og-image.png', req.url), 302)
  const item = await fetchSharedKeymap(id).catch(() => null)
  if (!item) return fallback()

  // 形チェックは大まかなので、古い・壊れたデータで組み立てに失敗したら共通のカードに回す
  let card
  try {
    card = buildCard(item)
  } catch {
    return fallback()
  }
  const fonts = await loadCardFonts(collectText(card), LOGO_TEXT)
  return new ImageResponse(card as unknown as ReactElement, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts,
  })
}
