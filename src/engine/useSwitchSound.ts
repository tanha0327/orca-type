import { useEffect } from 'react'
import { playSwitchSound, unlockAudio } from '../lib/switchSound'
import { useKeymapStore } from '../store/keymapStore'
import { engine } from './useEngine'

/**
 * エンジンの状態の変化を見て打鍵音を鳴らす。
 * 手元のキーボード・盤面のダブルクリック・ホイール・パッド・PiP のどこからの入力でも鳴る。
 * アプリ全体で 1 回だけ呼ぶ。
 */
export function useSwitchSound() {
  useEffect(() => {
    let prev = engine.getSnapshot()

    const unsubscribe = engine.subscribe(() => {
      const snap = engine.getSnapshot()
      const { profile, volume } = useKeymapStore.getState().sound
      if (profile !== 'off') {
        const play = (ev: Parameters<typeof playSwitchSound>[0]) => playSwitchSound(ev, profile, volume)

        const wasDown = new Set(prev.down)
        const isDown = new Set(snap.down)
        for (const k of snap.down) if (!wasDown.has(k)) play('down')
        for (const k of prev.down) if (!isDown.has(k)) play('up')

        // 判定待ちだったキーが長押しに倒れた（MOD-TAP でも LAYER-TAP でも）
        const pendingBefore = new Set(prev.presses.filter((p) => p.state === 'pending').map((p) => p.keyId))
        if (snap.presses.some((p) => p.state === 'hold' && pendingBefore.has(p.keyId))) play('hold')

        if (snap.combo && snap.combo.at !== prev.combo?.at) play('combo')

        const last = snap.last
        if (last && last.id !== prev.last?.id && (last.kind === 'encoder' || last.kind === 'pad')) play(last.kind)
      }
      prev = snap
    })

    // 音を出せるように、ページを操作したタイミングで AudioContext を起こしておく
    const wake = () => {
      if (useKeymapStore.getState().sound.profile !== 'off') unlockAudio()
    }
    window.addEventListener('pointerdown', wake)
    window.addEventListener('keydown', wake)

    return () => {
      unsubscribe()
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('keydown', wake)
    }
  }, [])
}
