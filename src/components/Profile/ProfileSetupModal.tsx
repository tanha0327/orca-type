import type { User } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import { SAMPLE_AVATARS, SAMPLE_NAMES } from '../../data/profileSamples'
import { uploadAvatar } from '../../lib/profile'
import {
  fetchMyXVerificationCode, isXVerificationUnavailable, removeXVerification, verifyXPost,
  xVerificationEnabled, xVerificationIntentUrl,
} from '../../lib/xVerification'
import { useAuthStore } from '../../store/authStore'
import { useProfileStore } from '../../store/profileStore'
import { Ring } from '../Ring'
import { XVerifiedBadge } from '../XVerifiedBadge'

/**
 * Supabase のエラー（PostgrestError / StorageError）は Error を継承していないので、
 * instanceof Error だけで見るとメッセージが拾えない。
 */
function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string' && e.message) {
    return e.message
  }
  return '不明なエラー'
}

export function ProfileSetupModal() {
  const user = useAuthStore((s) => s.user)
  const editorOpen = useProfileStore((s) => s.editorOpen)
  const isFirstSignIn = useProfileStore((s) => s.isFirstSignIn)
  const profile = useProfileStore((s) => s.profile)
  const closeEditor = useProfileStore((s) => s.closeEditor)
  const save = useProfileStore((s) => s.save)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 開くたびに、今のプロフィール（無ければ Google の情報）で初期化する
  useEffect(() => {
    if (!editorOpen) return
    setName(profile?.name ?? '')
    const current = profile?.avatarUrl ?? SAMPLE_AVATARS[0].url
    setAvatarUrl(current)
    setUploadedUrl(SAMPLE_AVATARS.some((a) => a.url === current) ? null : current)
    setError(null)
  }, [editorOpen, profile])

  useEffect(() => {
    if (!editorOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeEditor() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editorOpen, closeEditor])

  if (!editorOpen || !user) return null

  const doUpload = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const url = await uploadAvatar(user.id, file)
      setUploadedUrl(url)
      setAvatarUrl(url)
    } catch (e) {
      setError(`アップロードに失敗しました: ${errorMessage(e)}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const doSave = async () => {
    const trimmed = name.trim()
    if (!trimmed || !avatarUrl) return
    setSaving(true)
    setError(null)
    try {
      await save(user.id, { name: trimmed, avatarUrl })
    } catch (e) {
      setError(`保存に失敗しました: ${errorMessage(e)}`)
    } finally {
      setSaving(false)
    }
  }

  const canSave = !!name.trim() && !!avatarUrl && !saving

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
      style={{ background: 'color-mix(in srgb, var(--color-ink) 45%, transparent)' }}
      onPointerDown={(e) => { if (e.target === e.currentTarget && !isFirstSignIn) closeEditor() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="プロフィールを設定"
        className="nb nb-lg flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden"
      >
        <header
          className="flex items-center gap-2 border-b-[3px] border-[var(--color-ink)] p-3"
          style={{ background: 'var(--color-purple)' }}
        >
          <div className="min-w-0 flex-1">
            <p className="nb-eyebrow !opacity-80">{isFirstSignIn ? 'はじめまして' : 'プロフィール'}</p>
            <h3 className="truncate text-[1.05rem]">
              {isFirstSignIn ? 'プロフィールを設定しましょう' : 'プロフィールを編集'}
            </h3>
          </div>
          {!isFirstSignIn && (
            <button type="button" className="nb-btn shrink-0 !py-1.5 text-[0.78rem]" onClick={closeEditor}>
              閉じる
            </button>
          )}
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
          <div className="flex items-center gap-3">
            <img
              src={avatarUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-full object-cover"
              style={{ border: '3px solid var(--color-ink)' }}
            />
            <div className="min-w-0">
              <p className="truncate text-[0.95rem] font-black">{name.trim() || '名前を選んでください'}</p>
              <p className="text-[0.72rem] font-bold opacity-60">みんなの配列やコメントにこの名前とアイコンで表示されます</p>
            </div>
          </div>

          <XVerifySection user={user} />

          <div>
            <span className="nb-eyebrow">アイコン（サンプル）</span>
            <div className="mt-1.5 grid grid-cols-5 gap-2">
              {SAMPLE_AVATARS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  title={a.label}
                  aria-label={a.label}
                  aria-pressed={avatarUrl === a.url}
                  onClick={() => setAvatarUrl(a.url)}
                  className="rounded-full p-0.5"
                  style={{
                    border: `3px solid var(--color-ink)`,
                    boxShadow: avatarUrl === a.url ? '3px 3px 0 var(--color-ink)' : 'none',
                    background: avatarUrl === a.url ? 'var(--color-lime)' : 'transparent',
                    transform: avatarUrl === a.url ? 'translate(-1px, -1px)' : undefined,
                  }}
                >
                  <img src={a.url} alt="" className="h-full w-full rounded-full" />
                </button>
              ))}
              {uploadedUrl && (
                <button
                  type="button"
                  title="アップロードした画像"
                  aria-label="アップロードした画像"
                  aria-pressed={avatarUrl === uploadedUrl}
                  onClick={() => setAvatarUrl(uploadedUrl)}
                  className="rounded-full p-0.5"
                  style={{
                    border: `3px solid var(--color-ink)`,
                    boxShadow: avatarUrl === uploadedUrl ? '3px 3px 0 var(--color-ink)' : 'none',
                    background: avatarUrl === uploadedUrl ? 'var(--color-lime)' : 'transparent',
                    transform: avatarUrl === uploadedUrl ? 'translate(-1px, -1px)' : undefined,
                  }}
                >
                  <img src={uploadedUrl} alt="" className="h-full w-full rounded-full object-cover" />
                </button>
              )}
            </div>
            <button
              type="button"
              className="nb-btn mt-2 flex w-full items-center justify-center gap-2 !py-1.5 text-[0.78rem]"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading && <Ring size={13} />}
              {uploading ? 'アップロード中…' : '📷 自分の画像をアップロード'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void doUpload(f) }}
            />
          </div>

          <label className="block">
            <span className="nb-eyebrow">名前</span>
            <input
              className="nb-input mt-1"
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: はやおしオルカ"
            />
          </label>

          <div>
            <span className="nb-eyebrow">名前の候補（採用してもOK）</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SAMPLE_NAMES.map((n) => (
                <button
                  key={n}
                  type="button"
                  className="nb-chip"
                  style={{ background: name === n ? 'var(--color-lime)' : 'var(--color-paper)' }}
                  onClick={() => setName(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-[0.78rem] font-bold" style={{ color: 'var(--color-pink)' }}>{error}</p>
          )}
        </div>

        <div className="flex items-center gap-2 border-t-[3px] border-[var(--color-ink)] p-3">
          {isFirstSignIn
            ? (
              <button type="button" className="nb-btn shrink-0 !py-2 text-[0.8rem]" onClick={closeEditor} disabled={saving}>
                あとで
              </button>
            )
            : (
              <button type="button" className="nb-btn shrink-0 !py-2 text-[0.8rem]" onClick={closeEditor} disabled={saving}>
                キャンセル
              </button>
            )}
          <button
            type="button"
            className="nb-btn flex flex-1 items-center justify-center gap-2 !py-2 text-[0.82rem]"
            style={{ background: 'var(--color-lime)' }}
            disabled={!canSave}
            onClick={() => void doSave()}
          >
            {saving && <Ring size={14} />}
            {saving ? '保存中…' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * X（旧 Twitter）のポストで本人確認する欄。確認コード入りのポストをしてその URL を貼ると、
 * 投稿・コメントに「✓ 𝕏 @ユーザー名」のバッジが付く。X の API（有料）は使わない。
 */
function XVerifySection({ user }: { user: User }) {
  const verification = useProfileStore((s) => s.verification)
  const setVerification = useProfileStore((s) => s.setVerification)

  const [code, setCode] = useState<string | null>(null)
  // 本人確認の SQL がまだ実行されていない環境では、この欄ごと出さない
  const [unavailable, setUnavailable] = useState(false)
  const [postUrl, setPostUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    if (!xVerificationEnabled() || verification || code) return
    let cancelled = false
    fetchMyXVerificationCode()
      .then((c) => { if (!cancelled) setCode(c) })
      .catch((e) => {
        if (cancelled) return
        if (isXVerificationUnavailable(e)) setUnavailable(true)
        else setError(`確認コードを取得できませんでした: ${errorMessage(e)}`)
      })
    return () => { cancelled = true }
  }, [verification, code])

  if (!xVerificationEnabled() || unavailable) return null

  const doVerify = async () => {
    if (!postUrl.trim()) return
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const v = await verifyXPost(user.id, postUrl.trim())
      setVerification(v)
      setPostUrl('')
      setDone(`@${v.username} で本人確認できました！ 投稿やコメントにバッジが付きます。確認に使ったポストは消しても大丈夫です。`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const doRemove = async () => {
    if (!confirm('X の本人確認を取り消しますか？ 投稿やコメントのバッジも外れます。')) return
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      await removeXVerification(user.id)
      setVerification(null)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <span className="nb-eyebrow">本人確認（X のポスト）</span>
      {verification
        ? (
          <div className="nb nb-flat mt-1.5 flex flex-wrap items-center gap-2 p-2.5">
            <XVerifiedBadge verification={verification} />
            <span className="min-w-0 flex-1 text-[0.72rem] font-bold opacity-60">本人確認済み</span>
            <button
              type="button"
              className="nb-btn flex shrink-0 items-center gap-1.5 !py-1 !px-2 text-[0.72rem]"
              onClick={() => void doRemove()}
              disabled={busy}
            >
              {busy && <Ring size={12} />}
              取り消す
            </button>
          </div>
        )
        : (
          <div className="nb nb-flat mt-1.5 space-y-2.5 p-2.5">
            <p className="text-[0.74rem] font-bold leading-relaxed opacity-70">
              確認コード入りのポストを X にすると、投稿やコメントに「✓ 𝕏 @ユーザー名」のバッジが付きます。
              バッジから X のプロフィールを開けるので、本人だと確かめてもらえます。
            </p>

            <div>
              <p className="text-[0.74rem] font-black">① 確認コード入りのポストをする</p>
              <div className="mt-1 flex items-center gap-2">
                <code
                  className="nb-chip min-w-0 flex-1 justify-center !py-1 font-mono text-[0.78rem]"
                  style={{ background: 'var(--color-paper)' }}
                >
                  {code ?? '…'}
                </code>
                <a
                  href={code ? xVerificationIntentUrl(code) : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nb-btn shrink-0 !py-1.5 text-[0.76rem]"
                  style={{ background: 'var(--color-cyan)' }}
                  aria-disabled={!code}
                  onClick={(e) => { if (!code) e.preventDefault() }}
                >
                  𝕏 でポストする
                </a>
              </div>
            </div>

            <div>
              <p className="text-[0.74rem] font-black">② 投稿したポストの URL を貼って確認する</p>
              <div className="mt-1 flex items-center gap-2">
                <input
                  className="nb-input min-w-0 flex-1 !py-1.5 text-[0.78rem]"
                  type="url"
                  inputMode="url"
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) void doVerify() }}
                  placeholder="https://x.com/ユーザー名/status/…"
                  aria-label="投稿したポストの URL"
                />
                <button
                  type="button"
                  className="nb-btn flex shrink-0 items-center gap-1.5 !py-1.5 text-[0.76rem]"
                  style={{ background: 'var(--color-lime)' }}
                  onClick={() => void doVerify()}
                  disabled={busy || !postUrl.trim()}
                >
                  {busy && <Ring size={12} />}
                  確認する
                </button>
              </div>
            </div>

            <p className="text-[0.68rem] font-bold leading-relaxed opacity-50">
              鍵アカウントのポストでは確認できません。確認が終わったら、ポストは消しても大丈夫です（バッジはそのまま残ります）。
            </p>
          </div>
        )}
      {done && (
        <p className="nb-chip mt-1.5 !whitespace-normal !py-1 leading-relaxed" style={{ background: 'var(--color-lime)' }} role="status">
          {done}
        </p>
      )}
      {error && (
        <p className="mt-1.5 text-[0.76rem] font-bold" style={{ color: 'var(--color-pink)' }} role="alert">{error}</p>
      )}
    </div>
  )
}
