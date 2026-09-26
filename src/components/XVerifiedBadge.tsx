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
  const content = (
    <>
      <span aria-hidden>✓</span>
      <span className="truncate">𝕏 @{verification.username}</span>
    </>
  )
  const style = { background: 'var(--color-cyan)', maxWidth: '100%' }

  if (!link) {
    return <span className={`nb-chip min-w-0 ${className}`} style={style} title={title}>{content}</span>
  }
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
