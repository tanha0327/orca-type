/**
 * アプリのロゴマーク。キースイッチを真上から見た図を単純化したもの:
 * 黒いハウジング、LED 窓（上のシルバーのスリット）、赤い軸の頭と一段明るい赤の MX の十字。
 * 十字だけだと「追加」ボタンに見えるので、LED 窓と軸の頭でスイッチだと分かるようにしている。
 * 配色は実物の黒ハウジング×赤軸スイッチに合わせてある。
 */
export function AppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="7" fill="#1b1b1d" />
      <rect x="6" y="7.5" width="20" height="20" rx="5" fill="#2e2e32" />
      <rect x="13" y="3.9" width="6" height="1.9" rx="0.95" fill="#d4d4d6" />
      <rect x="10" y="11.5" width="12" height="12" rx="3.2" fill="#b8231c" />
      <path d="M15 13.2H17V16.5H20.3V18.5H17V21.8H15V18.5H11.7V16.5H15Z" fill="#e8584c" />
    </svg>
  )
}
