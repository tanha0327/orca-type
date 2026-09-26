import { useEffect, useMemo, useRef, useState } from 'react'
import { importKeyboard, IMPORT_FORMAT_LABEL, type ImportResult } from '../../keyboards/import'
import { BUILTIN_KEYBOARDS, createKeymap, keyboardOf } from '../../keyboards/registry'
import {
  FIRMWARE_LABEL, SENSOR_KIND_LABEL,
  type KeyboardDefinition, type SensorKind,
} from '../../keyboards/types'
import { useKeymapStore } from '../../store/keymapStore'
import { KeyboardView } from './KeyboardView'

/** 「49 キー・エンコーダー 1・パッド 2」のような一行の説明 */
function summary(def: KeyboardDefinition): string {
  const counts = new Map<SensorKind, number>()
  for (const s of def.sensors ?? []) counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1)
  const sensors = [...counts].map(([kind, n]) => `${SENSOR_KIND_LABEL[kind]} ${n}`)
  const split = def.keys.some((k) => k.half === 'R') ? '分割' : '一体型'
  return [`${def.keys.length} キー`, split, ...sensors].join('・')
}

function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * 編集するキーボードを選ぶモーダル。
 * 組み込みの機種から選ぶか、QMK / VIA / KLE / ZMK の配列データを貼り付けて取り込む。
 * 切り替えても前のキーボードのキーマップは保存しておき、戻ってきたら続きから編集できる。
 */
export function KeyboardPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const keymap = useKeymapStore((s) => s.keymap)
  const savedKeymaps = useKeymapStore((s) => s.savedKeymaps)
  const switchKeyboard = useKeymapStore((s) => s.switchKeyboard)
  const forgetKeyboard = useKeymapStore((s) => s.forgetKeyboard)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const current = keyboardOf(keymap)
  const customs = useMemo(() => {
    const list = Object.values(savedKeymaps).flatMap((km) => (km.keyboardDef ? [km.keyboardDef] : []))
    return keymap.keyboardDef ? [keymap.keyboardDef, ...list] : list
  }, [savedKeymaps, keymap.keyboardDef])

  if (!open) return null

  const choose = (def: KeyboardDefinition) => {
    switchKeyboard(def)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
      style={{ background: 'color-mix(in srgb, var(--color-ink) 45%, transparent)' }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="キーボードを選ぶ"
        className="nb nb-lg flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden"
      >
        <header className="flex items-center gap-2 border-b-[3px] border-[var(--color-ink)] p-3">
          <div className="min-w-0 flex-1">
            <p className="nb-eyebrow">KEYBOARD</p>
            <h3 className="truncate text-[1.1rem]">キーボードを選ぶ</h3>
          </div>
          <button type="button" className="nb-btn !py-1.5 !px-3 text-[0.9rem]" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
          <p className="text-[0.74rem] font-bold leading-relaxed opacity-65">
            キーボードを切り替えても、いまのキーマップは保存されます。戻ってくると続きから編集できます。
          </p>

          <section>
            <h4 className="mb-2 text-[0.95rem]">組み込みのキーボード</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {BUILTIN_KEYBOARDS.map((def) => (
                <BoardCard
                  key={def.id}
                  def={def}
                  current={def.id === current.id}
                  saved={!!savedKeymaps[def.id]}
                  onChoose={() => choose(def)}
                />
              ))}
            </div>
          </section>

          {customs.length > 0 && (
            <section>
              <h4 className="mb-2 text-[0.95rem]">取り込んだキーボード</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {customs.map((def) => (
                  <BoardCard
                    key={def.id}
                    def={def}
                    current={def.id === current.id}
                    saved={!!savedKeymaps[def.id]}
                    onChoose={() => choose(def)}
                    onForget={def.id === current.id ? undefined : () => {
                      if (confirm(`「${def.name}」とそのキーマップを削除しますか？`)) forgetKeyboard(def.id)
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          <ImportSection onUse={choose} />
        </div>
      </div>
    </div>
  )
}

function BoardCard({
  def, current, saved, onChoose, onForget,
}: {
  def: KeyboardDefinition
  current: boolean
  saved: boolean
  onChoose: () => void
  onForget?: () => void
}) {
  return (
    <div className="flex items-stretch gap-1.5">
      <button
        type="button"
        className="nb-btn !min-w-0 !flex-1 !flex-col !items-start !gap-1 !p-2.5 text-left"
        data-active={current}
        onClick={onChoose}
      >
        <span className="flex w-full items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[0.9rem] font-black">{def.name}</span>
          {current && <span className="nb-chip shrink-0 !py-0 !text-[0.55rem]" style={{ background: 'var(--color-lime)' }}>編集中</span>}
          {!current && saved && <span className="nb-chip shrink-0 !py-0 !text-[0.55rem]" style={{ background: 'var(--color-sand)' }}>保存あり</span>}
        </span>
        <span className="text-[0.68rem] font-bold opacity-65">
          {[def.maker, FIRMWARE_LABEL[def.firmware]].filter(Boolean).join(' ・ ')}
        </span>
        <span className="text-[0.68rem] font-bold opacity-65">{summary(def)}</span>
      </button>
      {onForget && (
        <button type="button" className="nb-btn !px-2.5" onClick={onForget} aria-label={`${def.name} を削除`}>
          ✕
        </button>
      )}
    </div>
  )
}

function ImportSection({ onUse }: { onUse: (def: KeyboardDefinition) => void }) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [pick, setPick] = useState(0)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const run = (source: string, file = fileName) => {
    setError(null)
    setResult(null)
    if (!source.trim()) return
    try {
      const r = importKeyboard(source, file)
      setResult(r)
      setPick(r.defaultIndex)
      setName(r.candidates[r.defaultIndex].def.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込めませんでした')
    }
  }

  const loadFile = async (file: File) => {
    if (file.size > 2_000_000) {
      setError('ファイルが大きすぎます（2MB まで）')
      return
    }
    const content = await file.text()
    setText(content)
    setFileName(file.name)
    run(content, file.name)
  }

  const candidate = result?.candidates[pick]
  const preview = useMemo(() => (candidate ? createKeymap(candidate.def) : null), [candidate])
  const finalDef = candidate ? { ...candidate.def, name: name.trim() || candidate.def.name } : null

  return (
    <section>
      <h4 className="text-[0.95rem]">配列を取り込む</h4>
      <p className="mt-1 text-[0.72rem] font-bold leading-relaxed opacity-65">
        自作キーボードの配列データを貼り付けるか、ファイルを選んでください。対応している形式：
        QMK の <code>info.json</code> / <code>keyboard.json</code>、VIA・Vial の定義 JSON、
        keyboard-layout-editor の Raw data、ZMK の physical layout（<code>&amp;key_physical_attrs</code>）。
      </p>

      <textarea
        className="nb-input mt-2 h-28 font-mono !text-[0.7rem]"
        placeholder={'例: {"layouts": {"LAYOUT": {"layout": [{"matrix": [0, 0], "x": 0, "y": 0}, …]}}}'}
        value={text}
        spellCheck={false}
        onChange={(e) => { setText(e.target.value); setFileName('') }}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="nb-btn !py-1.5 text-[0.8rem]" onClick={() => run(text)} disabled={!text.trim()}>
          読み取る
        </button>
        <button type="button" className="nb-btn !py-1.5 text-[0.8rem]" onClick={() => fileRef.current?.click()}>
          ファイルを選ぶ
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.dtsi,.overlay,.keymap,.txt,application/json,text/plain"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = '' }}
        />
      </div>

      {error && (
        <p className="nb mt-2 p-2 text-[0.76rem] font-bold" style={{ background: 'var(--color-pink)' }}>{error}</p>
      )}

      {result && candidate && finalDef && preview && (
        <div className="nb mt-3 space-y-3 p-3">
          <p className="text-[0.72rem] font-bold opacity-70">
            {IMPORT_FORMAT_LABEL[result.format]} として読み取りました ・ {summary(candidate.def)}
          </p>

          {result.candidates.length > 1 && (
            <label className="block">
              <span className="nb-eyebrow">配列（レイアウト）</span>
              <select
                className="nb-input mt-1 !py-1.5 text-[0.82rem]"
                value={pick}
                onChange={(e) => {
                  const i = Number(e.target.value)
                  setPick(i)
                  setName(result.candidates[i].def.name)
                }}
              >
                {result.candidates.map((c, i) => (
                  <option key={c.label} value={i}>{c.label}（{c.def.keys.length} キー）</option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="nb-eyebrow">名前</span>
            <input className="nb-input mt-1 !py-1.5 text-[0.85rem]" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </label>

          <div className="overflow-x-auto">
            <div className="min-w-[420px]">
              <KeyboardView interactive={false} compact previewKeymap={preview} previewLayer={0} />
            </div>
          </div>
          <p className="text-[0.68rem] font-bold leading-relaxed opacity-60">
            キーの印字が読み取れたものは、ベースレイヤーの割当として入れてあります。
            手元のキーボードからの打鍵の読み替えは、ベースレイヤーの割当をもとに自動で対応づきます。
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="nb-btn flex-1 !py-2 text-[0.82rem]"
              style={{ background: 'var(--color-lime)' }}
              onClick={() => onUse(finalDef)}
            >
              このキーボードで編集する
            </button>
            <button
              type="button"
              className="nb-btn !py-2 text-[0.78rem]"
              title="ORCA MAP のキーボード定義として保存します。組み込みのキーボードに加えるときの元データにもなります"
              onClick={() => downloadJson(finalDef, `${finalDef.name.replace(/\s+/g, '-')}.keyboard.json`)}
            >
              定義を JSON で保存
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
