import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { attachKeyCapture } from '../../engine/useEngine'

/**
 * PiP ウィンドウの body へ React ツリーを流し込む。
 * PiP 側にフォーカスがあっても打鍵を拾えるよう、その document にもキャプチャを張る。
 */
export function PipPortal({ win, children }: { win: Window | null; children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!win) { setHost(null); return }
    const el = win.document.createElement('div')
    el.style.height = '100%'
    win.document.body.appendChild(el)
    setHost(el)
    const detach = attachKeyCapture(win.document)
    return () => {
      detach()
      el.remove()
      setHost(null)
    }
  }, [win])

  if (!host) return null
  return createPortal(children, host)
}
