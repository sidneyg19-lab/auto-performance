
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { randomUUID } from 'node:crypto'

const appVersion = randomUUID()

function versionPlugin(): Plugin {
  return {
    name: 'auto-performance-version',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: appVersion }),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), versionPlugin()],
  base: '/auto-performance/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
})
