import type { Category, Landmark, NormalizedLandmark } from '@mediapipe/tasks-vision'
import { type Vec2, dist, norm } from '../math'

export type Gesture = 'fist' | 'open' | 'other'
/** arm: 前腕の向き / hand: 手の向きで代用 / front: 腕がカメラを向いている */
export type AimMode = 'arm' | 'hand' | 'front'

export interface Viewport {
  W: number
  H: number
  vw: number
  vh: number
}

export interface PoseArm {
  side: 'L' | 'R'
  shoulder: Vec2
  elbow: Vec2
  wrist: Vec2
  vis: number
}

export interface HandObs {
  palm: Vec2
  wrist: Vec2
  /** 手首〜中指の付け根（画面 px） */
  size: number
  gesture: Gesture
  gestureName: string
  dir: Vec2
  mode: AimMode
  label: 'L' | 'R'
  pts: Vec2[]
  arm: PoseArm | null
}

export interface TrackFrame {
  t: number
  hands: HandObs[]
  arms: PoseArm[]
}

/** 正規化座標 → 画面 px（object-fit: cover ＋ 鏡像） */
export function mapPoint(lm: { x: number; y: number }, vp: Viewport): Vec2 {
  const s = Math.max(vp.W / vp.vw, vp.H / vp.vh)
  const ox = (vp.W - vp.vw * s) / 2
  const oy = (vp.H - vp.vh * s) / 2
  return { x: (1 - lm.x) * vp.vw * s + ox, y: lm.y * vp.vh * s + oy }
}

const FINGERS: [number, number][] = [
  [5, 8],
  [9, 12],
  [13, 16],
  [17, 20],
]

const d3 = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

/**
 * グー / パー の判定。
 * 学習済みのジェスチャー分類を優先し、自信がないときは
 * 3D の手のランドマーク（回転に強い）で指の曲がり具合から判定する。
 */
export function classify(world: Landmark[] | undefined, cats: Category[] | undefined): { g: Gesture; name: string } {
  const top = cats?.[0]
  if (top && top.score >= 0.55) {
    const n = top.categoryName
    if (n === 'Closed_Fist' || n === 'Thumb_Up' || n === 'Thumb_Down') return { g: 'fist', name: n }
    if (n === 'Open_Palm') return { g: 'open', name: n }
    if (n !== 'None') return { g: 'other', name: n }
  }
  if (!world || world.length < 21) return { g: 'other', name: 'None' }
  const w = world[0]
  let curled = 0
  let extended = 0
  for (const [mcp, tip] of FINGERS) {
    const r = d3(world[tip], w) / (d3(world[mcp], w) || 1)
    if (r < 1.3) curled++
    else if (r > 1.65) extended++
  }
  if (curled >= 3) return { g: 'fist', name: 'fist*' }
  if (extended >= 4) return { g: 'open', name: 'open*' }
  return { g: 'other', name: top?.categoryName ?? 'None' }
}

export function parseArms(pose: NormalizedLandmark[] | undefined, vp: Viewport): PoseArm[] {
  if (!pose || pose.length < 17) return []
  const arm = (side: 'L' | 'R', s: number, e: number, w: number): PoseArm => ({
    side,
    shoulder: mapPoint(pose[s], vp),
    elbow: mapPoint(pose[e], vp),
    wrist: mapPoint(pose[w], vp),
    vis: Math.min(pose[e].visibility ?? 1, pose[w].visibility ?? 1),
  })
  return [arm('L', 11, 13, 15), arm('R', 12, 14, 16)]
}

export function buildHand(
  lms: NormalizedLandmark[],
  world: Landmark[] | undefined,
  gestures: Category[] | undefined,
  handed: Category[] | undefined,
  vp: Viewport,
): HandObs {
  const pts = lms.map((l) => mapPoint(l, vp))
  const palmIdx = [0, 5, 9, 13, 17]
  const palm = {
    x: palmIdx.reduce((s, i) => s + pts[i].x, 0) / palmIdx.length,
    y: palmIdx.reduce((s, i) => s + pts[i].y, 0) / palmIdx.length,
  }
  const size = Math.max(dist(pts[0], pts[9]), dist(pts[5], pts[17]) * 1.25, 12)
  const { g, name } = classify(world, gestures)
  // MediaPipe は鏡像入力を前提に左右を付けるので、鏡像にしていない入力では逆になる
  const label = handed?.[0]?.categoryName === 'Left' ? 'R' : 'L'
  return {
    palm,
    wrist: pts[0],
    size,
    gesture: g,
    gestureName: name,
    dir: norm({ x: pts[9].x - pts[0].x, y: pts[9].y - pts[0].y }),
    mode: 'hand',
    label,
    pts,
    arm: null,
  }
}

/** 手と腕（ポーズ）を対応づけ、腕の向きを決める */
export function attachArms(hands: HandObs[], arms: PoseArm[]) {
  const used = new Set<PoseArm>()
  const pairs: { h: HandObs; a: PoseArm; d: number }[] = []
  for (const h of hands) for (const a of arms) pairs.push({ h, a, d: dist(h.wrist, a.wrist) })
  pairs.sort((p, q) => p.d - q.d)
  const done = new Set<HandObs>()
  for (const { h, a, d } of pairs) {
    if (done.has(h) || used.has(a)) continue
    if (d > h.size * 2.6 || a.vis < 0.5) continue
    done.add(h)
    used.add(a)
    h.arm = a
    const v = { x: h.wrist.x - a.elbow.x, y: h.wrist.y - a.elbow.y }
    // 前腕が極端に短く写る = カメラ方向に腕を突き出している
    if (Math.hypot(v.x, v.y) < h.size * 0.95) h.mode = 'front'
    else {
      h.mode = 'arm'
      h.dir = norm(v)
    }
  }
}
