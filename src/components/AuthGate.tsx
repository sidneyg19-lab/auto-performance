import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type Organization = { id: string; name: string; role: string }
type View = 'login' | 'forgot' | 'reset'

// The recovery email must return to the app's deployed root, not to supabase.com.
const recoveryRedirect = `${window.location.origin}${import.meta.env.BASE_URL}`

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>(() =>
    window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery') ? 'reset' : 'login',
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') {
        setView('reset')
        setError('')
        setNotice('Defina uma nova senha para sua conta.')
      }
    })
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setError('Não foi possível validar a sessão. Atualize a página.')
      setSession(data.session)
      setLoading(false)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!session?.user.id || view === 'reset') {
      setOrganization(null)
      setLoading(false)
      return
    }
    let active = true
    async function loadOrganization() {
      setLoading(true)
      setError('')
      const { data, error: memberError } = await supabase.from('organization_members')
        .select('role, organizations(id, name)')
        .eq('user_id', session!.user.id)
        .eq('active', true)
        .limit(1)
        .maybeSingle()
      if (!active) return
      if (memberError) {
        setError(`Erro ao consultar empresa: ${memberError.message}`)
        setOrganization(null)
      } else {
        const org = data?.organizations as unknown as { id: string; name: string } | null
        setOrganization(org ? { id: org.id, name: org.name, role: data!.role } : null)
      }
      setLoading(false)
    }
    void loadOrganization()
    return () => { active = false }
  }, [session?.user.id, view])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice(''); setSubmitting(true)
    const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (loginError) setError('Não foi possível entrar. Confira e-mail e senha.')
    setSubmitting(false)
  }

  async function handleForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice(''); setSubmitting(true)
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: recoveryRedirect })
    setSubmitting(false)
    if (sendError) {
      setError('Não foi possível enviar agora. Aguarde um pouco e tente novamente.')
      return
    }
    setNotice('Se o e-mail estiver cadastrado, você receberá um link de recuperação. Confira também o spam.')
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('')
    if (!session) { setError('Link inválido ou expirado. Solicite outro na tela de login.'); return }
    if (newPassword.length < 8) { setError('Use pelo menos 8 caracteres.'); return }
    if (newPassword !== confirmPassword) { setError('As senhas não coincidem.'); return }
    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) { setError('Não foi possível redefinir: ' + updateError.message); setSubmitting(false); return }
    const { error: logoutError } = await supabase.auth.signOut()
    setSubmitting(false)
    setNewPassword(''); setConfirmPassword(''); setPassword('')
    setView('login')
    window.history.replaceState({}, '', recoveryRedirect)
    setNotice(logoutError ? 'Senha atualizada. Faça login novamente; se necessário, saia da conta antes.' : 'Senha atualizada! Entre com sua nova senha.')
  }

  if (loading) return <div style={styles.screen}>Carregando Auto Performance...</div>

  // Recovery takes precedence even when Supabase automatically establishes a temporary session.
  if (view === 'reset') return <main style={styles.screen}><form onSubmit={handleReset} style={styles.card}>
    <div style={styles.logo}>AP</div><h1 style={styles.heading}>Nova senha</h1>
    <p style={styles.subtitle}>Cadastre sua nova senha para acessar o Auto Performance.</p>
    <label style={styles.label} htmlFor="reset-password">Nova senha</label>
    <input id="reset-password" style={styles.input} type="password" autoComplete="new-password" required minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)}/>
    <label style={styles.label} htmlFor="confirm-password">Confirmar nova senha</label>
    <input id="confirm-password" style={styles.input} type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}/>
    {error && <p role="alert" style={styles.error}>{error}</p>}
    {notice && <p role="status" style={styles.notice}>{notice}</p>}
    <button style={styles.button} disabled={submitting || !session}>{submitting ? 'Salvando...' : 'Salvar nova senha'}</button>
    {!session && <button type="button" style={styles.link} onClick={() => { setView('forgot'); setError(''); setNotice('') }}>Solicitar outro link</button>}
  </form></main>

  if (!session) return <main style={styles.screen}><form onSubmit={view === 'forgot' ? handleForgot : handleLogin} style={styles.card}>
    <div style={styles.logo}>AP</div><h1 style={styles.heading}>Auto Performance</h1>
    <p style={styles.subtitle}>{view === 'forgot' ? 'Informe seu e-mail para recuperar a senha.' : 'Gestão inteligente para seu negócio'}</p>
    <label style={styles.label} htmlFor="auth-email">E-mail</label>
    <input id="auth-email" style={styles.input} type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}/>
    {view === 'login' && <><label style={styles.label} htmlFor="auth-password">Senha</label>
      <input id="auth-password" style={styles.input} type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}/></>}
    {error && <p role="alert" style={styles.error}>{error}</p>}
    {notice && <p role="status" style={styles.notice}>{notice}</p>}
    <button style={styles.button} disabled={submitting}>{submitting ? 'Aguarde...' : view === 'forgot' ? 'Enviar link de recuperação' : 'Entrar no sistema'}</button>
    <button type="button" style={styles.link} onClick={() => { setView(view === 'forgot' ? 'login' : 'forgot'); setError(''); setNotice('') }}>
      {view === 'forgot' ? 'Voltar ao login' : 'Esqueceu sua senha?'}
    </button>
  </form></main>

  if (!organization) return <main style={styles.screen}><div style={styles.card}>
    <h2>Empresa não encontrada</h2><p style={styles.subtitle}>Seu usuário não possui uma empresa acessível.</p>
    {error && <p role="alert" style={styles.error}>{error}</p>}
    <button style={styles.button} onClick={() => void supabase.auth.signOut()}>Sair</button>
  </div></main>

  return <>{children}</>
}

const styles: Record<string, CSSProperties> = {
  screen: { minHeight: '100vh', background: '#090f20', color: '#f1f5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Inter, system-ui, sans-serif' },
  card: { width: '100%', maxWidth: 410, padding: 36, borderRadius: 20, background: '#151f36', border: '1px solid #293957', display: 'flex', flexDirection: 'column', gap: 14 },
  logo: { width: 52, height: 52, borderRadius: 15, background: 'linear-gradient(135deg,#338bff,#8b4cff)', display: 'grid', placeItems: 'center', fontWeight: 800 },
  heading: { fontSize: 28, margin: 0, color: '#fff' },
  subtitle: { color: '#9cacc9', fontSize: 14, marginBottom: 12 },
  label: { fontSize: 13, color: '#c2d0e8' },
  input: { padding: 13, borderRadius: 9, border: '1px solid #354765', background: '#0d1629', color: '#fff', fontSize: 15 },
  button: { padding: 14, border: 0, borderRadius: 10, background: 'linear-gradient(90deg,#348bff,#7953f8)', color: '#fff', fontWeight: 700, cursor: 'pointer', marginTop: 12 },
  link: { background: 'transparent', border: 0, color: '#a9c5ff', cursor: 'pointer', padding: 8, fontSize: 14 },
  error: { color: '#ff8e9b', fontSize: 13 }, notice: { color: '#a9c5ff', fontSize: 13 },
}
