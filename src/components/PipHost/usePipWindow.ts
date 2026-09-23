import { useCallback, useEffect, useRef, useState } from 'react'

declare global {
  interface DocumentPictureInPictureOptions {
    width?: number
    height?: number
    disallowReturnToOpener?: boolean
    preferInitialWindowPlacement?: boolean
  }
  interface DocumentPictureInPicture extends EventTarget {
    readonly window: Window | null
    requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>
  }
  // eslint-disable-next-line no-var
  var documentPictureInPicture: DocumentPictureInPicture | undefined
}

export function isPipSupported(): boolean {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window
}

/**
 * 開いた PiP ウィンドウへ、元ページのスタイルをすべて移植する。
 * これをやらないと素の HTML として表示されてしまう。
 */
function cloneStyles(target: Window) {
  const doc = target.document

  // 開発中は Vite が <style> を後から差し込むので、両方の経路に対応する
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n')
      const style = doc.createElement('style')
      style.textContent = css
      doc.head.appendChild(style)
    } catch {
      // 別オリジン（Google Fonts など）は読めないので <link> ごと複製する
      const href = (sheet as CSSStyleSheet).href
      if (!href) continue
      const link = doc.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      doc.head.appendChild(link)
    }
  }

  // 構築 API で差し込まれたシートも引き継ぐ
  if (document.adoptedStyleSheets?.length) {
    doc.adoptedStyleSheets = [...document.adoptedStyleSheets]
  }

  doc.documentElement.lang = 'ja'
  doc.body.style.margin = '0'
  doc.body.style.background = '#111111'
  doc.body.style.height = '100%'
  doc.documentElement.style.height = '100%'
}

export interface PipController {
  supported: boolean
  win: Window | null
  open: () => Promise<void>
  close: () => void
  toggle: () => void
  error: string | null
}

export function usePipWindow(size: { width: number; height: number }): PipController {
  const [win, setWin] = useState<Window | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supported = useRef(isPipSupported()).current
  const sizeRef = useRef(size)
  sizeRef.current = size

  const close = useCallback(() => {
    setWin((w) => { w?.close(); return null })
  }, [])

  const open = useCallback(async () => {
    if (!supported || !globalThis.documentPictureInPicture) {
      setError('このブラウザは Document Picture-in-Picture に対応していません。Chrome か Edge でお試しください。')
      return
    }
    try {
      const w = await globalThis.documentPictureInPicture.requestWindow({
        width: sizeRef.current.width,
        height: sizeRef.current.height,
      })
      cloneStyles(w)
      w.document.title = 'ORCA MAP — 出力 HUD'
      w.addEventListener('pagehide', () => setWin(null), { once: true })
      setError(null)
      setWin(w)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PiP ウィンドウを開けませんでした')
    }
  }, [supported])

  const toggle = useCallback(() => { if (win) close(); else void open() }, [win, close, open])

  // ページを離れるときは PiP も閉じる
  useEffect(() => () => { win?.close() }, [win])

  return { supported, win, open, close, toggle, error }
}
