import type { ReactNode } from 'react'

/**
 * ボタン用の線画アイコン。絵文字や記号の文字はフォントや OS で大きさ・形がばらつくので、
 * 同じ 24×24 の枠・同じ線の太さの SVG にそろえる。色は親の文字色（currentColor）に従う。
 */
function Svg({ size = 20, children, fill = 'none' }: { size?: number; children: ReactNode; fill?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  )
}

export function IconComment({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M20.5 11.5a8.5 8.5 0 0 1-12.4 7.55L3.5 20.5l1.45-4.6A8.5 8.5 0 1 1 20.5 11.5Z" />
    </Svg>
  )
}

export function IconHeart({ size, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <Svg size={size} fill={filled ? 'currentColor' : 'none'}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </Svg>
  )
}

/** 画像として保存（額縁の右下に下向き矢印） */
export function IconImageSave({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M11 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7" />
      <circle cx="9" cy="9" r="2" />
      <path d="m3 17 5-5 4 4" />
      <path d="M18 14.5V21" />
      <path d="m15 18 3 3 3-3" />
    </Svg>
  )
}

/** X（旧 Twitter）のロゴ。塗りの図形なので線は引かない */
export function IconX({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
      <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93Zm-1.29 19.49h2.04L6.49 3.24H4.3Z" />
    </svg>
  )
}

export function IconTrash({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Svg>
  )
}

/** 編集画面に読み込む（トレイに入る矢印） */
export function IconLoad({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </Svg>
  )
}

export function IconExpand({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="m21 3-7 7" />
      <path d="m3 21 7-7" />
    </Svg>
  )
}

/** 今熱い */
export function IconFlame({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z" />
    </Svg>
  )
}

/** 新しい順（きらり） */
export function IconSparkle({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M12 3.5 13.9 9a1.5 1.5 0 0 0 1.1 1.1l5.5 1.9-5.5 1.9a1.5 1.5 0 0 0-1.1 1.1L12 20.5 10.1 15a1.5 1.5 0 0 0-1.1-1.1L3.5 12 9 10.1A1.5 1.5 0 0 0 10.1 9Z" />
    </Svg>
  )
}

/** 古い順（時計の針を巻き戻す） */
export function IconHistory({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </Svg>
  )
}

/** フォルダに保存。保存済みは塗りつぶし、まだなら中に＋ */
export function IconFolder({ size, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <Svg size={size} fill={filled ? 'currentColor' : 'none'}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      {!filled && <path d="M12 10.5v5" />}
      {!filled && <path d="M9.5 13h5" />}
    </Svg>
  )
}

/** 近い順（重なり合う 2 つの円） */
export function IconNear({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <circle cx="9" cy="12" r="6" />
      <circle cx="15" cy="12" r="6" />
    </Svg>
  )
}

/** 手動の並び順（上下の矢印） */
export function IconReorder({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="m7 9 5-5 5 5" />
      <path d="m7 15 5 5 5-5" />
    </Svg>
  )
}

export function IconChevronUp({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="m6 15 6-6 6 6" />
    </Svg>
  )
}

export function IconChevronDown({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  )
}
