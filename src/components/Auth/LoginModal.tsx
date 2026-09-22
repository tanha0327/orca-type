import { useEffect, useState } from 'react'
import {
  authEnabled, resetPasswordForEmail, signInWithEmail, signInWithGoogle, signUpWithEmail,
} from '../../lib/auth'
import { errorMessage } from '../../lib/errors'
import { useAuthStore } from '../../store/authStore'
import { Ring } from '../Ring'

type Mode = 'signin' | 'signup'

/**
 * ログイン専用のモーダル。ヘッダーの「ログイン」ボタン、フィードの投稿・いいね・コメントなど
 * ログインが必要な操作から共通で開く単一の入口。Google ログインを上に、
 * その他の手段（メール＋パスワード）を下に並べる。
 */
export function LoginModal() {
  const open = useAuthStore((s) => s.loginModalOpen)
  const close = useAuthStore((s) => s.closeLoginModal)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open || !authEnabled()) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
      style={{ background: 'color-mix(in srgb, var(--color-ink) 45%, transparent)' }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ログイン"
        className="nb nb-lg grid w-full max-w-3xl overflow-hidden sm:grid-cols-2"
      >
        <LoginHero />
        <div className="flex min-w-0 flex-col">
          <LoginForm onClose={close} />
        </div>
      </div>
    </div>
  )
}

function LoginHero() {
  return (
    <div
      className="relative hidden min-h-[26rem] flex-col justify-between overflow-hidden p-6 sm:flex"
      style={{ background: 'var(--color-purple)', color: 'var(--color-paper)' }}
    >
      <span
        className="pointer-events-none absolute -bottom-10 -left-8 h-32 w-32 rounded-full"
        style={{ background: 'var(--color-lime)', border: '3px solid var(--color-ink)' }}
      />
      <span
        className="pointer-events-none absolute -right-10 top-8 h-24 w-24 rounded-full"
        style={{ background: 'var(--color-orange)', border: '3px solid var(--color-ink)' }}
      />
      <span
        className="pointer-events-none absolute bottom-20 right-6 h-9 w-9 rounded-full"
        style={{ background: 'var(--color-pink)', border: '3px solid var(--color-ink)' }}
      />
      <span
        className="pointer-events-none absolute left-10 top-24 h-4 w-4 rounded-full"
        style={{ background: 'var(--color-paper)', border: '2px solid var(--color-ink)' }}
      />

      <div className="relative z-10">
        <p className="nb-eyebrow" style={{ color: 'var(--color-paper)', opacity: 0.85 }}>ORCA TYPE</p>
        <h2 className="mt-2 text-[2.6rem]">
          ようこそ
          <br />
          みんなの
          <br />
          配列へ
        </h2>
      </div>

      <p className="relative z-10 max-w-[16rem] text-[0.8rem] font-bold leading-relaxed opacity-85">
        ログインすると、今の配列を投稿したり、他の人の投稿にいいね・コメントで反応できます。
      </p>
    </div>
  )
}

function LoginForm({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
    setNotice(null)
  }

  const doGoogle = async () => {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      await signInWithGoogle()
      // OAuth はリダイレクトするので、busy はこのまま残ってよい
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  const doSubmit = async () => {
    if (!email.trim() || !password) return
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password)
      } else {
        const { needsEmailConfirmation } = await signUpWithEmail(email.trim(), password)
        if (needsEmailConfirmation) {
          setNotice('確認メールを送りました。メール内のリンクを開くとログインできます。')
        }
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const doReset = async () => {
    if (!email.trim()) {
      setError('パスワードを再設定するメールアドレスを先に入力してください')
      return
    }
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      await resetPasswordForEmail(email.trim())
      setNotice('パスワード再設定用のメールを送りました。')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[1.5rem]">{mode === 'signin' ? 'ログイン' : '新規登録'}</h3>
          <p className="mt-1 text-[0.8rem] font-bold opacity-70">
            {mode === 'signin' ? 'おかえりなさい。続きから始めましょう。' : 'メールアドレスで新しいアカウントを作ります。'}
          </p>
        </div>
        <button type="button" className="nb-btn shrink-0 !py-1.5 text-[0.78rem]" onClick={onClose}>
          閉じる
        </button>
      </div>

      <button
        type="button"
        className="nb-btn mt-5 w-full !py-2.5 text-[0.85rem]"
        onClick={() => void doGoogle()}
        disabled={busy}
      >
        G Google でログイン
      </button>

      <div className="my-4 flex items-center gap-2">
        <span className="h-[3px] flex-1" style={{ background: 'var(--color-ink)', opacity: 0.15 }} />
        <span className="nb-eyebrow !opacity-50">または</span>
        <span className="h-[3px] flex-1" style={{ background: 'var(--color-ink)', opacity: 0.15 }} />
      </div>

      <label className="block">
        <span className="nb-eyebrow">メールアドレス</span>
        <input
          className="nb-input mt-1"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </label>

      <label className="mt-3 block">
        <span className="nb-eyebrow">パスワード</span>
        <input
          className="nb-input mt-1"
          type="password"
          value={password}
          maxLength={72}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8文字以上"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) void doSubmit() }}
        />
      </label>

      {mode === 'signin' && (
        <button
          type="button"
          className="mt-2 self-start text-[0.72rem] font-bold underline opacity-70"
          onClick={() => void doReset()}
        >
          パスワードを忘れた場合はリセット
        </button>
      )}

      {(error || notice) && (
        <p className="nb-chip mt-3" style={{ background: error ? 'var(--color-pink)' : 'var(--color-lime)' }}>
          {error ?? notice}
        </p>
      )}

      <button
        type="button"
        className="nb-btn mt-4 flex w-full items-center justify-center gap-2 !py-2.5 text-[0.85rem]"
        style={{ background: 'var(--color-lime)' }}
        disabled={busy || !email.trim() || !password}
        onClick={() => void doSubmit()}
      >
        {busy && <Ring size={14} />}
        {mode === 'signin' ? 'ログイン' : '登録する'}
        <span aria-hidden>→</span>
      </button>

      <p className="mt-4 text-center text-[0.76rem] font-bold opacity-70">
        {mode === 'signin'
          ? (
            <>
              アカウントがない方は{' '}
              <button type="button" className="underline" onClick={() => switchMode('signup')}>新規登録</button>
            </>
          )
          : (
            <>
              すでにアカウントがある方は{' '}
              <button type="button" className="underline" onClick={() => switchMode('signin')}>ログイン</button>
            </>
          )}
      </p>
    </div>
  )
}
