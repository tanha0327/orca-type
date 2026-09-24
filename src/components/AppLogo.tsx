/**
 * アプリのロゴマーク。実機のキースイッチ 3D モデルを真上から見たシルエット
 * （本体の四角＋両サイドの位置決めタブ／中央に見える軸のキャップ）を
 * trimesh + shapely で正確に抽出し単純化したもの。配色は本体=紫、軸=オレンジ。
 */
export function AppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M 2.50 4.67 L 2.50 2.50 L 29.50 2.50 L 29.50 4.67 L 29.06 4.67 L 29.06 27.33 L 29.50 27.33 L 29.50 29.50 L 2.50 29.50 L 2.50 27.33 L 2.94 27.33 L 2.94 4.67 L 2.50 4.67 Z"
        fill="var(--color-purple)"
        stroke="var(--color-ink)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M 9.03 17.74 L 9.03 14.26 L 9.90 14.26 L 9.90 11.65 L 22.10 11.65 L 22.10 14.26 L 22.97 14.26 L 22.97 17.74 L 22.10 17.74 L 22.10 20.35 L 9.90 20.35 L 9.90 17.74 L 9.03 17.74 Z"
        fill="var(--color-orange)"
        stroke="var(--color-ink)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}
