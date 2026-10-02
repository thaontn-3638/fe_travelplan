import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // globals: true để @testing-library/react tự cleanup DOM giữa các test —
    // nếu không, component của test trước còn sót lại và query bắt trúng 2 lần.
    globals: true,
  },
})
