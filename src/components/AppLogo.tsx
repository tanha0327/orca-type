/**
 * アプリのロゴマーク。キースイッチを真上から見た図を単純化したもの:
 * 黒いハウジング、LED 窓（上の白いスリット）、軸の頭（ピンク）と MX の十字。
 * 十字だけだと「追加」ボタンに見えるので、LED 窓と軸の頭でスイッチだと分かるようにしている。
 */
export function AppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="7" fill="var(--color-ink)" />
      <rect x="6" y="7.5" width="20" height="20" rx="5" fill="#34343a" />
      <rect x="13" y="3.9" width="6" height="1.9" rx="0.95" fill="var(--color-paper)" />
      <rect x="10" y="11.5" width="12" height="12" rx="3.2" fill="var(--color-pink)" />
      <path
        d="M15 13.2H17V16.5H20.3V18.5H17V21.8H15V18.5H11.7V16.5H15Z"
        fill="var(--color-ink)"
      />
    </svg>
  )
}
