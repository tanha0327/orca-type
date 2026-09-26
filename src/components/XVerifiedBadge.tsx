import { xProfileUrl, type XVerification } from '../lib/xVerification'

/**
 * X アカウントと連携して本人確認済みのユーザーに付けるバッジ。
 * クリックすると連携した X のプロフィールが開き、本当にその人の投稿かを確かめられる。
 * 画像として書き出すときなどリンクにできない場所では link={false} で表示だけにする。
 */
export function XVerifiedBadge({
  verification, link = true, className = '',
}: {
  verification: XVerification
  link?: boolean
  className?: string
}) {
  const title = `X アカウント @${verification.username} と連携して本人確認済み`
  const style = { background: 'var(--color-cyan)', maxWidth: '100%' }

  if (!link) {
    // 画像の書き出し（html2canvas）は truncate の中の文字をずらして切ってしまうので、省略せずに出す
    return (
      <span className={`nb-chip ${className}`} style={style} title={title}>
        <span aria-hidden>✓</span>
        𝕏 @{verification.username}
      </span>
    )
  }

  const content = (
    <>
      <span aria-hidden>✓</span>
      <span className="truncate">𝕏 @{verification.username}</span>
    </>
  )
  return (
    <a
      href={xProfileUrl(verification)}
      target="_blank"
      rel="noopener noreferrer"
      className={`nb-chip min-w-0 ${className}`}
      style={style}
      title={title}
      aria-label={`${title}（X のプロフィールを開く）`}
    >
      {content}
    </a>
  )
}
