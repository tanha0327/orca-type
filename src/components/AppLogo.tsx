/**
 * アプリのロゴマーク。ログイン画面のキースイッチ線画（KeyswitchIllustration）に登場する
 * ステム（紫）とキーキャップ（オレンジ）の配色をそのまま使い、
 * キーキャップの穴からステムの十字が覗く形に単純化してある。
 */
export function AppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="7"
        fill="var(--color-orange)"
        stroke="var(--color-ink)"
        strokeWidth="3"
      />
      <path
        d="M12 6H20V12H26V20H20V26H12V20H6V12H12Z"
        fill="var(--color-purple)"
        stroke="var(--color-ink)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}
