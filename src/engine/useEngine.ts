import { useEffect, useSyncExternalStore } from 'react'
import type { Binding } from '../data/types'
import { buildCaptureMap, keyboardOf } from '../keyboards/registry'
import type { KeyboardDefinition, KeyId } from '../keyboards/types'
import { useKeymapStore } from '../store/keymapStore'
import { KeyEngine, type EngineSnapshot } from './KeyEngine'

/** アプリ全体で 1 つのエンジンを共有する */
export const engine = new KeyEngine(useKeymapStore.getState().keymap)

// キーマップを編集したら、その場でエンジンに反映する
useKeymapStore.subscribe((state) => engine.setKeymap(state.keymap))

let captureCache: {
  def: KeyboardDefinition
  base: Record<KeyId, Binding> | undefined
  map: Record<string, KeyId>
} | null = null

/**
 * 手元のキーボードの `event.code` → いま編集しているキーボードの KeyId。
 * キーボードかベースレイヤーが変わったときだけ作り直す。
 */
export function keyIdForCode(code: string): KeyId | undefined {
  const { keymap } = useKeymapStore.getState()
  const def = keyboardOf(keymap)
  const base = keymap.layers[0]?.keys
  if (!captureCache || captureCache.def !== def || captureCache.base !== base) {
    captureCache = { def, base, map: buildCaptureMap(def, base) }
  }
  return Object.prototype.hasOwnProperty.call(captureCache.map, code) ? captureCache.map[code] : undefined
}

export function useEngineSnapshot(): EngineSnapshot {
  return useSyncExternalStore(
    (fn) => engine.subscribe(fn),
    engine.getSnapshot,
    engine.getSnapshot,
  )
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || !el.tagName) return false
  if (el.isContentEditable) return true
  return /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
}

/**
 * 実キーボードの入力を、編集中のキーボードのキー位置に読み替えてエンジンへ流す。
 * PiP ウィンドウにフォーカスが移っても止まらないよう、document ごとに張る。
 */
export function attachKeyCapture(doc: Document): () => void {
  const onDown = (e: KeyboardEvent) => {
    if (!useKeymapStore.getState().captureEnabled) return
    if (isTypingTarget(e.target)) return
    // ブラウザ自体のショートカット（⌘R など）は邪魔しない
    if (e.metaKey && e.code !== 'MetaLeft' && e.code !== 'MetaRight') return
    const keyId = keyIdForCode(e.code)
    if (!keyId) return
    e.preventDefault()
    if (e.repeat) return
    engine.keyDown(keyId)
  }

  const onUp = (e: KeyboardEvent) => {
    if (!useKeymapStore.getState().captureEnabled) return
    const keyId = keyIdForCode(e.code)
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
