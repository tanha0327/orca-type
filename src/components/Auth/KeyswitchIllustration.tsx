import {
  KEYSWITCH_LINEART_HIDDEN_POLYLINES, KEYSWITCH_LINEART_POLYLINES,
  KEYSWITCH_LINEART_STROKE_WIDTH, KEYSWITCH_LINEART_VIEWBOX,
} from '../../data/keyswitchLineart'

/**
 * キースイッチの3Dモデルを線画だけで2D化したイラスト。currentColor で着色する。
 * 奥に隠れる線は薄い透過で重ね、透け感のあるX線風の見た目にする。
 */
export function KeyswitchIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox={KEYSWITCH_LINEART_VIEWBOX}
      fill="none"
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeWidth={KEYSWITCH_LINEART_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.28}
      >
        {KEYSWITCH_LINEART_HIDDEN_POLYLINES.map((points, i) => (
          <polyline key={i} points={points} />
        ))}
      </g>
      <g stroke="currentColor" strokeWidth={KEYSWITCH_LINEART_STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round">
        {KEYSWITCH_LINEART_POLYLINES.map((points, i) => (
          <polyline key={i} points={points} />
        ))}
      </g>
    </svg>
  )
}
