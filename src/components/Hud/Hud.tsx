import { useState } from 'react'
import { LAYER_COLOR_HEX } from '../../data/types'
import { OUTPUT_KIND_LABEL, type EngineSnapshot, type OutputEvent } from '../../engine/KeyEngine'
import { useEngineSnapshot } from '../../engine/useEngine'
import { useKeymapStore, type HudOptions } from '../../store/keymapStore'
import { KeyboardView } from '../Board/KeyboardView'

export interface HudProps {
  variant?: 'docked' | 'pip'
}

/**
 * 出力を常時表示するヘッドアップディスプレイ。
 * ページ内ドックと PiP ウィンドウで同じものを使い回す。
 */
export function Hud({ variant = 'docked' }: HudProps) {
  const snap = useEngineSnapshot()
  const keymap = useKeymapStore((s) => s.keymap)
  const opts = useKeymapStore((s) => s.hud)
  const capture = useKeymapStore((s) => s.captureEnabled)
  const setHud = useKeymapStore((s) => s.setHud)
  const [showOptions, setShowOptions] = useState(false)
  const pip = variant === 'pip'

  const layer = keymap.layers[snap.activeLayer]
  const hex = LAYER_COLOR_HEX[layer?.color ?? 'gray']

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto"
      style={{
        background: 'var(--color-ink)',
        color: 'var(--color-paper)',
        padding: pip ? '10px' : '12px',
      }}
    >
      <Header
        snap={snap}
        hex={hex}
        layerName={layer?.name ?? ''}
        capture={capture}
        pip={pip}
        optionsOpen={showOptions}
        onToggleOptions={() => setShowOptions((v) => !v)}
      />

      {showOptions && (
        <section
          className="rounded-[10px] p-2"
          style={{ background: 'color-mix(in srgb, var(--color-paper) 12%, transparent)' }}
        >
          <p className="nb-eyebrow mb-1.5 !text-[0.56rem] !opacity-60">HUD に出す項目</p>
          <div className="flex flex-wrap gap-1">
            {HUD_TOGGLES.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setHud({ [key]: !opts[key] })}
                className="rounded-full px-2 py-0.5 text-[0.62rem] font-black"
                aria-pressed={opts[key]}
                style={{
                  background: opts[key] ? 'var(--color-lime)' : 'transparent',
                  color: opts[key] ? 'var(--color-ink)' : 'inherit',
                  border: '2px solid currentColor',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      {opts.showCombination && <Combination last={snap.last} mods={snap.mods} hex={hex} pip={pip} />}

      {opts.showJudgement && <Judgement snap={snap} hex={hex} />}

      {opts.showCombo && snap.combo && (
        <Row
          key={snap.combo.at}
          tone="var(--color-purple)"
          tag="コンボ"
          left={snap.combo.keys.length ? snap.combo.name : ''}
          main={`${snap.combo.glyph}`}
          animate
        />
      )}

      {opts.showSensor && snap.last && (snap.last.kind === 'pad' || snap.last.kind === 'encoder') && (
        <Row
          key={snap.last.id}
          tone="var(--color-lime)"
          tag={snap.last.kind === 'pad' ? 'スワイプ' : 'エンコーダー'}
          left={snap.last.source}
          main={snap.last.glyph}
          animate
        />
      )}

      {opts.showMiniMap && (
        <section
          className="rounded-[10px] p-2"
          style={{ background: 'color-mix(in srgb, var(--color-paper) 12%, transparent)' }}
        >
          <p className="nb-eyebrow mb-1 !text-[0.58rem] !opacity-60">
            L{snap.activeLayer} {layer?.name} のキーマップ
          </p>
          <KeyboardView interactive={false} compact />
        </section>
      )}

      {opts.showLog && <Log log={snap.log} pip={pip} />}

      {!capture && (
        <p
          className="rounded-[10px] px-2 py-1.5 text-center text-[0.68rem] font-black leading-snug"
          style={{ background: 'var(--color-pink)', color: 'var(--color-ink)' }}
        >
          入力キャプチャが OFF です。ONにすると、打った内容がここに出ます。
        </p>
      )}
    </div>
  )
}

const HUD_TOGGLES: [keyof HudOptions, string][] = [
  ['showCombination', '出力'],
  ['showJudgement', '長押し判定'],
  ['showCombo', 'コンボ'],
  ['showSensor', 'スワイプ'],
  ['showMiniMap', 'キーマップ'],
  ['showLog', 'ログ'],
]

function Header({
  snap, hex, layerName, capture, pip, optionsOpen, onToggleOptions,
}: {
  snap: EngineSnapshot; hex: string; layerName: string; capture: boolean; pip: boolean
  optionsOpen: boolean; onToggleOptions: () => void
}) {
  return (
    <header className="flex items-center gap-2">
      <span
        className="flex shrink-0 items-center gap-1.5 rounded-[9px] px-2 py-1 font-mono text-[0.78rem] font-black"
        style={{ background: hex, color: 'var(--color-ink)' }}
      >
        L{snap.activeLayer}
        <span className="text-[0.72rem]">{layerName}</span>
      </span>
      {snap.stack.length > 1 && (
        <span className="font-mono text-[0.6rem] font-black opacity-50">
          ← {snap.stack.join(' ▸ ')}
        </span>
      )}
      <span className="flex-1" />
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{
          background: capture ? 'var(--color-lime)' : 'transparent',
          border: '2px solid currentColor',
          opacity: capture ? 1 : 0.4,
        }}
        title={capture ? 'キャプチャ中' : 'キャプチャ停止中'}
      />
      {!pip && <span className="nb-eyebrow !text-[0.58rem] !opacity-50">ORCA MAP HUD</span>}
      <button
        type="button"
        onClick={onToggleOptions}
        aria-label="HUD の表示項目"
        aria-expanded={optionsOpen}
        className="shrink-0 rounded-[7px] px-1.5 py-0.5 text-[0.7rem] font-black"
        style={{
          border: '2px solid currentColor',
          background: optionsOpen ? 'var(--color-paper)' : 'transparent',
          color: optionsOpen ? 'var(--color-ink)' : 'inherit',
          cursor: 'pointer',
        }}
      >
        ⚙
      </button>
    </header>
  )
}

function Combination({
  last, mods, hex, pip,
}: { last?: OutputEvent; mods: string[]; hex: string; pip: boolean }) {
  return (
    <section
      className="rounded-[12px] px-3 py-3"
      style={{ background: 'color-mix(in srgb, var(--color-paper) 10%, transparent)' }}
    >
      <div className="flex items-center gap-1.5">
        <span className="nb-eyebrow !text-[0.58rem] !opacity-60">いまの出力</span>
        {last && (
          <span
            className="rounded-full px-1.5 py-px text-[0.56rem] font-black"
            style={{ background: hex, color: 'var(--color-ink)' }}
          >
            {OUTPUT_KIND_LABEL[last.kind]}
          </span>
        )}
        {mods.length > 0 && (
          <span className="font-mono text-[0.7rem] font-black opacity-70">{mods.join(' ')} 保持中</span>
        )}
      </div>

      {last ? (
        <div key={last.id} style={{ animation: 'orca-pop 160ms ease-out' }}>
          <p
            className="mt-1 font-mono font-black leading-none"
            style={{ fontSize: pip ? '1.7rem' : '2.1rem', letterSpacing: '-0.02em' }}
          >
            {last.combination || '—'}
          </p>
          <p className="mt-1.5 flex items-baseline gap-1.5 text-[0.72rem] font-bold leading-tight opacity-70">
            <span className="font-mono opacity-60">{last.source}</span>
            <span className="opacity-40">→</span>
            <span className="min-w-0 truncate">{last.name}</span>
          </p>
        </div>
      ) : (
        <p className="mt-1 text-[0.8rem] font-bold opacity-45">まだ何も押されていません</p>
      )}
    </section>
  )
}

/** 単押しか長押しかの判定と、タッピングタームの進行 */
function Judgement({ snap, hex }: { snap: EngineSnapshot; hex: string }) {
  const watch = snap.presses.filter((p) => p.holdGlyph)
  if (watch.length === 0) {
    return (
      <section className="rounded-[10px] px-2.5 py-1.5">
        <p className="text-[0.68rem] font-bold opacity-35">
          長押し（MOD-TAP）付きのキーを押すと、判定がここに出ます
        </p>
      </section>
    )
  }
  return (
    <section className="space-y-1.5">
      {watch.map((p) => {
        const decided = p.state === 'hold' ? 'hold' : p.state === 'tap' ? 'tap' : null
        return (
          <div
            key={p.keyId}
            className="rounded-[10px] px-2.5 py-2"
            style={{ background: 'color-mix(in srgb, var(--color-paper) 10%, transparent)' }}
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[1rem] font-black">{p.tapGlyph || p.keyId}</span>
              <span className="opacity-40">/</span>
              <span className="font-mono text-[0.9rem] font-black" style={{ color: 'var(--color-pink)' }}>
                {p.holdGlyph}
              </span>
              <span className="flex-1" />
              <span
                className="rounded-full px-1.5 py-px text-[0.58rem] font-black"
                style={{
                  background: decided === 'hold' ? 'var(--color-pink)'
                    : decided === 'tap' ? hex : 'transparent',
                  color: decided ? 'var(--color-ink)' : 'inherit',
                  border: decided ? 'none' : '1.5px solid currentColor',
                  opacity: decided ? 1 : 0.55,
                }}
              >
                {decided === 'hold' ? '長押し確定' : decided === 'tap' ? '単押し確定' : '判定中…'}
              </span>
            </div>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full"
              style={{ background: 'color-mix(in srgb, var(--color-paper) 22%, transparent)' }}
            >
              <div
                key={p.downAt}
                className="h-full"
                style={{
                  background: decided === 'hold' ? 'var(--color-pink)' : 'var(--color-paper)',
                  width: decided ? '100%' : undefined,
                  animation: decided ? undefined : `orca-term ${p.termMs}ms linear forwards`,
                }}
              />
            </div>
            <p className="mt-1 font-mono text-[0.56rem] font-black opacity-45">
              タッピングターム {p.termMs}ms
            </p>
          </div>
        )
      })}
    </section>
  )
}

function Row({
  tone, tag, left, main, animate,
}: { tone: string; tag: string; left: string; main: string; animate?: boolean }) {
  return (
    <div
      className="flex items-center gap-2 rounded-[10px] px-2.5 py-1.5"
      style={{
        background: 'color-mix(in srgb, var(--color-paper) 10%, transparent)',
        animation: animate ? 'orca-flash 260ms ease-out' : undefined,
      }}
    >
      <span
        className="shrink-0 rounded-full px-1.5 py-px text-[0.56rem] font-black"
        style={{ background: tone, color: 'var(--color-ink)' }}
      >
        {tag}
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.7rem] font-bold opacity-70">{left}</span>
      <span className="shrink-0 font-mono text-[0.95rem] font-black">{main}</span>
    </div>
  )
}

function Log({ log, pip }: { log: OutputEvent[]; pip: boolean }) {
  const shown = log.slice(0, pip ? 6 : 10)
  return (
    <section className="min-h-0">
      <p className="nb-eyebrow mb-1 !text-[0.58rem] !opacity-55">直近の出力</p>
      {shown.length === 0 ? (
        <p className="text-[0.68rem] font-bold opacity-35">—</p>
      ) : (
        <ol className="space-y-px">
          {shown.map((e) => (
            <li key={e.id} className="flex items-baseline gap-2 font-mono text-[0.66rem] font-black">
              <span className="w-[3.2rem] shrink-0 opacity-40">L{e.layerId}</span>
              <span className="w-[4.5rem] shrink-0 truncate opacity-55">{e.source}</span>
              <span className="opacity-30">→</span>
              <span className="min-w-0 flex-1 truncate">{e.combination}</span>
              <span className="shrink-0 text-[0.56rem] opacity-35">{OUTPUT_KIND_LABEL[e.kind]}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
