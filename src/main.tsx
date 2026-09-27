import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import { App } from './App'

/*
 * 画面の一部は開いたときに別のファイルとして読み込む。新しい版を公開すると古い版のファイルは無くなるので、
 * 公開の前から開いたままのページがそれを読みに行くと失敗する。そのときはページを読み直して新しい版にする
 * （読み直してもまた失敗するとき＝通信が切れているときなどは、繰り返さずに画面の側でエラーを出す）
 */
const RELOADED_AT_KEY = 'orca-map/reloaded-for-new-version'
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT_KEY) ?? 0)
    if (Date.now() - last < 10_000) return
    sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()))
  } catch {
    return // sessionStorage が使えないと読み直しの繰り返しを止められないので、読み直さない
  }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
