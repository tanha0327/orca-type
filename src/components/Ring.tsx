/**
 * 円形の不確定進捗スピナー。読み込み中／処理中の待機状態に使う。
 * `currentColor` を使うので、親のテキスト色で色を変えられる。
 */
export function Ring({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ animation: 'orca-spin 700ms linear infinite' }}
    >
      <circle
        cx="12" cy="12" r="9.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="34 60"
        opacity={0.9}
      />
    </svg>
  )
}
