import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Action = 'can_view' | 'can_create' | 'can_edit' | 'can_delete'
type Permission = Record<Action, boolean>
type Member = { user_id: string; role: string; active: boolean }
const modules = [
  ['customers', 'Clientes'], ['vehicles', 'Veículos'], ['products', 'Produtos'],
  ['stock', 'Estoque / movimentações'], ['services', 'Serviços'], ['suppliers', 'Fornecedores'],
  ['quotes', 'Orçamentos'], ['work_orders', 'Ordens de serviço'], ['sales', 'Vendas'],
  ['financial', 'Financeiro (despesas, caixa e pagamentos)'], ['goals', 'Metas'],
] as const
const actions: { key: Action; label: string }[] = [
  { key: 'can_view', label: 'Visualizar' }, { key: 'can_create', label: 'Cadastrar' },
  { key: 'can_edit', label: 'Editar' }, { key: 'can_delete', label: 'Excluir' },
]
const empty = (): Permission => ({ can_view: false, can_create: false, can_edit: false, can_delete: false })

export default function PermissionsManager({ orgId }: { orgId: string }) {
  const [members, setMembers] = useState<Member[]>([])
  const [selected, setSelected] = useState('')
  const [rows, setRows] = useState<Record<string, Permission>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true); setError('')
      const result = await supabase.from('organization_members').select('user_id,role,active')
        .eq('organization_id', orgId).eq('active', true).order('role')
      if (!active) return
      if (result.error) setError('Não foi possível carregar os membros: ' + result.error.message)
      else {
        setMembers(result.data || [])
        setSelected(old => (result.data || []).some(m => m.user_id === old && !['owner', 'admin'].includes(m.role))
          ? old : (result.data || []).find(m => !['owner', 'admin'].includes(m.role))?.user_id || '')
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [orgId])

  useEffect(() => {
    if (!selected) { setRows({}); return }
    let active = true
    setLoading(true); setError(''); setMessage('')
    void supabase.from('user_permissions').select('module,can_view,can_create,can_edit,can_delete')
      .eq('organization_id', orgId).eq('user_id', selected).then(result => {
        if (!active) return
        if (result.error) setError('Não foi possível carregar as permissões: ' + result.error.message)
        else setRows(Object.fromEntries((result.data || []).map(p => [p.module, {
          can_view: p.can_view, can_create: p.can_create, can_edit: p.can_edit, can_delete: p.can_delete,
        }])))
        setLoading(false)
      })
    return () => { active = false }
  }, [orgId, selected])

  function change(module: string, action: Action, checked: boolean) {
    setMessage('')
    setRows(old => {
      const current = old[module] || empty()
      const next = { ...current, [action]: checked }
      if (checked && action !== 'can_view') next.can_view = true
      if (!checked && action === 'can_view') return { ...old, [module]: empty() }
      return { ...old, [module]: next }
    })
  }

  async function save() {
    if (!selected || !members.some(m => m.user_id === selected && !['owner', 'admin'].includes(m.role))) return
    setSaving(true); setError(''); setMessage('')
    const payload = modules.map(([module]) => ({
      organization_id: orgId, user_id: selected, module, ...(rows[module] || empty()), updated_at: new Date().toISOString(),
    }))
    const result = await supabase.from('user_permissions').upsert(payload, { onConflict: 'organization_id,user_id,module' })
    setSaving(false)
    if (result.error) setError('Erro ao salvar: ' + result.error.message)
    else setMessage('Permissões salvas no Supabase. O funcionário deve entrar novamente para atualizar o acesso.')
  }

  return <section className="panel" style={{ padding: 22, marginTop: 20 }}>
    <h3>Usuários e permissões</h3>
    <p>Configure o acesso de funcionários já vinculados à empresa. Administradores têm acesso integral e não são editados nesta tela.</p>
    <label style={{ display: 'block', margin: '18px 0' }}>Funcionário
      <select className="select" style={{ display: 'block', marginTop: 8, maxWidth: 480, width: '100%' }} value={selected} onChange={e => setSelected(e.target.value)}>
        <option value="">Selecione um funcionário</option>
        {members.filter(m => !['owner', 'admin'].includes(m.role)).map(m =>
          <option key={m.user_id} value={m.user_id}>{m.role} · {m.user_id}</option>)}
      </select>
    </label>
    {!loading && !members.some(m => !['owner', 'admin'].includes(m.role)) && <p>Nenhum funcionário cadastrado nesta empresa. O convite e o vínculo de novos usuários serão implementados em outra etapa.</p>}
    {error && <div className="notice" role="alert">{error}</div>}
    {message && <div className="notice" role="status">{message}</div>}
    {selected && !loading && !error && <>
      <div className="table-scroll"><table><thead><tr><th>Módulo</th>{actions.map(a => <th key={a.key}>{a.label}</th>)}</tr></thead>
        <tbody>{modules.map(([key, label]) => <tr key={key}><td>{label}</td>{actions.map(a =>
          <td key={a.key}><input type="checkbox" aria-label={`${label}: ${a.label}`} checked={Boolean(rows[key]?.[a.key])}
            onChange={e => change(key, a.key, e.target.checked)} /></td>)}</tr>)}</tbody></table></div>
      <button className="primary-btn" style={{ marginTop: 18 }} disabled={saving} onClick={() => void save()}>
        {saving ? 'Salvando…' : 'Salvar permissões'}
      </button>
    </>}
    {loading && <p>Carregando permissões…</p>}
  </section>
}
