import { useEffect, useState, type CSSProperties } from 'react'
import {
  authEnabled, resetPasswordForEmail, signInWithEmail, signInWithGoogle, signUpWithEmail,
} from '../../lib/auth'
import { errorMessage } from '../../lib/errors'
import { useAuthStore } from '../../store/authStore'
import { Ring } from '../Ring'
import { KEYSWITCH_GEOMETRY } from '../../data/keyswitchLineart'
import { KEYSWITCH_CALLOUT_GUTTER, KeyswitchIllustration } from './KeyswitchIllustration'

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

// ヒーロー列の内幅（デスクトップで約 20.8rem）を基準に全体を拡縮し、狭い画面でも見出しと重ならないようにする。
// デスクトップではキーキャップ込みの高さがおよそ 28rem。スイッチの中心線はヒーロー右端（ちょうど半分見切れる位置）。
const HERO_INNER_REM = 20.8
const UNIT = `${(28 / HERO_INNER_REM / KEYSWITCH_GEOMETRY.height) * 100}cqw`
const ILLUSTRATION_WIDTH = KEYSWITCH_GEOMETRY.width + KEYSWITCH_CALLOUT_GUTTER
const ILLUSTRATION_STYLE: CSSProperties = {
  right: `calc(${UNIT} * ${-KEYSWITCH_GEOMETRY.width / 2})`,
  width: `calc(${UNIT} * ${ILLUSTRATION_WIDTH})`,
  aspectRatio: `${ILLUSTRATION_WIDTH} / ${KEYSWITCH_GEOMETRY.height}`,
  color: 'var(--color-ink)',
}

const GRID_LINE = 'color-mix(in srgb, var(--color-ink) 8%, transparent)'
const GRID_STYLE: CSSProperties = {
  backgroundImage: `linear-gradient(to right, ${GRID_LINE} 1px, transparent 1px), linear-gradient(to bottom, ${GRID_LINE} 1px, transparent 1px)`,
  backgroundSize: '1.25rem 1.25rem',
  backgroundPosition: 'right top',
  maskImage: 'linear-gradient(to left, #000 25%, transparent 85%)',
  WebkitMaskImage: 'linear-gradient(to left, #000 25%, transparent 85%)',
}

const HIGHLIGHT_STYLE: CSSProperties = {
  background: 'var(--color-lime)',
  color: 'var(--color-ink)',
  padding: '0 0.2em',
  whiteSpace: 'nowrap',
}

function LoginHero() {
  return (
    <div
      className="relative hidden min-h-[30rem] flex-col justify-between overflow-hidden p-6 sm:flex"
      style={{ background: 'var(--color-paper)', color: 'var(--color-ink)', containerType: 'inline-size' }}
    >
      <div className="pointer-events-none absolute inset-0" style={GRID_STYLE} />

      <div className="pointer-events-none absolute top-1/2 -translate-y-1/2" style={ILLUSTRATION_STYLE}>
        <KeyswitchIllustration className="h-full w-full" />
      </div>

      <div className="relative z-10">
        <p className="nb-eyebrow" style={{ color: 'var(--color-ink)', opacity: 0.7 }}>ORCA TYPE</p>
        <h2 className="mt-2" style={{ fontSize: `min(2.6rem, ${(2.6 / HERO_INNER_REM) * 100}cqw)` }}>
          ようこそ
          <br />
          みんなの
          <br />
          配列へ
        </h2>
      </div>

      <p
        className="relative z-10 text-[0.8rem] font-bold leading-relaxed"
        style={{ maxWidth: `min(14rem, ${(14 / HERO_INNER_REM) * 100}cqw)`, color: 'color-mix(in srgb, var(--color-ink) 72%, transparent)' }}
      >
        ログインすると、今の配列を<mark style={HIGHLIGHT_STYLE}>投稿</mark>したり、他の人の投稿に
        <mark style={HIGHLIGHT_STYLE}>いいね・コメント</mark>で反応できます。
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
