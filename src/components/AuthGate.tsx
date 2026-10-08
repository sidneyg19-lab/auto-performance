import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type Organization = {
  id: string
  name: string
  role: string
}

export default function AuthGate({
  children,
}: {
  children: ReactNode
}) {
  const [session, setSession] = useState<Session | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true

    async function loadSession() {
      const { data, error } = await supabase.auth.getUser()

      if (!active) return

      if (error || !data.user) {
        setSession(null)
        setLoading(false)
        return
      }

      const result = await supabase.auth.getSession()
      if (active) setSession(result.data.session)
    }

    void loadSession()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!active) return
        setSession(nextSession)
      },
    )

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user.id) {
      setOrganization(null)
      setLoading(false)
      return
    }

    let active = true

    async function loadOrganization() {
      setLoading(true)
      setError('')

      const { data, error } = await supabase
        .from('organization_members')
        .select('role, organizations(id, name)')
        .eq('user_id', session!.user.id)
        .limit(1)
        .maybeSingle()

      if (!active) return

      if (error) {
        setError(`Erro ao consultar empresa: ${error.message}`)
        setOrganization(null)
      } else {
        const org = data?.organizations as unknown as {
          id: string
          name: string
        } | null

        setOrganization(
          org
            ? { id: org.id, name: org.name, role: data!.role }
            : null,
        )
      }

      setLoading(false)
    }

    void loadOrganization()

    return () => {
      active = false
    }
  }, [session?.user.id])

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) setError('Não foi possível entrar. Confira e-mail e senha.')

    setSubmitting(false)
  }

  if (loading) {
    return <div style={styles.screen}>Carregando Auto Performance...</div>
  }

  if (!session) {
    return (
      <main style={styles.screen}>
        <form onSubmit={handleLogin} style={styles.card}>
          <div style={styles.logo}>AP</div>
          <h1 style={styles.heading}>Auto Performance</h1>
          <p style={styles.subtitle}>Gestão inteligente para seu negócio</p>

          <label style={styles.label}>E-mail</label>
          <input
            style={styles.input}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label style={styles.label}>Senha</label>
          <input
            style={styles.input}
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {error && <p role="alert" style={styles.error}>{error}</p>}

          <button style={styles.button} disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar no sistema'}
          </button>
        </form>
      </main>
    )
  }

  if (!organization) {
    return (
      <main style={styles.screen}>
        <div style={styles.card}>
          <h2>Empresa não encontrada</h2>
          <p style={styles.subtitle}>
            Seu usuário não possui uma empresa acessível.
          </p>
          {error && <p role="alert" style={styles.error}>{error}</p>}
          <button
            style={styles.button}
            onClick={() => void supabase.auth.signOut()}
          >
            Sair
          </button>
        </div>
      </main>
    )
  }

  return <>{children}</>
}

const styles: Record<string, React.CSSProperties> = {
  screen: {
    minHeight: '100vh',
    background: '#090f20',
    color: '#f1f5ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 410,
    padding: 36,
    borderRadius: 20,
    background: '#151f36',
    border: '1px solid #293957',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 15,
    background: 'linear-gradient(135deg,#338bff,#8b4cff)',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 800,
  },
  heading: { fontSize: 28, margin: 0, color: '#fff' },
  subtitle: { color: '#9cacc9', fontSize: 14, marginBottom: 12 },
  label: { fontSize: 13, color: '#c2d0e8' },
  input: {
    padding: 13,
    borderRadius: 9,
    border: '1px solid #354765',
    background: '#0d1629',
    color: '#fff',
    fontSize: 15,
  },
  button: {
    padding: 14,
    border: 0,
    borderRadius: 10,
    background: 'linear-gradient(90deg,#348bff,#7953f8)',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 12,
  },
  error: { color: '#ff8e9b', fontSize: 13 },
}