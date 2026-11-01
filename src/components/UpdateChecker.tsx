
import { useEffect, useState } from 'react'

const BASE_URL = import.meta.env.BASE_URL
const CURRENT_VERSION = __APP_VERSION__

export default function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    let active = true

    async function checkVersion() {
      try {
        const response = await fetch(
          `${BASE_URL}version.json?t=${Date.now()}`,
          { cache: 'no-store' },
        )

        if (!response.ok) return

        const data: { version?: string } = await response.json()

        if (
          active &&
          data.version &&
          data.version !== CURRENT_VERSION
        ) {
          setUpdateAvailable(true)
        }
      } catch {
        // Sem conexão, mantém a versão atual.
      }
    }

    void checkVersion()

    const interval = window.setInterval(checkVersion, 60_000)
    window.addEventListener('focus', checkVersion)

    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', checkVersion)
    }
  }, [])

  if (!updateAvailable) return null

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        maxWidth: 360,
        padding: 20,
        borderRadius: 14,
        background: '#172033',
        color: '#fff',
        boxShadow: '0 12px 40px rgba(0,0,0,.25)',
      }}
    >
      <strong>Atualização do Auto Performance</strong>

      <p style={{ fontSize: 14, lineHeight: 1.5 }}>
        O Auto Performance recebeu melhorias.
        Atualize quando terminar suas operações em andamento.
      </p>

      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          background: '#2563eb',
          color: '#fff',
          border: 0,
          borderRadius: 8,
          padding: '10px 16px',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        Atualizar agora
      </button>
    </div>
  )
}
