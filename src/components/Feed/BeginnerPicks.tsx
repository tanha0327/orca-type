import { useState } from 'react'
import { rankBeginnerPicks } from '../../lib/beginnerRecs'
import type { SharedKeymap } from '../../lib/feed'
import { useAuthStore } from '../../store/authStore'
import { useBeginnerRecStore } from '../../store/beginnerRecStore'
import { useProfileStore } from '../../store/profileStore'
import { useProfileTags, useProfileTagsStore } from '../../store/profileTagsStore'
import { Ring } from '../Ring'

/** 上に出すおすすめの数 */
const PICK_COUNT = 3

const DISMISS_KEY = 'orca-map/beginner-cta-dismissed'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * みんなの配列のいちばん上に出す、分割初心者向けの欄。
 * プロフィールで「分割キーボード初心者」にしている人には、初心者におすすめの配列を
 * （持っているキーボードの配列を優先して）見せる。タグをまだ設定していない人には、設定の案内を出す。
 */
export function BeginnerPicks({
  pool, likeCounts, onOpen, onShowAll,
}: {
  /** 読み込んでいる投稿（初心者におすすめの投稿は、タイムラインの 50 件に入っていなくても含む） */
  pool: SharedKeymap[]
  likeCounts: Record<string, number>
  onOpen: (item: SharedKeymap) => void
  /** 「初心者におすすめ」の絞り込みに切り替える */
  onShowAll: () => void
}) {
  const user = useAuthStore((s) => s.user)
  const myTags = useProfileTags(user?.id)
  const tagsAvailable = useProfileTagsStore((s) => s.available)
  const recsAvailable = useBeginnerRecStore((s) => s.available)
  const recsLoaded = useBeginnerRecStore((s) => s.loaded)
  const counts = useBeginnerRecStore((s) => s.counts)
  const openProfileEditor = useProfileStore((s) => s.openEditor)
  const [dismissed, setDismissed] = useState(readDismissed)

  if (!user || tagsAvailable !== true || recsAvailable === false) return null

  if (myTags?.splitBeginner) {
    const picks = rankBeginnerPicks(pool, {
      counts, likeCounts, ownedKeyboards: myTags.keyboards, myUserId: user.id,
    }).slice(0, PICK_COUNT)

    return (
      <section
        className="border-b-[3px] border-[var(--color-ink)] p-3"
        style={{ background: 'color-mix(in srgb, var(--color-lime) 30%, var(--color-paper))' }}
        aria-label="分割初心者のあなたにおすすめ"
      >
        <div className="flex items-center gap-2">
          {/* 狭い幅で「おすす／め」のように単語の途中で折り返さないよう、文節ごとにまとめる */}
          <h3 className="min-w-0 flex-1 text-[0.98rem] !leading-tight">
            🔰 <span className="inline-block">分割初心者の</span><span className="inline-block">あなたにおすすめ</span>
          </h3>
          {picks.length > 0 && (
            <button type="button" className="nb-btn shrink-0 !py-1 !px-2.5 text-[0.74rem]" onClick={onShowAll}>
              すべて見る
            </button>
          )}
        </div>

        {!recsLoaded && (
          <p className="flex items-center gap-2 py-3 text-[0.8rem] font-bold opacity-60">
            <Ring size={14} />
            読み込み中…
          </p>
        )}
        {recsLoaded && picks.length === 0 && (
          <p className="mt-1.5 text-[0.76rem] font-bold leading-relaxed opacity-70">
            まだ初心者におすすめされた配列がありません。分割キーボードに慣れている人が投稿の 🔰 ボタンで
            おすすめすると、ここに出ます。
          </p>
        )}
        {picks.length > 0 && (
          <ol className="mt-2 space-y-1.5">
            {picks.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="nb nb-flat flex w-full items-center gap-2.5 p-2 text-left"
                  onClick={() => onOpen(item)}
                >
                  <span
                    className="nb-chip shrink-0"
                    style={{ background: 'var(--color-lime)' }}
                    title={`${counts[item.id] ?? 0} 人が分割初心者におすすめしています`}
                  >
                    🔰 {counts[item.id] ?? 0}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.85rem] font-black">{item.name}</span>
                    <span className="block truncate text-[0.7rem] font-bold opacity-60">
                      {item.author} ・ {item.keymap.layers.length} レイヤー ・ ♥ {likeCounts[item.id] ?? 0}
                    </span>
                  </span>
                  <span className="shrink-0 text-[0.74rem] font-black">見る →</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    )
  }

  // タグをまだ一度も設定していない人にだけ、設定の案内を出す（閉じたら二度と出さない）
  if (myTags === null && !dismissed) {
    const dismiss = () => {
      setDismissed(true)
      try {
        localStorage.setItem(DISMISS_KEY, '1')
      } catch {
        /* 保存できない環境では、このページを開いている間だけ閉じておく */
      }
    }
    return (
      <section
        className="flex items-start gap-3 border-b-[3px] border-[var(--color-ink)] p-3"
        style={{ background: 'color-mix(in srgb, var(--color-lime) 30%, var(--color-paper))' }}
        aria-label="分割キーボード初心者の方へ"
      >
        <span aria-hidden className="shrink-0 text-[1.6rem] leading-none">🔰</span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.86rem] font-black">分割キーボードははじめて？</p>
          <p className="mt-0.5 text-[0.74rem] font-bold leading-relaxed opacity-75">
            プロフィールで「分割キーボード初心者」にすると、ここに初心者におすすめの配列が出ます。
            持っているキーボードも登録できます。
          </p>
          <button
            type="button"
            className="nb-btn mt-2 !py-1.5 text-[0.76rem]"
            style={{ background: 'var(--color-lime)' }}
            onClick={openProfileEditor}
          >
            プロフィールを設定する
          </button>
        </div>
        <button
          type="button"
          className="nb-btn shrink-0 !h-8 !w-8 !p-0 text-[0.9rem]"
          aria-label="この案内を閉じる"
          title="この案内を閉じる"
          onClick={dismiss}
        >
          ×
        </button>
      </section>
    )
  }

  return null
}
