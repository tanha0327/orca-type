import { useMemo, useRef, useState } from 'react'
import { FLAVOR_HELP, FLAVOR_LABEL, type Flavor, type Keymap } from '../../data/types'
import { toZmkKeymap } from '../../engine/zmk'
import { useKeymapStore } from '../../store/keymapStore'

export function ExportView() {
  const keymap = useKeymapStore((s) => s.keymap)
  const setSettings = useKeymapStore((s) => s.setSettings)
  const importKeymap = useKeymapStore((s) => s.importKeymap)
  const resetKeymap = useKeymapStore((s) => s.resetKeymap)
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)

  const json = useMemo(() => JSON.stringify(keymap, null, 2), [keymap])
  const zmk = useMemo(() => toZmkKeymap(keymap), [keymap])

  const flash = (text: string) => {
    setMessage(text)
    window.setTimeout(() => setMessage(null), 2600)
  }

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      flash(`${what}をコピーしました`)
    } catch {
      flash('クリップボードにアクセスできませんでした')
    }
  }

  const download = () => {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orca-map-${keymap.name.replace(/\s+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const loadFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Keymap
      if (!parsed?.layers || !Array.isArray(parsed.layers)) throw new Error('形式が違います')
      importKeymap(parsed)
      flash('キーマップを読み込みました')
    } catch (e) {
      flash(`読み込みに失敗しました: ${e instanceof Error ? e.message : ''}`)
    }
  }

  return (
    <div className="space-y-4">
      <section className="nb nb-lg p-4">
        <h2 className="text-[1.35rem]">全体の設定</h2>
        <p className="mt-1 text-[0.78rem] font-bold opacity-70">
          個別に上書きしていないキーは、ここの値が使われます。
        </p>

        <div className="mt-4">
          <label className="block">
            <span className="flex items-baseline justify-between text-[0.8rem] font-black">
              タッピングターム（既定値）
              <span className="font-mono">{keymap.settings.tappingTermMs} ms</span>
            </span>
            <input
              type="range" min={80} max={500} step={10} value={keymap.settings.tappingTermMs}
              className="mt-1 w-full accent-[var(--color-ink)]"
              onChange={(e) => setSettings({ tappingTermMs: Number(e.target.value) })}
            />
          </label>
        </div>

        <div className="mt-4">
          <p className="text-[0.8rem] font-black">フレーバー（既定値）</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(Object.keys(FLAVOR_LABEL) as Flavor[]).map((f) => (
              <button
                key={f}
                type="button"
                className="nb-btn !py-1.5 text-[0.76rem]"
                data-active={keymap.settings.flavor === f}
                onClick={() => setSettings({ flavor: f })}
              >
                {FLAVOR_LABEL[f]}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[0.7rem] font-bold opacity-60">{FLAVOR_HELP[keymap.settings.flavor]}</p>
        </div>
      </section>

      <section className="nb nb-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[1.35rem]">書き出しと読み込み</h2>
          {message && (
            <span className="nb-chip" style={{ background: 'var(--color-lime)' }}>{message}</span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="nb-btn !py-2 text-[0.82rem]" onClick={download}>
            ⬇ JSON を保存
          </button>
          <button type="button" className="nb-btn !py-2 text-[0.82rem]" onClick={() => void copy(json, 'JSON')}>
            JSON をコピー
          </button>
          <button type="button" className="nb-btn !py-2 text-[0.82rem]" onClick={() => fileRef.current?.click()}>
            ⬆ JSON を読み込む
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = '' }}
          />
          <span className="flex-1" />
          <button
            type="button"
            className="nb-btn !py-2 text-[0.82rem]"
            style={{ background: 'var(--color-pink)' }}
            onClick={() => { if (confirm('すべてのレイヤーとコンボを初期状態に戻します。よろしいですか？')) resetKeymap() }}
          >
            初期状態に戻す
          </button>
        </div>
      </section>

      <section className="nb nb-lg overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-[3px] border-[var(--color-ink)] p-4">
          <div className="min-w-0">
            <h2 className="text-[1.35rem]">ZMK キーマップ プレビュー</h2>
            <p className="mt-1 text-[0.76rem] font-bold opacity-70">
              Orca echo は ZMK ファームウェアです。いまの設定を devicetree 風に書き出したものです。
            </p>
          </div>
          <button type="button" className="nb-btn !py-2 text-[0.82rem]" onClick={() => void copy(zmk, 'キーマップ')}>
            コピー
          </button>
        </div>
        <pre
          className="max-h-[26rem] overflow-auto p-4 font-mono text-[0.68rem] leading-relaxed"
          style={{ background: 'var(--color-ink)', color: 'var(--color-paper)' }}
        >
          {zmk}
        </pre>
      </section>
    </div>
  )
}
