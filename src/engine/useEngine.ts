import { useEffect, useSyncExternalStore } from 'react'
import { CODE_TO_KEY } from '../data/layout'
import { useKeymapStore } from '../store/keymapStore'
import { KeyEngine, type EngineSnapshot } from './KeyEngine'

/** アプリ全体で 1 つのエンジンを共有する */
export const engine = new KeyEngine(useKeymapStore.getState().keymap)

// キーマップを編集したら、その場でエンジンに反映する
useKeymapStore.subscribe((state) => engine.setKeymap(state.keymap))

export function useEngineSnapshot(): EngineSnapshot {
  return useSyncExternalStore(
    (fn) => engine.subscribe(fn),
    engine.getSnapshot,
    engine.getSnapshot,
  )
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || !el.tagName) return false
  if (el.isContentEditable) return true
  return /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
}

/**
 * 実キーボードの入力を Orca echo のキー位置に読み替えてエンジンへ流す。
 * PiP ウィンドウにフォーカスが移っても止まらないよう、document ごとに張る。
 */
export function attachKeyCapture(doc: Document): () => void {
  const onDown = (e: KeyboardEvent) => {
    if (!useKeymapStore.getState().captureEnabled) return
    if (isTypingTarget(e.target)) return
    // ブラウザ自体のショートカット（⌘R など）は邪魔しない
    if (e.metaKey && e.code !== 'MetaLeft' && e.code !== 'MetaRight') return
    const keyId = CODE_TO_KEY[e.code]
    if (!keyId) return
    e.preventDefault()
    if (e.repeat) return
    engine.keyDown(keyId)
  }

  const onUp = (e: KeyboardEvent) => {
    if (!useKeymapStore.getState().captureEnabled) return
    const keyId = CODE_TO_KEY[e.code]
    if (!keyId) return
    e.preventDefault()
    engine.keyUp(keyId)
  }

  // ウィンドウからフォーカスが外れたら押しっぱなしを解除する
  const onBlur = () => engine.reset()

  doc.addEventListener('keydown', onDown, { capture: true })
  doc.addEventListener('keyup', onUp, { capture: true })
  doc.defaultView?.addEventListener('blur', onBlur)

  return () => {
    doc.removeEventListener('keydown', onDown, { capture: true })
    doc.removeEventListener('keyup', onUp, { capture: true })
    doc.defaultView?.removeEventListener('blur', onBlur)
  }
}

export function useKeyCapture(doc: Document | null) {
  useEffect(() => {
    if (!doc) return
    return attachKeyCapture(doc)
  }, [doc])
}

/** キャプチャを切ったら押下状態を消しておく */
export function useResetOnCaptureOff() {
  const capture = useKeymapStore((s) => s.captureEnabled)
  useEffect(() => {
    if (!capture) engine.reset()
  }, [capture])
}
