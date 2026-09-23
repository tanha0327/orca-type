import { KEYSWITCH_LINEART_LAYERS, KEYSWITCH_LINEART_VIEWBOX } from '../../data/keyswitchLineart'

const LAYER_STYLES = [
  { d: KEYSWITCH_LINEART_LAYERS.hidden, width: 0.15, opacity: 0.38, dash: '0.6 0.45' },
  { d: KEYSWITCH_LINEART_LAYERS.ghost, width: 0.16, opacity: 0.3 },
  { d: KEYSWITCH_LINEART_LAYERS.through, width: 0.2, opacity: 0.6 },
  { d: KEYSWITCH_LINEART_LAYERS.visible, width: 0.26, opacity: 1 },
  { d: KEYSWITCH_LINEART_LAYERS.outline, width: 0.46, opacity: 1 },
]

/**
 * キースイッチの3Dモデルを線画で2D化したイラスト（クリアハウジング風のX線表現）。
 * 奥の線ほど細く・薄く描き、currentColor で着色する。
 */
export function KeyswitchIllustration({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox={KEYSWITCH_LINEART_VIEWBOX} fill="none" aria-hidden="true">
      {LAYER_STYLES.map(({ d, width, opacity, dash }, i) => (
        <path
          key={i}
          d={d}
          stroke="currentColor"
          strokeWidth={width}
          strokeOpacity={opacity}
          strokeDasharray={dash}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}
