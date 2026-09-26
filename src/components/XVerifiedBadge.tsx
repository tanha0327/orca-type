import { xVerificationPostUrl, type XVerification } from '../lib/xVerification'

/**
 * X のポストで本人確認済みのユーザーに付けるバッジ。
 * クリックすると確認に使ったポスト（確認コード入り）が開き、本当にその人のアカウントかを確かめられる。
 * 画像として書き出すときなどリンクにできない場所では link={false} で表示だけにする。
 */
export function XVerifiedBadge({
  verification, link = true, className = '',
}: {
  verification: XVerification
  link?: boolean
  className?: string
}) {
  const title = `X の @${verification.username} で本人確認済み`
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
      href={xVerificationPostUrl(verification)}
      target="_blank"
      rel="noopener noreferrer"
      className={`nb-chip min-w-0 ${className}`}
      style={style}
      title={title}
      aria-label={`${title}（確認に使った X のポストを開く）`}
    >
      {content}
    </a>
  )
}
