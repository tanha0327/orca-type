import type { KeyboardDefinition, KeyDef } from './types'

export interface Bounds {
  minX: number
  minY: number
  w: number
  h: number
}

interface Rect { x: number; y: number; w: number; h: number }

/** 回転を反映したキーの 4 隅 */
export function keyCorners(k: KeyDef): [number, number][] {
  const corners: [number, number][] = [
    [k.x, k.y], [k.x + k.w, k.y], [k.x + k.w, k.y + k.h], [k.x, k.y + k.h],
  ]
  const r = k.r ?? 0
  if (!r) return corners
  const rad = (r * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const ox = k.rx ?? 0
  const oy = k.ry ?? 0
  return corners.map(([x, y]) => {
    const dx = x - ox
    const dy = y - oy
    return [ox + dx * cos - dy * sin, oy + dx * sin + dy * cos]
  })
}

/** 回転後のキーの中心 */
export function keyCenter(k: KeyDef): [number, number] {
  const cs = keyCorners(k)
  return [(cs[0][0] + cs[2][0]) / 2, (cs[0][1] + cs[2][1]) / 2]
}

const boundsCache = new WeakMap<KeyboardDefinition, Bounds>()

/** 盤面の外形（ユニット）。エンコーダーやトラックボールの脚注ラベルぶん、下に余白を足す */
export function boardBounds(def: KeyboardDefinition): Bounds {
  const cached = boundsCache.get(def)
  if (cached) return cached

  const xs: number[] = []
  const ys: number[] = []
  for (const k of def.keys) {
    for (const [x, y] of keyCorners(k)) { xs.push(x); ys.push(y) }
  }
  for (const s of def.sensors ?? []) {
    xs.push(s.x, s.x + s.w)
    ys.push(s.y, s.y + s.h)
  }
  if (xs.length === 0) return { minX: 0, minY: 0, w: 1, h: 1 }

  const footnote = (def.sensors ?? []).some((s) => s.kind !== 'pad') ? 0.34 : 0
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const bounds = {
    minX,
    minY,
    w: Math.max(...xs) - minX,
    h: Math.max(...ys) - minY + footnote,
  }
  boundsCache.set(def, bounds)
  return bounds
}

/** 盤面の中での位置を % で返す（回転前の矩形） */
export function placeRect(rect: Rect, b: Bounds) {
  return {
    left: `${((rect.x - b.minX) / b.w) * 100}%`,
    top: `${((rect.y - b.minY) / b.h) * 100}%`,
    width: `${(rect.w / b.w) * 100}%`,
    height: `${(rect.h / b.h) * 100}%`,
  }
}

/** 回転しているキーの CSS。回転の中心 (rx, ry) を、キー自身の左上からの % に直す */
export function keyRotation(k: KeyDef): { transform?: string; transformOrigin?: string } {
  const r = k.r ?? 0
  if (!r) return {}
  const ox = (((k.rx ?? 0) - k.x) / k.w) * 100
  const oy = (((k.ry ?? 0) - k.y) / k.h) * 100
  return { transform: `rotate(${r}deg)`, transformOrigin: `${ox}% ${oy}%` }
}

/**
 * 盤面の中で使う長さ。1u（キー 1 個分）を基準にした CSS の長さを返す。
 * 盤面のコンテナに `--u`（1u の幅）を置いておき、キーの大きさに比例して文字や線を拡縮する。
 */
export function u(n: number): string {
  return `calc(var(--u) * ${n})`
}
