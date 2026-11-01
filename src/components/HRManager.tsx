import { useEffect, useState } from 'react'
import { CheckCheck, RefreshCw, Save, ShieldCheck, UserRound, UsersRound, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './HRManager.css'

type Action = 'can_view' | 'can_create' | 'can_edit' | 'can_delete'
type Permission = Record<Action, boolean>
type Member = { user_id: string; role: string; active: boolean; name: string; phone: string }
const moduleList = [
  ['customers', 'Clientes'], ['vehicles', 'Veículos'], ['products', 'Produtos'],
  ['stock', 'Estoque'], ['services', 'Serviços'], ['suppliers', 'Fornecedores'],
  ['quotes', 'Orçamentos'], ['work_orders', 'Ordens de serviço'], ['sales', 'Vendas'],
  ['financial', 'Financeiro'], ['goals', 'Metas'],
] as const
const actions: { key: Action; label: string }[] = [
  { key: 'can_view', label: 'Ver' }, { key: 'can_create', label: 'Criar' },
  { key: 'can_edit', label: 'Editar' }, { key: 'can_delete', label: 'Excluir' },
]
const empty = (): Permission => ({ can_view: false, can_create: false, can_edit: false, can_delete: false })
const all = (): Permission => ({ can_view: true, can_create: true, can_edit: true, can_delete: true })
const isAdmin = (m: Member) => m.role === 'owner' || m.role === 'admin'

export default function HRManager({ orgId }: { orgId: string }) {
  const [members, setMembers] = useState<Member[]>([])
  const [selected, setSelected] = useState('')
  const [tab, setTab] = useState<'dados'|'permissoes'|'seguranca'>('dados')
  const [profileName, setProfileName] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [rows, setRows] = useState<Record<string, Permission>>({})
  const [loading, setLoading] = useState(true)
  const [loadingPermissions, setLoadingPermissions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const member = members.find(m => m.user_id === selected)
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || '')) }, [])
  useEffect(() => { setProfileName(member?.name === 'Usuário sem nome' ? '' : member?.name || ''); setProfilePhone(member?.phone || ''); setPassword(''); setPasswordConfirm('') }, [selected, member?.name, member?.phone])
  async function saveProfile() {
    if (!member || !profileName.trim() || profileSaving) return
    setProfileSaving(true); setError(''); setMessage('')
    const result = await supabase.rpc('admin_update_member_profile', { p_org: orgId, p_user: member.user_id, p_name: profileName.trim(), p_phone: profilePhone.trim() })
    setProfileSaving(false)
    if (result.error) { setError('Não foi possível atualizar o cadastro: ' + result.error.message); return }
    setMembers(old => old.map(m => m.user_id === member.user_id ? { ...m, name: profileName.trim(), phone: profilePhone.trim() } : m))
    setMessage('Dados do usuário atualizados no Supabase.')
  }
  async function changePassword() {
    if (!member || member.user_id !== currentUserId) return
    if (password.length < 8 || password !== passwordConfirm) { setError('Use pelo menos 8 caracteres e confirme a mesma senha.'); return }
    setPasswordSaving(true); setError(''); setMessage('')
    const { error: authError } = await supabase.auth.updateUser({ password })
    setPasswordSaving(false)
    if (authError) { setError('Não foi possível atualizar a senha: ' + authError.message); return }
    setPassword(''); setPasswordConfirm(''); setMessage('Senha atualizada com segurança pelo Supabase Auth.')
  }

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true); setError('')
      const result = await supabase.from('organization_members')
        .select('user_id,role,active').eq('organization_id', orgId).order('role')
      if (!active) return
      if (result.error) { setError('Erro ao carregar equipe: ' + result.error.message); setLoading(false); return }
      const base = result.data || []
      // profiles is fetched separately to avoid requiring a PostgREST FK relationship.
      const profileResult = await supabase.from('profiles').select('id,full_name,phone').in('id', base.map(m => m.user_id))
      if (!active) return
      const profiles = new Map((profileResult.data || []).map(p => [p.id, p]))
      const list = base.map(m => ({ ...m, name: profiles.get(m.user_id)?.full_name || 'Usuário sem nome', phone: profiles.get(m.user_id)?.phone || '' }))
      setMembers(list)
      setSelected(old => list.some(m => m.user_id === old) ? old : list[0]?.user_id || '')
      if (profileResult.error) setError('Vínculos carregados, mas os nomes não puderam ser consultados: ' + profileResult.error.message)
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [orgId])

  useEffect(() => {
    if (!selected) { setRows({}); return }
    let active = true
    setLoadingPermissions(true); setDirty(false); setMessage('')
    void supabase.from('user_permissions').select('module,can_view,can_create,can_edit,can_delete')
      .eq('organization_id', orgId).eq('user_id', selected).then(result => {
        if (!active) return
        if (result.error) setError('Erro ao consultar permissões: ' + result.error.message)
        else setRows(Object.fromEntries((result.data || []).map(p => [p.module, {
          can_view: p.can_view, can_create: p.can_create, can_edit: p.can_edit, can_delete: p.can_delete,
        }])))
        setLoadingPermissions(false)
      })
    return () => { active = false }
  }, [orgId, selected])

  function change(module: string, action: Action, value: boolean) {
    setDirty(true); setMessage('')
    setRows(old => {
      const next = { ...(old[module] || empty()), [action]: value }
      if (value && action !== 'can_view') next.can_view = true
      if (!value && action === 'can_view') return { ...old, [module]: empty() }
      return { ...old, [module]: next }
    })
  }
  function setModule(module: string, value: boolean) {
    setDirty(true); setMessage(''); setRows(old => ({ ...old, [module]: value ? all() : empty() }))
  }
  function setEvery(value: boolean) {
    setDirty(true); setMessage('')
    setRows(Object.fromEntries(moduleList.map(([key]) => [key, value ? all() : empty()])))
  }
  async function save() {
    if (!member || isAdmin(member) || !member.active || !dirty || loadingPermissions) return
    setSaving(true); setError(''); setMessage('')
    const payload = moduleList.map(([module]) => ({
      organization_id: orgId, user_id: member.user_id, module,
      ...(rows[module] || empty()), updated_at: new Date().toISOString(),
    }))
    const result = await supabase.from('user_permissions').upsert(payload, { onConflict: 'organization_id,user_id,module' })
    setSaving(false)
    if (result.error) setError('Não foi possível salvar as permissões: ' + result.error.message)
    else { setDirty(false); setMessage('Permissões salvas no Supabase. O funcionário deve entrar novamente para atualizar os menus.') }
  }
  function selectMember(id: string) {
    if (dirty && !window.confirm('Existem permissões não salvas. Deseja descartar as alterações?')) return
    setSelected(id); setTab('dados'); setError(''); setMessage('')
  }
  return <div className="hr-page">
    <div className="hr-header"><div><div className="eyebrow">RECURSOS HUMANOS / EQUIPE</div><h1>Funcionários e usuários</h1><p>Cadastros vinculados à empresa e controle de acesso por módulo.</p></div><UsersRound size={28}/></div>
    <div className="hr-stats">
      <div className="panel"><small>Usuários vinculados</small><strong>{members.length}</strong></div>
      <div className="panel"><small>Ativos</small><strong>{members.filter(m => m.active).length}</strong></div>
      <div className="panel"><small>Administradores</small><strong>{members.filter(isAdmin).length}</strong></div>
    </div>
    {error && <div className="notice" role="alert">{error}</div>}
    {message && <div className="notice" role="status">{message}</div>}
    <div className="hr-layout">
      <section className="panel hr-list"><div className="hr-section-title"><h3>Equipe</h3><span>{loading ? 'Carregando…' : `${members.length} usuário(s)`}</span></div>
        {!loading && !members.length && <p>Nenhum vínculo de usuário encontrado nesta empresa.</p>}
        {members.map(m => <button type="button" key={m.user_id} className={`hr-person ${selected === m.user_id ? 'selected' : ''}`} onClick={() => selectMember(m.user_id)}>
          <span className="hr-avatar"><UserRound size={20}/></span><span className="hr-person-details"><strong>{m.name}</strong><small>{m.role === 'owner' ? 'Proprietário' : m.role === 'admin' ? 'Administrador' : 'Funcionário'} · {m.active ? 'Ativo' : 'Inativo'}</small></span>
          {isAdmin(m) && <ShieldCheck size={17}/>}</button>)}
      </section>
      <section className="panel hr-details">
        {!member ? <p>Selecione um usuário para consultar os dados e as permissões.</p> : <>
          <div className="hr-profile"><span className="hr-avatar large"><UserRound size={25}/></span><div><h2>{member.name}</h2><p>{member.role === 'owner' ? 'Proprietário' : member.role === 'admin' ? 'Administrador' : 'Funcionário'} · {member.active ? 'Acesso ativo' : 'Acesso inativo'}</p></div></div>
          <div className="hr-tabs"><button type="button" className={tab === 'dados' ? 'active' : ''} onClick={() => setTab('dados')}>Dados e vínculo</button><button type="button" className={tab === 'permissoes' ? 'active' : ''} onClick={() => setTab('permissoes')}>Permissões</button><button type="button" className={tab === 'seguranca' ? 'active' : ''} onClick={() => setTab('seguranca')}>Segurança</button></div>
          {tab === 'dados' ? <div className="hr-info">
            <div><label htmlFor="hr-name"><small>Nome completo</small></label><input id="hr-name" value={profileName} maxLength={150} onChange={e => setProfileName(e.target.value)} placeholder="Nome completo" /></div>
            <div><label htmlFor="hr-phone"><small>Telefone</small></label><input id="hr-phone" value={profilePhone} maxLength={30} onChange={e => setProfilePhone(e.target.value)} placeholder="Telefone" /></div>
            <div><small>Perfil</small><strong>{member.role === 'owner' ? 'Proprietário' : member.role === 'admin' ? 'Administrador' : member.role}</strong></div>
            <div><small>Situação</small><strong>{member.active ? 'Ativo' : 'Inativo'}</strong></div>
            <div><small>ID do usuário</small><code>{member.user_id}</code></div>
            <div><button type="button" className="primary-btn" disabled={profileSaving || !profileName.trim() || (profileName.trim() === member.name && profilePhone.trim() === member.phone)} onClick={() => void saveProfile()}><Save size={16}/>{profileSaving ? 'Salvando…' : 'Salvar dados'}</button></div>
            <div className="notice">Alterações de nome e telefone são salvas no Supabase. Acesso e perfil administrativo permanecem protegidos.</div>
          </div> : tab === 'seguranca' ? <div className="hr-info">
            <div><small>Segurança da conta</small><strong>{member.user_id === currentUserId ? 'Minha conta' : 'Conta de outro usuário'}</strong></div>
            {member.user_id === currentUserId ? <>
              <div><label htmlFor="hr-password"><small>Nova senha (mínimo 8 caracteres)</small></label><input id="hr-password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}/></div>
              <div><label htmlFor="hr-password-confirm"><small>Confirmar nova senha</small></label><input id="hr-password-confirm" type="password" autoComplete="new-password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)}/></div>
              <div><button type="button" className="primary-btn" disabled={passwordSaving || password.length < 8 || password !== passwordConfirm} onClick={() => void changePassword()}><KeyRound size={16}/>{passwordSaving ? 'Alterando…' : 'Alterar minha senha'}</button></div>
            </> : <div className="notice">Por segurança, não é possível definir a senha de outro usuário diretamente no navegador. A recuperação de acesso exigirá um convite ou link de redefinição enviado por um fluxo seguro.</div>}
          </div> : <>
            {isAdmin(member) ? <div className="notice"><ShieldCheck size={17}/> Administradores têm acesso integral. Suas permissões não são editadas individualmente.</div> : !member.active ? <div className="notice">Este funcionário está inativo. Ative seu vínculo por um fluxo administrativo seguro antes de editar permissões.</div> : <>
              <div className="hr-permission-heading"><div><h3>Permissões por módulo</h3><p>Selecione as ações individualmente ou libere um módulo inteiro.</p></div><div className="hr-bulk"><button type="button" className="outline-btn" onClick={() => setEvery(true)}><CheckCheck size={15}/> Ativar tudo</button><button type="button" className="outline-btn" onClick={() => setEvery(false)}><RefreshCw size={15}/> Desmarcar tudo</button></div></div>
              {loadingPermissions ? <p>Carregando permissões…</p> : <div className="table-scroll"><table className="hr-permissions"><thead><tr><th>Módulo</th>{actions.map(a => <th key={a.key}>{a.label}</th>)}<th>Tudo</th></tr></thead><tbody>
                {moduleList.map(([key,label]) => { const permission = rows[key] || empty(); return <tr key={key}><td>{label}</td>{actions.map(a => <td key={a.key}><input type="checkbox" aria-label={`${label}: ${a.label}`} checked={permission[a.key]} onChange={e => change(key,a.key,e.target.checked)}/></td>)}<td><input type="checkbox" aria-label={`${label}: Todas as permissões`} checked={actions.every(a => permission[a.key])} onChange={e => setModule(key,e.target.checked)}/></td></tr> })}
              </tbody></table></div>}
              <div className="hr-footer"><small>{moduleList.reduce((n,[key]) => n + actions.filter(a => rows[key]?.[a.key]).length,0)} de {moduleList.length * actions.length} permissões selecionadas{dirty ? ' · Alterações não salvas' : ''}</small><button type="button" className="primary-btn" disabled={saving || loadingPermissions || !dirty} onClick={() => void save()}><Save size={16}/>{saving ? 'Salvando…' : 'Salvar permissões'}</button></div>
            </>}
          </>}
        </>}
      </section>
    </div>
  </div>
}
