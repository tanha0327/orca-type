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
const STEM_COLOR = 'var(--color-purple)'

const labelStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontWeight: 900,
  letterSpacing: '0.14em',
}

function leaderPath(c: (typeof KEYSWITCH_CALLOUTS)[number]) {
  // 方眼に沿うよう、水平に引き出してから垂直に折って対象の点へ
  return `M${LABEL_X + 0.6} ${c.labelY}H${c.x}V${c.y}`
}

/**
 * キーキャップ付きキースイッチの線画（クリアハウジング風のX線表現＋部品の吹き出し）。
 * 奥の線ほど細く・薄く描き、ステム（紫）とキーキャップ（オレンジ）だけ差し色にする。
 * 入力前はときどき自動で打鍵し、キーを押し始めたらその押下に合わせて
 * キーキャップとステムが沈み、スプリングが縮む。
 */
export function KeyswitchIllustration({ className, style }: { className?: string; style?: CSSProperties }) {
  const ref = useRef<SVGSVGElement>(null)
  const id = useId()
  const aboveHousing = `${id}-above-housing`
  const belowKeycap = `${id}-below-keycap`
  const insideKeycap = `${id}-inside-keycap`

  useEffect(() => {
    const held = new Set<string>()
    const sync = () => {
      const el = ref.current
      if (!el) return
      el.dataset.pressed = String(held.size > 0)
      if (held.size > 0) el.dataset.idle = 'false'
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

  const stemLines = (width: number, opacity = 1) => (
    <>
      <path d={L.stemVisible} strokeWidth={width * 0.57} strokeOpacity={opacity} />
      <path d={L.stemOutline} strokeWidth={width} strokeOpacity={opacity} />
    </>
  )

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
      data-idle="true"
    >
      <defs>
        <clipPath id={aboveHousing}>
          <rect x={-GUTTER} y={0} width={G.width + GUTTER} height={G.housingTopY} />
        </clipPath>
        <clipPath id={belowKeycap}>
          <rect x={-GUTTER} y={G.keycapBottomY} width={G.width + GUTTER} height={G.height} />
        </clipPath>
        <clipPath id={insideKeycap}>
          <rect x={-GUTTER} y={0} width={G.width + GUTTER} height={G.keycapBottomY} />
        </clipPath>
      </defs>

      {/* ハウジング（固定） */}
      <path d={L.hidden} strokeWidth={0.15} strokeOpacity={0.38} strokeDasharray="0.6 0.45" />
      <g className="ks-spring" style={{ transformOrigin: `${G.axisX}px ${G.springBottomY}px` }}>
        <path d={L.springBack} strokeWidth={0.16} strokeOpacity={0.3} />
        <path d={L.springFront} strokeWidth={0.2} strokeOpacity={0.6} />
      </g>
      <path d={L.visible} strokeWidth={0.26} />
      <path d={L.outline} strokeWidth={0.46} />

      {/* ステム: ハウジング内は透けて細く、ハウジングとキーキャップの間だけ太く見せる */}
      <g style={{ color: STEM_COLOR }}>
        <g className="ks-stem">
          <path d={L.stemThrough} strokeWidth={0.2} strokeOpacity={0.8} />
        </g>
        <g clipPath={`url(#${aboveHousing})`}>
          <g className="ks-stem">
            <g clipPath={`url(#${belowKeycap})`}>{stemLines(0.46)}</g>
          </g>
        </g>
      </g>

      {/* キーキャップ（ステムと一緒に沈む） */}
      <g className="ks-stem">
        <path d={L.capOutline} fill="var(--color-orange)" stroke="none" />
        <path d={L.capHidden} strokeWidth={0.15} strokeOpacity={0.38} strokeDasharray="0.6 0.45" />
        <g clipPath={`url(#${insideKeycap})`} style={{ color: STEM_COLOR }}>{stemLines(0.2, 0.8)}</g>
        <path d={L.capDetail} strokeWidth={0.2} strokeOpacity={0.6} />
        <path d={L.capOutline} strokeWidth={0.46} />
      </g>

      <g style={labelStyle} fontSize={1.135}>
        {KEYSWITCH_CALLOUTS.map((c) => (
          <g key={c.index}>
            <path d={leaderPath(c)} strokeWidth={0.1} />
            <circle cx={c.x} cy={c.y} r={0.32} fill="currentColor" stroke="none" />
            <text x={LABEL_X} y={c.labelY} textAnchor="end" dominantBaseline="central" fill="currentColor" stroke="none">
              <tspan style={{ fill: STEM_COLOR }}>{c.index}</tspan>
              <tspan dx={0.6}>{c.label}</tspan>
            </text>
          </g>
        ))}
      </g>
    </svg>
  )
}
