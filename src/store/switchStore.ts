import { create } from 'zustand'
import type { SocketId, SwitchType } from '../data/switches'
import type { SpecTagId } from '../keyboards/specs'
import type { KeyboardDefinition } from '../keyboards/types'

/**
 * 詳しく見るシートの中身。キースイッチの画面からも、みんなの配列の投稿からも開く。
 * keyboard は投稿の「⌨ キーボード名」から開くので、取り込んだキーボードでも描けるよう定義ごと持つ
 */
export type SwitchDetail =
  | { kind: 'switch'; id: string }
  | { kind: 'tag'; id: SpecTagId; keyboardId?: string }
  | { kind: 'socket'; id: SocketId }
  | { kind: 'keyboard'; def: KeyboardDefinition }

/** スイッチ一覧のソケットの絞り込み。board は見ているキーボード（の版）に合うもの */
export type SocketFilter = 'board' | 'all' | SocketId

/** スイッチ一覧の種類の絞り込み。silent は静音のもの */
export type TypeFilter = SwitchType | 'silent' | 'all'

interface SwitchState {
  /** キースイッチの画面で見ているキーボード。null のあいだは編集中のキーボード */
  keyboardId: string | null
  /** 見ているキーボードの版（エディション）の番号 */
  edition: number
  socket: SocketFilter
  type: TypeFilter
  query: string
  /** 開いている詳細。null なら閉じている */
  detail: SwitchDetail | null
  /** 詳細の中からたどって開いたとき、戻れるように前の詳細を積んでおく */
  history: SwitchDetail[]

  /** 見るキーボードを変える（版と絞り込みは最初に戻す） */
  setKeyboard: (id: string | null) => void
  setEdition: (n: number) => void
  setSocket: (f: SocketFilter) => void
  setType: (f: TypeFilter) => void
  setQuery: (q: string) => void
  /** 詳細を開く。すでに開いていれば、いまの詳細を「戻る」先に積む */
  openDetail: (d: SwitchDetail) => void
  back: () => void
  closeDetail: () => void
}

export const useSwitchStore = create<SwitchState>()((set, get) => ({
  keyboardId: null,
  edition: 0,
  socket: 'board',
  type: 'all',
  query: '',
  detail: null,
  history: [],

  setKeyboard: (id) => set({ keyboardId: id, edition: 0, socket: 'board' }),
  setEdition: (n) => set({ edition: n, socket: 'board' }),
  setSocket: (f) => set({ socket: f }),
  setType: (f) => set({ type: f }),
  setQuery: (q) => set({ query: q }),
  openDetail: (d) => {
    const { detail, history } = get()
    set({ detail: d, history: detail ? [...history, detail] : [] })
  },
  back: () => {
    const { history } = get()
    set({ detail: history[history.length - 1] ?? null, history: history.slice(0, -1) })
  },
  closeDetail: () => set({ detail: null, history: [] }),
}))
