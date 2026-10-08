import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowDownRight, ArrowUpRight, BadgeCheck, BarChart3, Boxes, CalendarDays, CarFront, ChevronDown, CircleDollarSign, ClipboardList, Download, Flame, Gauge, LayoutDashboard, Menu, Package, Plus, Search, Settings2, ShoppingCart, Target, Trash2, Truck, Users, Wallet, Wrench, X } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import './App.css'
import { supabase } from './lib/supabase'

type RecordItem = { id: string; [key: string]: string | number }
type Collection = Record<string, RecordItem[]>
const storageKey = 'auto-performance-piloto-v2'
const initial: Collection = { customers: [], vehicles: [], suppliers: [], products: [], services: [], quotes: [], work_orders: [], sales: [], expenses: [], cash_entries: [], goals: [] }
const modules = [
  { key: 'dashboard', label: 'Visão geral', icon: LayoutDashboard, group: 'PAINEL' },
  { key: 'customers', label: 'Clientes', icon: Users, group: 'GESTÃO' },
  { key: 'vehicles', label: 'Veículos', icon: CarFront, group: 'GESTÃO' },
  { key: 'products', label: 'Produtos e estoque', icon: Boxes, group: 'GESTÃO' },
  { key: 'services', label: 'Serviços', icon: Wrench, group: 'GESTÃO' },
  { key: 'suppliers', label: 'Fornecedores', icon: Truck, group: 'GESTÃO' },
  { key: 'quotes', label: 'Orçamentos', icon: ClipboardList, group: 'OPERAÇÃO' },
  { key: 'work_orders', label: 'Ordens de serviço', icon: CalendarDays, group: 'OPERAÇÃO' },
  { key: 'sales', label: 'Vendas', icon: ShoppingCart, group: 'OPERAÇÃO' },
  { key: 'expenses', label: 'Despesas', icon: ArrowDownRight, group: 'FINANCEIRO' },
  { key: 'cash_entries', label: 'Movimentação de caixa', icon: Wallet, group: 'FINANCEIRO' },
  { key: 'goals', label: 'Metas', icon: Target, group: 'INTELIGÊNCIA' },
  { key: 'settings', label: 'Configurações', icon: Settings2, group: 'SISTEMA' },
] as const
const config: Record<string, { title: string; subtitle: string; fields: { key: string; label: string; type?: string; required?: boolean }[] }> = {
  customers: { title: 'Clientes', subtitle: 'Carteira de clientes e relacionamento', fields: [{ key: 'name', label: 'Nome completo', required: true }, { key: 'phone', label: 'Telefone' }, { key: 'email', label: 'E-mail', type: 'email' }, { key: 'document', label: 'CPF / CNPJ' }] },
  vehicles: { title: 'Veículos', subtitle: 'Histórico e identificação dos veículos', fields: [{ key: 'plate', label: 'Placa', required: true }, { key: 'brand', label: 'Marca' }, { key: 'model', label: 'Modelo', required: true }, { key: 'model_year', label: 'Ano do modelo', type: 'number' }, { key: 'color', label: 'Cor' }, { key: 'customer_id', label: 'Cliente / proprietário' }, { key: 'notes', label: 'Observações' }] },
  products: { title: 'Produtos e estoque', subtitle: 'Catálogo, preço, custo e quantidade disponível', fields: [{ key: 'name', label: 'Produto', required: true }, { key: 'sku', label: 'Código / SKU' }, { key: 'category', label: 'Categoria' }, { key: 'price', label: 'Preço de venda (R$)', type: 'number' }, { key: 'cost', label: 'Custo (R$)', type: 'number' }, { key: 'quantity', label: 'Quantidade', type: 'number' }, { key: 'minimum', label: 'Estoque mínimo', type: 'number' }] },
  services: { title: 'Serviços', subtitle: 'Instalações, mão de obra e catálogo de serviços', fields: [{ key: 'name', label: 'Serviço', required: true }, { key: 'category', label: 'Categoria' }, { key: 'price', label: 'Valor (R$)', type: 'number' }, { key: 'duration', label: 'Duração estimada (min)', type: 'number' }] },
  suppliers: { title: 'Fornecedores', subtitle: 'Parceiros e fornecedores cadastrados', fields: [{ key: 'name', label: 'Razão social / nome', required: true }, { key: 'phone', label: 'Telefone' }, { key: 'document', label: 'CNPJ' }, { key: 'email', label: 'E-mail', type: 'email' }] },
  quotes: { title: 'Orçamentos', subtitle: 'Propostas e acompanhamento comercial', fields: [{ key: 'number', label: 'Número', required: true }, { key: 'customer', label: 'Cliente', required: true }, { key: 'description', label: 'Descrição' }, { key: 'amount', label: 'Valor total (R$)', type: 'number' }, { key: 'status', label: 'Situação (Aberto / Aprovado / Recusado)' }] },
  work_orders: { title: 'Ordens de serviço', subtitle: 'Controle de execução e entrega', fields: [{ key: 'number', label: 'Número da OS', required: true }, { key: 'customer', label: 'Cliente', required: true }, { key: 'vehicle', label: 'Veículo / placa' }, { key: 'description', label: 'Serviço solicitado' }, { key: 'amount', label: 'Valor (R$)', type: 'number' }, { key: 'status', label: 'Situação (Aberta / Em andamento / Concluída)' }] },
  sales: { title: 'Vendas', subtitle: 'Lançamentos de vendas e receitas', fields: [{ key: 'description', label: 'Descrição da venda', required: true }, { key: 'customer', label: 'Cliente' }, { key: 'amount', label: 'Valor recebido (R$)', type: 'number', required: true }, { key: 'cost', label: 'Custo da venda (R$)', type: 'number' }, { key: 'method', label: 'Pagamento (Pix / Cartão / Dinheiro)' }, { key: 'date', label: 'Data', type: 'date', required: true }] },
  expenses: { title: 'Despesas', subtitle: 'Custos operacionais e saídas financeiras', fields: [{ key: 'description', label: 'Descrição', required: true }, { key: 'category', label: 'Categoria' }, { key: 'amount', label: 'Valor (R$)', type: 'number', required: true }, { key: 'date', label: 'Data', type: 'date', required: true }] },
  cash_entries: { title: 'Movimentação de caixa', subtitle: 'Entradas e saídas avulsas do caixa', fields: [{ key: 'description', label: 'Descrição', required: true }, { key: 'kind', label: 'Tipo (Entrada / Saída)', required: true }, { key: 'amount', label: 'Valor (R$)', type: 'number', required: true }, { key: 'date', label: 'Data', type: 'date', required: true }] },
  goals: { title: 'Metas', subtitle: 'Acompanhamento de objetivos da loja', fields: [{ key: 'name', label: 'Nome da meta', required: true }, { key: 'amount', label: 'Meta em R$', type: 'number', required: true }, { key: 'month', label: 'Mês de referência (AAAA-MM)', required: true }] },
}
const currency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const number = (v: string | number | undefined) => Number(v || 0)
const today = () => new Date().toLocaleDateString('en-CA')
const uid = () => crypto.randomUUID()
function readStore(): Collection { try { const v = JSON.parse(localStorage.getItem(storageKey) || '{}'); return { ...initial, ...v, customers: [], vehicles: [] } } catch { return initial } }
function App() {
  const [data, setData] = useState<Collection>(readStore)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [customerLoading, setCustomerLoading] = useState(true)
  const [customerError, setCustomerError] = useState('')
  const [vehicleLoading, setVehicleLoading] = useState(true)
  const [vehicleError, setVehicleError] = useState('')
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState('dashboard')
  const [search, setSearch] = useState('')
  const [sidebar, setSidebar] = useState(false)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [period, setPeriod] = useState('month')
  const [shopName, setShopName] = useState(() => localStorage.getItem('auto-performance-shop') || 'Aldeir Som Automotivo')
  useEffect(() => {
    const { customers: _customers, vehicles: _vehicles, ...localData } = data
    void _customers
    void _vehicles
    localStorage.setItem(storageKey, JSON.stringify(localData))
  }, [data])

  useEffect(() => {
    let active = true
    async function loadCustomers() {
      setCustomerLoading(true)
      setCustomerError('')
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (!active) return
      if (authError || !auth.user) {
        setCustomerError('Sessão inválida. Entre novamente na sua conta.')
        setVehicleError('Sessão inválida. Entre novamente na sua conta.')
        setVehicleLoading(false)
        setCustomerLoading(false)
        return
      }
      const { data: membership, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', auth.user.id)
        .limit(1)
        .maybeSingle()
      if (!active) return
      if (memberError || !membership?.organization_id) {
        setCustomerError('Não foi possível identificar sua empresa: ' + (memberError?.message || 'vínculo não encontrado'))
        setVehicleError('Não foi possível identificar sua empresa.')
        setVehicleLoading(false)
        setCustomerLoading(false)
        return
      }
      setOrgId(membership.organization_id)
      const { data: rows, error } = await supabase
        .from('customers')
        .select('id,name,phone,email,document,notes,created_at')
        .eq('organization_id', membership.organization_id)
        .order('created_at', { ascending: false })
      if (!active) return
      if (error) setCustomerError('Erro ao carregar clientes: ' + error.message)
      else setData(old => ({ ...old, customers: (rows || []).map(r => ({
        id: r.id, name: r.name || '', phone: r.phone || '', email: r.email || '',
        document: r.document || '', notes: r.notes || '', created_at: r.created_at || ''
      })) }))
      setCustomerLoading(false)
      const { data: vehicles, error: vehiclesError } = await supabase.from('vehicles')
        .select('id,customer_id,plate,brand,model,model_year,color,notes,created_at')
        .eq('organization_id', membership.organization_id)
        .order('created_at', { ascending: false })
      if (!active) return
      if (vehiclesError) setVehicleError('Erro ao carregar veículos: ' + vehiclesError.message)
      else setData(old => ({ ...old, vehicles: (vehicles || []).map(v => ({
        id: v.id, customer_id: v.customer_id || '', plate: v.plate || '',
        brand: v.brand || '', model: v.model || '', model_year: v.model_year || '',
        color: v.color || '', notes: v.notes || '', created_at: v.created_at || ''
      })) }))
      setVehicleLoading(false)
    }
    void loadCustomers()
    return () => { active = false }
  }, [])
  useEffect(() => { localStorage.setItem('auto-performance-shop', shopName) }, [shopName])
  const sales = data.sales || []
  const expenses = data.expenses || []
  const filteredSales = useMemo(() => sales.filter(x => {
    const d = String(x.date || ''); const now = today()
    return period === 'all' || (period === 'today' ? d === now : period === 'month' ? d.startsWith(now.slice(0, 7)) : d.slice(0, 4) === now.slice(0, 4))
  }), [sales, period])
  const filteredExpenses = useMemo(() => expenses.filter(x => {
    const d = String(x.date || ''); const now = today()
    return period === 'all' || (period === 'today' ? d === now : period === 'month' ? d.startsWith(now.slice(0, 7)) : d.slice(0, 4) === now.slice(0, 4))
  }), [expenses, period])
  const revenue = filteredSales.reduce((s, x) => s + number(x.amount), 0)
  const cost = filteredSales.reduce((s, x) => s + number(x.cost), 0)
  const spent = filteredExpenses.reduce((s, x) => s + number(x.amount), 0)
  const profit = revenue - cost - spent
  const monthlyGoal = (data.goals || []).filter(x => String(x.month) === today().slice(0, 7)).reduce((s, x) => s + number(x.amount), 0)
  const goalPct = monthlyGoal > 0 ? Math.min(100, revenue / monthlyGoal * 100) : 0
  const chartData = useMemo(() => {
    const dates = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toLocaleDateString('en-CA') })
    return dates.map(d => ({ name: d.slice(8), vendas: sales.filter(x => x.date === d).reduce((s, x) => s + number(x.amount), 0), despesas: expenses.filter(x => x.date === d).reduce((s, x) => s + number(x.amount), 0) }))
  }, [sales, expenses])
  const title = page === 'dashboard' ? 'Visão geral' : page === 'settings' ? 'Configurações' : config[page]?.title
  function navigate(p: string) { setPage(p); setSearch(''); setSidebar(false) }
  function openNew() { setEditing(null); setForm(page === 'sales' || page === 'expenses' || page === 'cash_entries' ? { date: today() } : page === 'goals' ? { month: today().slice(0, 7) } : {}); setModal(true) }
  function openEdit(row: RecordItem) { setEditing(row.id); setForm(Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)]))); setModal(true) }
  async function save() {
    const fields = config[page]?.fields || []
    if (fields.some(f => f.required && !String(form[f.key] || '').trim())) { alert('Preencha os campos obrigatórios.'); return }
    if (page === 'customers') {
      if (!orgId || customerLoading) { alert('Aguarde a conexão com a empresa.'); return }
      setSaving(true)
      const payload = {
        name: form.name.trim(), phone: form.phone?.trim() || null,
        email: form.email?.trim() || null, document: form.document?.trim() || null,
      }
      const query = editing
        ? supabase.from('customers').update(payload).eq('id', editing).eq('organization_id', orgId)
        : supabase.from('customers').insert({ ...payload, organization_id: orgId })
      const { data: saved, error } = await query.select('id,name,phone,email,document,notes,created_at').single()
      setSaving(false)
      if (error || !saved) { alert('Não foi possível salvar o cliente: ' + (error?.message || 'sem retorno do banco')); return }
      const row: RecordItem = { id: saved.id, name: saved.name, phone: saved.phone || '', email: saved.email || '', document: saved.document || '', notes: saved.notes || '', created_at: saved.created_at || '' }
      setData(old => ({ ...old, customers: editing ? old.customers.map(x => x.id === editing ? row : x) : [row, ...old.customers] }))
      setModal(false)
      return
    }
    if (page === 'vehicles') {
      if (!orgId || vehicleLoading || vehicleError) { alert('A conexão com os veículos não está disponível.'); return }
      if (form.model_year && (!Number.isInteger(Number(form.model_year)) || Number(form.model_year) < 1900 || Number(form.model_year) > 2200)) { alert('Informe um ano válido.'); return }
      if (form.customer_id && !data.customers.some(c => c.id === form.customer_id)) { alert('Selecione um cliente válido.'); return }
      setSaving(true)
      const payload = {
        plate: form.plate?.trim().toUpperCase() || null, brand: form.brand?.trim() || null,
        model: form.model?.trim() || null, model_year: form.model_year ? Number(form.model_year) : null,
        color: form.color?.trim() || null, customer_id: form.customer_id || null,
        notes: form.notes?.trim() || null,
      }
      const query = editing
        ? supabase.from('vehicles').update(payload).eq('id', editing).eq('organization_id', orgId)
        : supabase.from('vehicles').insert({ ...payload, organization_id: orgId })
      const { data: saved, error } = await query.select('id,customer_id,plate,brand,model,model_year,color,notes,created_at').single()
      setSaving(false)
      if (error || !saved) { alert('Não foi possível salvar o veículo: ' + (error?.message || 'sem retorno do banco')); return }
      const row: RecordItem = { id: saved.id, customer_id: saved.customer_id || '', plate: saved.plate || '', brand: saved.brand || '', model: saved.model || '', model_year: saved.model_year || '', color: saved.color || '', notes: saved.notes || '', created_at: saved.created_at || '' }
      setData(old => ({ ...old, vehicles: editing ? old.vehicles.map(v => v.id === editing ? row : v) : [row, ...old.vehicles] }))
      setModal(false)
      return
    }
    const row: RecordItem = { ...form, id: editing || uid(), created_at: editing ? form.created_at || today() : today() }
    setData(old => ({ ...old, [page]: editing ? (old[page] || []).map(x => x.id === editing ? row : x) : [row, ...(old[page] || [])] }))
    setModal(false)
  }

  async function remove(id: string) {
    if (!confirm('Deseja realmente excluir este registro?')) return
    if (page === 'customers') {
      if (!orgId || customerLoading) { alert('Conexão com a empresa indisponível.'); return }
      const { data: deleted, error } = await supabase.from('customers')
        .delete().eq('id', id).eq('organization_id', orgId).select('id')
      if (error || !deleted?.length) { alert('Não foi possível excluir: ' + (error?.message || 'sem permissão ou registro não encontrado')); return }
      setData(old => ({ ...old, customers: old.customers.filter(x => x.id !== id) }))
      return
    }
    if (page === 'vehicles') {
      if (!orgId || vehicleLoading || vehicleError) { alert('Conexão com a empresa indisponível.'); return }
      const { data: deleted, error } = await supabase.from('vehicles')
        .delete().eq('id', id).eq('organization_id', orgId).select('id')
      if (error || !deleted?.length) { alert('Não foi possível excluir o veículo: ' + (error?.message || 'sem permissão ou registro não encontrado')); return }
      setData(old => ({ ...old, vehicles: old.vehicles.filter(v => v.id !== id) }))
      return
    }
    setData(old => ({ ...old, [page]: old[page].filter(x => x.id !== id) }))
  }

  function exportCsv() {
    const fields = config[page]?.fields || []; const rows = data[page] || []
    const esc = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`
    const csv = '\ufeff' + [fields.map(f => esc(f.label)).join(';'), ...rows.map(r => fields.map(f => esc(r[f.key])).join(';'))].join('\r\n')
    const a = document.createElement('a'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.href = url; a.download = `auto-performance-${page}.csv`; a.click(); URL.revokeObjectURL(url)
  }
  const visibleRows = (data[page] || []).filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase())))
  return <div className="app-shell">
    {sidebar && <div className="mobile-overlay" onClick={() => setSidebar(false)} />}
    <aside className={`sidebar ${sidebar ? 'open' : ''}`}>
      <div className="brand"><div className="brand-symbol"><Gauge size={24}/></div><div><strong>AUTO<span>PERFORMANCE</span></strong><small>GESTÃO INTELIGENTE</small></div><button className="mobile-close" onClick={() => setSidebar(false)}><X size={20}/></button></div>
      <div className="tenant"><div className="tenant-avatar">AP</div><div className="tenant-text"><strong>{shopName}</strong><small>Ambiente piloto <ChevronDown size={12}/></small></div></div>
      <nav>{['PAINEL', 'GESTÃO', 'OPERAÇÃO', 'FINANCEIRO', 'INTELIGÊNCIA', 'SISTEMA'].map(g => <div className="nav-group" key={g}><div className="nav-heading">{g}</div>{modules.filter(m => m.group === g).map(m => { const Icon = m.icon; return <button key={m.key} className={`nav-item ${page === m.key ? 'active' : ''}`} onClick={() => navigate(m.key)}><Icon size={18}/><span>{m.label}</span>{page === m.key && <span className="nav-dot"/>}</button> })}</div>)}</nav>
      <div className="sidebar-bottom"><div className="system-pill"><span className="status-dot"/> {customerLoading ? 'Conectando clientes…' : customerError ? 'Erro na conexão de clientes' : 'Clientes: Supabase · Outros: local'}</div><small>Auto Performance · Versão 2.0</small></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="top-left"><button className="icon-btn menu-btn" onClick={() => setSidebar(true)} aria-label="Abrir menu"><Menu size={22}/></button><div className="breadcrumb">Workspace <span>/</span> <strong>{title}</strong></div></div><div className="top-right"><span className="date-chip"><CalendarDays size={15}/> {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span><div className="user-avatar">SG</div></div></header>
      <main className="content">
        {page === 'dashboard' ? <>
          <div className="page-heading"><div><div className="eyebrow"><Activity size={14}/> CENTRAL DE CONTROLE</div><h1>Visão geral <span className="wave">✦</span></h1><p>Acompanhe o desempenho e tome decisões com clareza.</p></div><div className="heading-actions"><select className="select" value={period} onChange={e => setPeriod(e.target.value)}><option value="today">Hoje</option><option value="month">Este mês</option><option value="year">Este ano</option><option value="all">Todo o período</option></select><button className="primary-btn" onClick={() => navigate('sales')}><Plus size={17}/> Nova venda</button></div></div>
          <div className="notice"><BadgeCheck size={17}/> Os indicadores financeiros ainda usam registros locais. O módulo Clientes já está conectado ao Supabase.</div>
          <div className="kpi-grid">
            <Kpi icon={CircleDollarSign} label="Faturamento" value={currency(revenue)} foot="Vendas no período" tone="blue" />
            <Kpi icon={ArrowUpRight} label="Lucro estimado" value={currency(profit)} foot="Receita − custos − despesas" tone="green" />
            <Kpi icon={ShoppingCart} label="Vendas realizadas" value={String(filteredSales.length)} foot="Registros no período" tone="purple" />
            <Kpi icon={BarChart3} label="Ticket médio" value={currency(filteredSales.length ? revenue / filteredSales.length : 0)} foot="Valor médio por venda" tone="orange" />
          </div>
          <div className="dashboard-grid"><section className="panel chart-panel"><div className="panel-head"><div><h3>Desempenho financeiro</h3><p>Receitas e despesas nos últimos 7 dias</p></div><span className="legend"><i/> Vendas <i className="purple-dot"/> Despesas</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4f8bff" stopOpacity={.3}/><stop offset="100%" stopColor="#4f8bff" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#242d43" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="name" stroke="#7885a2" tickLine={false} axisLine={false}/><YAxis stroke="#7885a2" tickLine={false} axisLine={false} width={48}/><Tooltip contentStyle={{background:'#172037',border:'1px solid #34415d',borderRadius:12}} formatter={(v) => currency(Number(v))}/><Area type="monotone" dataKey="vendas" stroke="#5c94ff" strokeWidth={3} fill="url(#blueGradient)"/><Area type="monotone" dataKey="despesas" stroke="#a87cff" strokeWidth={2} fill="transparent"/></AreaChart></ResponsiveContainer></div></section>
            <section className="panel goal-panel"><div className="panel-head"><div><h3>Meta de faturamento</h3><p>Objetivo do mês atual</p></div><Target size={19} className="muted-icon"/></div><div className="goal-ring" style={{background:`conic-gradient(#5b8cff ${goalPct}%, #27314a ${goalPct}% 100%)`}}><div><strong>{goalPct.toFixed(0)}%</strong><small>atingido</small></div></div><div className="goal-values"><span>{currency(revenue)}</span><span>{monthlyGoal ? currency(monthlyGoal) : 'Meta não definida'}</span></div><div className="progress-track"><div style={{width:`${goalPct}%`}}/></div><button className="text-action" onClick={() => navigate('goals')}>{monthlyGoal ? 'Gerenciar metas' : 'Definir primeira meta'} →</button></section></div>
          <div className="bottom-grid"><section className="panel"><div className="panel-head"><div><h3>Atividade recente</h3><p>Últimas vendas cadastradas</p></div><button className="text-action" onClick={() => navigate('sales')}>Ver todas →</button></div>{sales.length ? <div className="activity-list">{sales.slice(0,5).map(s => <div className="activity-item" key={s.id}><span className="activity-icon"><ShoppingCart size={17}/></span><div><strong>{s.description}</strong><small>{s.customer || 'Venda avulsa'} · {s.date || 'Sem data'}</small></div><b>{currency(number(s.amount))}</b></div>)}</div> : <Empty text="As vendas cadastradas aparecerão aqui."/>}</section>
            <section className="panel"><div className="panel-head"><div><h3>Pulso da loja <Flame size={18} className="flame"/></h3><p>Indicadores operacionais</p></div></div><div className="pulse-list"><Pulse icon={Package} label="Produtos cadastrados" value={String(data.products.length)}/><Pulse icon={ArrowDownRight} label="Produtos em estoque baixo" value={String(data.products.filter(x => number(x.quantity) <= number(x.minimum)).length)}/><Pulse icon={ClipboardList} label="Orçamentos abertos" value={String(data.quotes.filter(x => String(x.status || 'Aberto').toLowerCase().includes('abert')).length)}/><Pulse icon={Wrench} label="Ordens em andamento" value={String(data.work_orders.filter(x => !String(x.status).toLowerCase().includes('conclu')).length)}/></div></section></div>
        </> : page === 'settings' ? <><div className="page-heading"><div><div className="eyebrow">PREFERÊNCIAS</div><h1>Configurações</h1><p>Personalize a identificação deste ambiente local.</p></div></div><div className="panel settings-panel"><label>Nome da loja<input value={shopName} onChange={e => setShopName(e.target.value)} placeholder="Nome da empresa"/></label><p>O nome é salvo automaticamente neste navegador. Autenticação, equipe, permissões e configuração do Supabase serão habilitadas na integração com o backend.</p><div className="notice"><BadgeCheck size={17}/> Não use esta prévia com dados reais ou sensíveis antes da autenticação e validação das políticas RLS.</div></div></> : <>
          <div className="page-heading"><div><div className="eyebrow">AUTO PERFORMANCE / {page.toUpperCase()}</div><h1>{config[page].title}</h1><p>{config[page].subtitle}</p></div><div className="heading-actions"><button className="outline-btn" onClick={exportCsv}><Download size={17}/> Exportar CSV</button><button className="primary-btn" onClick={openNew} disabled={(page === 'customers' && (customerLoading || !!customerError)) || (page === 'vehicles' && (vehicleLoading || !!vehicleError))}><Plus size={17}/> Novo registro</button></div></div>
          <div className="module-stats"><div className="stat-block"><small>Total de registros</small><strong>{data[page]?.length || 0}</strong></div><div className="stat-block"><small>Resultado da busca</small><strong>{visibleRows.length}</strong></div><div className="stat-block"><small>Armazenamento</small><strong className="stat-local">{page === 'customers' || page === 'vehicles' ? 'Supabase' : 'Local'}</strong></div></div>
          {page === 'customers' && (customerLoading || customerError) && <div className="notice">{customerLoading ? 'Carregando clientes do Supabase…' : customerError}</div>}
          {page === 'vehicles' && (vehicleLoading || vehicleError) && <div className="notice">{vehicleLoading ? 'Carregando veículos do Supabase…' : vehicleError}</div>}
          <section className="panel table-panel"><div className="table-tools"><h3>Registros</h3><div className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar registros..."/></div></div><div className="table-scroll"><table><thead><tr>{config[page].fields.slice(0,5).map(f => <th key={f.key}>{f.label}</th>)}<th>Ações</th></tr></thead><tbody>{visibleRows.map(r => <tr key={r.id}>{config[page].fields.slice(0,5).map(f => <td key={f.key}>{['amount','price','cost'].includes(f.key) ? currency(number(r[f.key])) : page === 'vehicles' && f.key === 'customer_id' ? (data.customers.find(c => c.id === r.customer_id)?.name || (r.customer_id ? 'Cliente não encontrado' : 'Sem proprietário')) : String(r[f.key] ?? '—')}</td>)}<td><div className="table-actions"><button onClick={() => openEdit(r)} title="Editar">Editar</button><button onClick={() => remove(r.id)} title="Excluir" className="delete-btn"><Trash2 size={16}/></button></div></td></tr>)}</tbody></table>{!visibleRows.length && <Empty text={search ? 'Nenhum registro corresponde à pesquisa.' : 'Nenhum registro cadastrado. Use “Novo registro” para começar.'}/>}</div></section>
        </>}
      </main>
    </div>
    {modal && config[page] && <div className="modal-backdrop" onMouseDown={e => { if(e.target === e.currentTarget) setModal(false) }}><div className="modal"><div className="modal-head"><div><div className="eyebrow">{editing ? 'EDITAR' : 'CADASTRAR'}</div><h2>{config[page].title}</h2></div><button className="icon-btn" onClick={() => setModal(false)} aria-label="Fechar"><X size={21}/></button></div><form onSubmit={e => { e.preventDefault(); save() }}><div className="form-grid">{config[page].fields.map(f => <label key={f.key}>{f.label}{f.required && <span className="required"> *</span>}{page === 'vehicles' && f.key === 'customer_id' ? <select className="select" value={form.customer_id || ''} onChange={e => setForm(old => ({ ...old, customer_id: e.target.value }))}><option value="">Sem proprietário</option>{data.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : <input type={f.type || 'text'} step={f.type === 'number' ? 'any' : undefined} min={f.type === 'number' ? '0' : undefined} value={form[f.key] || ''} onChange={e => setForm(old => ({ ...old, [f.key]: e.target.value }))} required={f.required}/>}</label>)}</div><div className="modal-actions"><button type="button" className="outline-btn" onClick={() => setModal(false)}>Cancelar</button><button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar'}</button></div></form></div></div>}
  </div>
}
function Kpi({icon:Icon,label,value,foot,tone}:{icon:typeof Activity;label:string;value:string;foot:string;tone:string}) { return <div className="kpi-card"><div className="kpi-top"><span>{label}</span><span className={`kpi-icon ${tone}`}><Icon size={19}/></span></div><strong>{value}</strong><small>{foot}</small></div> }
function Pulse({icon:Icon,label,value}:{icon:typeof Activity;label:string;value:string}) { return <div className="pulse-row"><span><Icon size={17}/>{label}</span><strong>{value}</strong></div> }
function Empty({text}:{text:string}) { return <div className="empty-state"><Boxes size={30}/><strong>Sem dados por enquanto</strong><p>{text}</p></div> }
export default App
