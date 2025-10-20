import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["escpos", "escpos-usb", "usb", "net", "fs", "path", "child_process"],
  },
  build: {
    rollupOptions: {
      external: ["escpos", "escpos-usb", "usb", "fs", "path", "net", "os", "child_process"],
    },
  },
})
