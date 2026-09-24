/**
 * アプリのロゴマーク。実機のキースイッチのシルエット
 * （キーキャップ／本体／基板ピン）を単純化し、
 * ログイン画面のキースイッチ線画と同じ配色（オレンジ=キーキャップ）で描いてある。
 */
export function AppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="9" y="22" width="3.4" height="7" rx="1" fill="var(--color-ink)" />
      <rect x="19.6" y="22" width="3.4" height="7" rx="1" fill="var(--color-ink)" />
      <rect
        x="5"
        y="11"
        width="22"
        height="14"
        rx="3"
        fill="var(--color-purple)"
        stroke="var(--color-ink)"
        strokeWidth="2.6"
      />
      <rect
        x="7"
        y="2"
        width="18"
        height="10"
        rx="3"
        fill="var(--color-orange)"
        stroke="var(--color-ink)"
        strokeWidth="2.6"
      />
      <path d="M10.5 6.4H21.5" stroke="var(--color-ink)" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
    </svg>
  )
}
