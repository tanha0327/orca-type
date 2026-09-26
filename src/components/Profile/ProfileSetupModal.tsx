import type { User } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import { SAMPLE_AVATARS, SAMPLE_NAMES } from '../../data/profileSamples'
import { uploadAvatar } from '../../lib/profile'
import {
  linkXAccount, unlinkXAccount, verificationFromUser, xIdentityOf, xVerificationEnabled,
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
  const notice = useProfileStore((s) => s.notice)
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
          {notice && (
            <p
              className="nb-chip !whitespace-normal !py-1 leading-relaxed"
              style={{ background: notice.kind === 'ok' ? 'var(--color-lime)' : 'var(--color-pink)' }}
              role={notice.kind === 'error' ? 'alert' : 'status'}
            >
              {notice.text}
            </p>
          )}

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

          <XLinkSection user={user} />

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

/** X（旧 Twitter）のアカウントを紐づけて本人確認する欄。連携すると投稿・コメントに本人確認バッジが付く */
function XLinkSection({ user }: { user: User }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!xVerificationEnabled()) return null

  const identity = xIdentityOf(user)
  const verification = verificationFromUser(user)

  const doLink = async () => {
    setBusy(true)
    setError(null)
    try {
      await linkXAccount()
      // X の認証ページへリダイレクトするので、busy はこのまま残ってよい
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  const doUnlink = async () => {
    if (!confirm('X との連携を解除しますか？ 投稿やコメントの本人確認バッジも外れます。')) return
    setBusy(true)
    setError(null)
    try {
      await unlinkXAccount(user)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <span className="nb-eyebrow">本人確認（X 連携）</span>
      {identity
        ? (
          <div className="nb nb-flat mt-1.5 flex flex-wrap items-center gap-2 p-2.5">
            {verification
              ? <XVerifiedBadge verification={verification} />
              : <span className="nb-chip" style={{ background: 'var(--color-cyan)' }}>✓ 𝕏 連携済み</span>}
            <span className="min-w-0 flex-1 text-[0.72rem] font-bold opacity-60">本人確認済み</span>
            <button
              type="button"
              className="nb-btn flex shrink-0 items-center gap-1.5 !py-1 !px-2 text-[0.72rem]"
              onClick={() => void doUnlink()}
              disabled={busy}
            >
              {busy && <Ring size={12} />}
              連携を解除
            </button>
          </div>
        )
        : (
          <div className="nb nb-flat mt-1.5 p-2.5">
            <p className="text-[0.74rem] font-bold leading-relaxed opacity-70">
              X（旧 Twitter）と連携すると、投稿やコメントに「✓ 𝕏 @ユーザー名」のバッジが付き、
              そこから X のプロフィールを開いて本人の投稿だと確かめてもらえます。
            </p>
            <button
              type="button"
              className="nb-btn mt-2 flex w-full items-center justify-center gap-2 !py-1.5 text-[0.78rem]"
              style={{ background: 'var(--color-cyan)' }}
              onClick={() => void doLink()}
              disabled={busy}
            >
              {busy && <Ring size={13} />}
              𝕏 と連携して本人確認する
            </button>
            <p className="mt-1.5 text-[0.68rem] font-bold opacity-50">
              X の認証ページに移動します。名前やアイコンを変えた場合は、先に保存してください。
            </p>
          </div>
        )}
      {error && (
        <p className="mt-1.5 text-[0.76rem] font-bold" style={{ color: 'var(--color-pink)' }}>{error}</p>
      )}
    </div>
  )
}
