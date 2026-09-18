import {
  TRACKBALL_COLOR_GRADIENT, TRACKBALL_COLOR_LABEL, TRACKBALL_COLORS, type TrackballColor,
} from '../../data/types'
import { useKeymapStore } from '../../store/keymapStore'

export function TrackballPanel() {
  const ball = useKeymapStore((s) => s.keymap.trackball)
  const setTrackball = useKeymapStore((s) => s.setTrackball)

  return (
    <div className="nb nb-lg overflow-hidden">
      <header
        className="border-b-[3px] border-[var(--color-ink)] p-3"
        style={{ background: 'linear-gradient(100deg, #ff8a9b, #d21f3c)' }}
      >
        <p className="nb-eyebrow !opacity-80">右手・親指</p>
        <h3 className="text-[1.15rem]">19mm トラックボール</h3>
        <p className="text-[0.72rem] font-bold opacity-80">
          ポインタの設定はレイヤーをまたいで共通です
        </p>
      </header>

      <div className="space-y-4 p-3">
        <div>
          <span className="nb-eyebrow">ボール／パッドの色</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {TRACKBALL_COLORS.map((c) => (
              <ColorSwatch
                key={c}
                color={c}
                active={(ball.color ?? 'white') === c}
                onClick={() => setTrackball({ color: c })}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[0.68rem] font-bold leading-relaxed opacity-60">
            実機で交換できるトラックボールとスクロールパッドの色（セット）に合わせた
            見た目のみの設定です。動作は変わりません。
          </p>
        </div>

        <Slider
          label="DPI（ポインタ速度）" value={ball.dpi} min={200} max={3200} step={100}
          unit="dpi" onChange={(v) => setTrackball({ dpi: v })}
          help="大きいほど少ない回転で大きく動きます。"
        />
        <Slider
          label="取り付け角度の補正" value={ball.angle} min={-45} max={45} step={1}
          unit="°" onChange={(v) => setTrackball({ angle: v })}
          help="親指の自然な動きに対して、まっすぐ動くように回転させます。"
        />
        <Slider
          label="精密モードの倍率" value={Math.round(ball.snipeRatio * 100)} min={10} max={100} step={5}
          unit="%" onChange={(v) => setTrackball({ snipeRatio: v / 100 })}
          help="SNIPE キーを押している間の DPI 倍率。細かい選択に使います。"
        />
        <Slider
          label="スクロールの粒度" value={ball.scrollDivisor} min={4} max={64} step={2}
          unit="/notch" onChange={(v) => setTrackball({ scrollDivisor: v })}
          help="スクロールモード時、何カウントで 1 行スクロールするか。大きいほどゆっくり。"
        />

        <div className="flex gap-2">
          <Toggle label="X を反転" on={ball.invertX} onToggle={() => setTrackball({ invertX: !ball.invertX })} />
          <Toggle label="Y を反転" on={ball.invertY} onToggle={() => setTrackball({ invertY: !ball.invertY })} />
        </div>

        <div
          className="nb nb-flat p-3 text-[0.74rem] font-bold leading-relaxed"
          style={{ background: 'color-mix(in srgb, var(--color-sand) 50%, var(--color-paper))' }}
        >
          SNIPE（精密モード）と SCRL（スクロールモード）は<strong>キーコード</strong>です。
          任意のキーやスワイプに割り当てると、押している間だけ挙動が切り替わります。
          初期状態では MOUSE レイヤーの V / B に入っています。
        </div>
      </div>
    </div>
  )
}

function Slider({
  label, value, min, max, step, unit, help, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number
  unit: string; help: string; onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-[0.8rem] font-black">
        {label}
        <span className="font-mono">{value} {unit}</span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        className="mt-1 w-full accent-[var(--color-ink)]"
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="text-[0.68rem] font-bold opacity-60">{help}</span>
    </label>
  )
}

function Toggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="nb-btn flex-1 !py-2 text-[0.8rem]" data-active={on} onClick={onToggle}>
      {on ? '☑' : '☐'} {label}
    </button>
  )
}

function ColorSwatch({
  color, active, onClick,
}: {
  color: TrackballColor
  active: boolean
  onClick: () => void
}) {
  const [hi, mid, lo] = TRACKBALL_COLOR_GRADIENT[color]
  return (
    <button
      type="button"
      className="flex flex-col items-center gap-1"
      aria-pressed={active}
      onClick={onClick}
    >
      <span
        className="block h-8 w-8 rounded-full"
        style={{
          background: `radial-gradient(circle at 32% 28%, ${hi} 0%, ${mid} 42%, ${lo} 100%)`,
          border: `${active ? 3.5 : 2.5}px solid var(--color-ink)`,
          boxShadow: active ? '3px 3px 0 var(--color-ink)' : '2px 2px 0 var(--color-ink)',
          transform: active ? 'translate(-1px, -1px)' : undefined,
        }}
      />
      <span className="text-[0.62rem] font-black opacity-70">{TRACKBALL_COLOR_LABEL[color]}</span>
    </button>
  )
}
