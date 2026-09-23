import { useEffect, useId, useRef, type CSSProperties } from 'react'
import {
  KEYSWITCH_CALLOUTS, KEYSWITCH_GEOMETRY as G, KEYSWITCH_LINEART_LAYERS as L,
} from '../../data/keyswitchLineart'

/** 左側に確保する吹き出しラベル用の余白（viewBox 単位） */
export const KEYSWITCH_CALLOUT_GUTTER = 12

const GUTTER = KEYSWITCH_CALLOUT_GUTTER
const TRAVEL = 3
const SPRING_SCALE = (G.springBottomY - G.springTopY - TRAVEL) / (G.springBottomY - G.springTopY)
const LABEL_X = -1.2

const labelStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontWeight: 900,
  letterSpacing: '0.14em',
}

/**
 * キースイッチの3Dモデルを線画で2D化したイラスト（クリアハウジング風のX線表現＋部品の吹き出し）。
 * 奥の線ほど細く・薄く描き、ステムだけブランドカラーにする。
 * キーを押している間はステムが沈み、スプリングが縮む。
 */
export function KeyswitchIllustration({ className, style }: { className?: string; style?: CSSProperties }) {
  const ref = useRef<SVGSVGElement>(null)
  const clipId = useId()

  useEffect(() => {
    const held = new Set<string>()
    const sync = () => {
      if (ref.current) ref.current.dataset.pressed = String(held.size > 0)
    }
    const down = (e: KeyboardEvent) => { held.add(e.code || e.key); sync() }
    const up = (e: KeyboardEvent) => { held.delete(e.code || e.key); sync() }
    const reset = () => { held.clear(); sync() }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', reset)
    }
  }, [])

  return (
    <svg
      ref={ref}
      className={className}
      style={{
        ...style,
        '--ks-travel': `${TRAVEL}px`,
        '--ks-spring-scale': SPRING_SCALE,
      } as CSSProperties}
      viewBox={`${-GUTTER} 0 ${G.width + GUTTER} ${G.height}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-pressed="false"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={-GUTTER} y={-G.height} width={G.width + GUTTER} height={G.height + G.housingTopY} />
        </clipPath>
      </defs>

      <path d={L.hidden} strokeWidth={0.15} strokeOpacity={0.38} strokeDasharray="0.6 0.45" />
      <g className="ks-spring" style={{ transformOrigin: `${G.axisX}px ${G.springBottomY}px` }}>
        <path d={L.springBack} strokeWidth={0.16} strokeOpacity={0.3} />
        <path d={L.springFront} strokeWidth={0.2} strokeOpacity={0.6} />
      </g>
      <path d={L.visible} strokeWidth={0.26} />
      <path d={L.outline} strokeWidth={0.46} />

      <g style={{ color: 'var(--color-purple)' }}>
        <g className="ks-stem">
          <path d={L.stemThrough} strokeWidth={0.2} strokeOpacity={0.8} />
        </g>
        <g clipPath={`url(#${clipId})`}>
          <g className="ks-stem">
            <path d={L.stemVisible} strokeWidth={0.26} />
            <path d={L.stemOutline} strokeWidth={0.46} />
          </g>
        </g>
      </g>

      <g style={labelStyle} fontSize={1.05}>
        {KEYSWITCH_CALLOUTS.map((c) => (
          <g key={c.index}>
            <path d={`M${LABEL_X + 0.6} ${c.y}H${c.x}`} strokeWidth={0.1} />
            <circle cx={c.x} cy={c.y} r={0.32} fill="currentColor" stroke="none" />
            <text x={LABEL_X} y={c.y} textAnchor="end" dominantBaseline="central" fill="currentColor" stroke="none">
              <tspan style={{ fill: 'var(--color-purple)' }}>{c.index}</tspan>
              <tspan dx={0.6}>{c.label}</tspan>
            </text>
          </g>
        ))}
        <text
          x={LABEL_X}
          y={KEYSWITCH_CALLOUTS[KEYSWITCH_CALLOUTS.length - 1].y + 2.6}
          textAnchor="end"
          dominantBaseline="central"
          fontSize={0.75}
          fill="currentColor"
          fillOpacity={0.5}
          stroke="none"
        >
          FIG.01 — SIDE VIEW
        </text>
      </g>
    </svg>
  )
}
