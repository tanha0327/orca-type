import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: true },
  build: {
    rollupOptions: {
      // ORCA TYPE 本体と、カメラで撃つビーム（/beam/）の 2 ページ構成
      input: {
        main: 'index.html',
        beam: 'beam/index.html',
      },
    },
  },
})
