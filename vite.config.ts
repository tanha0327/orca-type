import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * 起動時に読み込むライブラリを、アプリのコードとは別のファイルに分ける。
 * 1 つのファイルが大きくなりすぎず（500 kB の注意が出ない）、アプリを更新してもライブラリのファイルは
 * 変わらないので、2 回目からはブラウザのキャッシュが効く。
 * 開いたときに読み込むもの（画像保存の html2canvas など）まで起動時に読み込まないよう、分けるものは名前で挙げる
 */
const VENDOR_CHUNKS: Record<string, readonly string[]> = {
  react: ['react', 'react-dom', 'scheduler'],
  supabase: ['@supabase/', 'iceberg-js'],
}

function vendorChunk(id: string): string | undefined {
  const path = id.split('/node_modules/').pop()
  if (!path || path === id) return undefined
  for (const [chunk, packages] of Object.entries(VENDOR_CHUNKS)) {
    if (packages.some((p) => (p.endsWith('/') ? path.startsWith(p) : path === p || path.startsWith(`${p}/`)))) return chunk
  }
  return undefined
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: true },
  build: {
    rollupOptions: {
      output: { manualChunks: vendorChunk },
    },
  },
})
