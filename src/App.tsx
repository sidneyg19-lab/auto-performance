import { useEffect, useMemo, useState } from 'react'

import { Activity, ArrowDownRight, ArrowUpRight, BadgeCheck, BarChart3, Boxes, CalendarDays, CarFront, ChevronDown, CircleDollarSign, ClipboardList, Download, Flame, Gauge, LayoutDashboard, Menu, Package, Plus, Search, Settings2, ShoppingCart, Target, Trash2, Truck, Users, Wallet, Wrench, X } from 'lucide-react'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import './App.css'

import { supabase } from './lib/supabase'
import UserAccountMenu from './components/UserAccountMenu'
import WarrantyDialog from './components/WarrantyDialog'
import HRManager from './components/HRManager'
import InventoryPanel from './components/InventoryPanel'



type RecordItem = { id: string; [key: string]: string | number }

type Collection = Record<string, RecordItem[]>

const initial: Collection = { customers: [], vehicles: [], suppliers: [], products: [], services: [], quotes: [], work_orders: [], sales: [], expenses: [], cash_entries: [], goals: [] }

const modules = [

  { key: 'dashboard', label: 'Visão geral', icon: LayoutDashboard, group: 'PAINEL' },

  { key: 'customers', label: 'Clientes', icon: Users, group: 'GESTÃO' },

  { key: 'vehicles', label: 'Veículos', icon: CarFront, group: 'GESTÃO' },

  { key: 'products', label: 'Produtos', icon: Boxes, group: 'GESTÃO' },

  { key: 'inventory', label: 'Controle de estoque', icon: Package, group: 'GESTÃO' },

  { key: 'services', label: 'Serviços', icon: Wrench, group: 'GESTÃO' },

  { key: 'suppliers', label: 'Fornecedores', icon: Truck, group: 'GESTÃO' },

  { key: 'quotes', label: 'Orçamentos', icon: ClipboardList, group: 'OPERAÇÃO' },

  { key: 'work_orders', label: 'Ordens de serviço', icon: CalendarDays, group: 'OPERAÇÃO' },

  { key: 'sales', label: 'Vendas', icon: ShoppingCart, group: 'OPERAÇÃO' },

  { key: 'expenses', label: 'Despesas', icon: ArrowDownRight, group: 'FINANCEIRO' },

  { key: 'cash_entries', label: 'Movimentação de caixa', icon: Wallet, group: 'FINANCEIRO' },

  { key: 'goals', label: 'Metas', icon: Target, group: 'INTELIGÊNCIA' },

  { key: 'hr', label: 'Funcionários e usuários', icon: Users, group: 'RH' },

  { key: 'settings', label: 'Configurações', icon: Settings2, group: 'SISTEMA' },

] as const

const config: Record<string, { title: string; subtitle: string; fields: { key: string; label: string; type?: string; required?: boolean }[] }> = {

  customers: { title: 'Clientes', subtitle: 'Carteira de clientes e relacionamento', fields: [{ key: 'name', label: 'Nome completo', required: true }, { key: 'phone', label: 'Telefone' }, { key: 'email', label: 'E-mail', type: 'email' }, { key: 'document', label: 'CPF / CNPJ' }] },

  vehicles: { title: 'Veículos', subtitle: 'Histórico e identificação dos veículos', fields: [{ key: 'plate', label: 'Placa', required: true }, { key: 'brand', label: 'Marca' }, { key: 'model', label: 'Modelo', required: true }, { key: 'model_year', label: 'Ano do modelo', type: 'number' }, { key: 'color', label: 'Cor' }, { key: 'customer_id', label: 'Cliente / proprietário' }, { key: 'notes', label: 'Observações' }] },

  products: { title: 'Produtos', subtitle: 'Catálogo, preço, custo e quantidade disponível', fields: [{ key: 'name', label: 'Produto', required: true }, { key: 'sku', label: 'Código / SKU' }, { key: 'category', label: 'Categoria' }, { key: 'price', label: 'Preço de venda (R$)', type: 'number' }, { key: 'cost', label: 'Custo (R$)', type: 'number' }, { key: 'quantity', label: 'Quantidade', type: 'number' }, { key: 'minimum', label: 'Estoque mínimo', type: 'number' }] },

  services: { title: 'Serviços', subtitle: 'Instalações, mão de obra e catálogo de serviços', fields: [{ key: 'name', label: 'Serviço', required: true }, { key: 'category', label: 'Categoria' }, { key: 'price', label: 'Valor (R$)', type: 'number' }, { key: 'duration', label: 'Duração estimada (min)', type: 'number' }] },

  suppliers: { title: 'Fornecedores', subtitle: 'Parceiros e fornecedores cadastrados', fields: [{ key: 'name', label: 'Razão social / nome', required: true }, { key: 'phone', label: 'Telefone' }, { key: 'document', label: 'CNPJ' }, { key: 'email', label: 'E-mail', type: 'email' }] },

  quotes: { title: 'Orçamentos', subtitle: 'Propostas com cliente, veículo e um item de produto ou serviço', fields: [{ key: 'customer_id', label: 'Cliente', required: true }, { key: 'vehicle_id', label: 'Veículo' }, { key: 'item_type', label: 'Tipo de item' }, { key: 'item_id', label: 'Produto / Serviço' }, { key: 'quantity', label: 'Quantidade', type: 'number' }, { key: 'unit_price', label: 'Preço unitário (R$)', type: 'number' }, { key: 'discount', label: 'Desconto (R$)', type: 'number' }, { key: 'status', label: 'Situação' }, { key: 'notes', label: 'Observações' }] },

  work_orders: { title: 'Ordens de serviço', subtitle: 'Execução vinculada a cliente, veículo e orçamento aprovado', fields: [{ key: 'customer_id', label: 'Cliente', required: true }, { key: 'vehicle_id', label: 'Veículo' }, { key: 'quote_id', label: 'Orçamento aprovado' }, { key: 'technician', label: 'Técnico responsável' }, { key: 'status', label: 'Situação' }, { key: 'notes', label: 'Serviço solicitado / observações' }] },

  sales: { title: 'Vendas', subtitle: 'Lançamentos de vendas e receitas', fields: [{ key: 'description', label: 'Descrição da venda', required: true }, { key: 'customer_id', label: 'Cliente' }, { key: 'vehicle_id', label: 'Veículo' }, { key: 'amount', label: 'Valor recebido (R$)', type: 'number', required: true }, { key: 'cost', label: 'Custo da venda (R$)', type: 'number' }, { key: 'method', label: 'Forma de pagamento', required: true }, { key: 'installments', label: 'Parcelas', type: 'number' }, { key: 'date', label: 'Data', type: 'date', required: true }] },

  expenses: { title: 'Despesas', subtitle: 'Custos operacionais e saídas financeiras', fields: [{ key: 'description', label: 'Descrição', required: true }, { key: 'category', label: 'Categoria' }, { key: 'amount', label: 'Valor (R$)', type: 'number', required: true }, { key: 'date', label: 'Data', type: 'date', required: true }] },

  cash_entries: { title: 'Movimentação de caixa', subtitle: 'Entradas e saídas avulsas do caixa', fields: [{ key: 'description', label: 'Descrição', required: true }, { key: 'kind', label: 'Tipo (Entrada / Saída)', required: true }, { key: 'amount', label: 'Valor (R$)', type: 'number', required: true }, { key: 'date', label: 'Data', type: 'date', required: true }] },

  goals: { title: 'Metas', subtitle: 'Acompanhamento de objetivos da loja', fields: [{ key: 'name', label: 'Nome da meta', required: true }, { key: 'amount', label: 'Meta em R$', type: 'number', required: true }, { key: 'month', label: 'Mês de referência (AAAA-MM)', required: true }] },

}

const currency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

const number = (v: string | number | undefined) => Number(v || 0)
const cashTypeLabel = (kind: string) => kind === 'income' ? 'Entrada' : kind === 'expense' ? 'Saída' : kind
const isAutomaticCash = (row: RecordItem) => (Boolean(row.source_type) || Boolean(row.source_id) || (Boolean(row.category) && String(row.category) !== 'avulso') || /^Recebimento de venda/i.test(String(row.description || '')))

const today = () => new Date().toLocaleDateString('en-CA')

const uid = () => crypto.randomUUID()

function readStore(): Collection { return { ...initial } } // Dados de teste locais não são importados para o piloto.

function App() {

  const [data, setData] = useState<Collection>(readStore)

  const [orgId, setOrgId] = useState<string | null>(null)
  const [cardRates, setCardRates] = useState<Record<number, number>>({})
  const [rateSaving, setRateSaving] = useState(false)
  const [role, setRole] = useState('')
  const [permissions, setPermissions] = useState<Record<string, {can_view:boolean;can_create:boolean;can_edit:boolean;can_delete:boolean}>>({})
  const [accessReady, setAccessReady] = useState(false)
  const isAdmin = role === 'owner' || role === 'admin'
  const moduleForPage = (p: string) => p === 'inventory' ? 'products' : p === 'expenses' || p === 'cash_entries' ? 'financial' : p
  const can = (p: string, action: 'view'|'create'|'edit'|'delete' = 'view') => {
    if (!accessReady || !orgId) return false
    if (p === 'dashboard' || p === 'settings' || p === 'hr') return isAdmin
    if (isAdmin) return true
    return Boolean(permissions[moduleForPage(p)]?.[`can_${action}`])
  }


  const [saleDetails, setSaleDetails] = useState<RecordItem | null>(null)
  const [installmentDetails, setInstallmentDetails] = useState<Record<string, {installments:number;rate_percent:number;base_amount:number;fee_amount:number;total_amount:number}>>({})
  const [trackedSales, setTrackedSales] = useState<string[]>([])
  const [saleItemRows, setSaleItemRows] = useState<{sale_id:string;item_type:string;product_id:string|null;service_id:string|null;quantity:number;unit_price:number;unit_cost:number}[]>([])
  const [stockLocations, setStockLocations] = useState<{id:string;name:string}[]>([])
  const [stockBalances, setStockBalances] = useState<{location_id:string;product_id:string;quantity:number}[]>([])
  const [stockError, setStockError] = useState('')
  const [saleItems, setSaleItems] = useState<{type:'product'|'service';id:string;quantity:number;location_id?:string}[]>([])
  const [pickType, setPickType] = useState<'product'|'service'>('product')
  const [pickId, setPickId] = useState('')
  const [pickLocation, setPickLocation] = useState('')
  const [pickQty, setPickQty] = useState('1')
  const [customerLoading, setCustomerLoading] = useState(true)

  const [customerError, setCustomerError] = useState('')

  const [vehicleLoading, setVehicleLoading] = useState(true)

  const [vehicleError, setVehicleError] = useState('')

  const [saving, setSaving] = useState(false)
  const [catalogErrors, setCatalogErrors] = useState<Record<string, string>>({})
  const [financeErrors, setFinanceErrors] = useState<Record<string,string>>({})
  const [operationLoading, setOperationLoading] = useState(true)
  const [operationErrors, setOperationErrors] = useState<Record<string, string>>({})

  const [page, setPage] = useState('dashboard')

  const [search, setSearch] = useState('')

  const [sidebar, setSidebar] = useState(false)

  const [modal, setModal] = useState(false)

  const [editing, setEditing] = useState<string | null>(null)

  const [form, setForm] = useState<Record<string, string>>({})

  const [period, setPeriod] = useState('month')

  const [shopName, setShopName] = useState(() => localStorage.getItem('auto-performance-shop') || 'Aldeir Som Automotivo')

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
        setOperationLoading(false)

        return

      }

      const { data: membership, error: memberError } = await supabase

        .from('organization_members')

        .select('organization_id,role,active')

        .eq('user_id', auth.user.id)
        .eq('active', true)

        .limit(1)

        .maybeSingle()

      if (!active) return

      if (memberError || !membership?.organization_id) {

        setCustomerError('Não foi possível identificar sua empresa: ' + (memberError?.message || 'vínculo não encontrado'))

        setVehicleError('Não foi possível identificar sua empresa.')

        setVehicleLoading(false)

        setCustomerLoading(false)
        setOperationLoading(false)

        return

      }

      setOrgId(membership.organization_id)
      const [ratesResult, installmentResult] = await Promise.all([
        supabase.from('ap_card_rates').select('installments,rate_percent').eq('organization_id',membership.organization_id),
        supabase.from('ap_sale_installments').select('sale_id,installments,rate_percent,base_amount,fee_amount,total_amount').eq('organization_id',membership.organization_id)
      ])
      if (!active) return
      if (ratesResult.error || installmentResult.error) {
        setFinanceErrors(old=>({...old,sales:'Configuracao de cartao indisponivel: '+(ratesResult.error?.message || installmentResult.error?.message)}))
      } else {
        setCardRates(Object.fromEntries((ratesResult.data||[]).map(r=>[r.installments,Number(r.rate_percent)])))
        setInstallmentDetails(Object.fromEntries((installmentResult.data||[]).map(r=>[r.sale_id,{installments:Number(r.installments),rate_percent:Number(r.rate_percent),base_amount:Number(r.base_amount),fee_amount:Number(r.fee_amount),total_amount:Number(r.total_amount)}])))
      }
      setRole(membership.role || '')
      const admin = membership.role === 'owner' || membership.role === 'admin'
      if (!admin) {
        const {data: permissionRows, error: permissionError} = await supabase
          .from('user_permissions')
          .select('module,can_view,can_create,can_edit,can_delete')
          .eq('organization_id', membership.organization_id)
          .eq('user_id', auth.user.id)
        if (!active) return
        if (permissionError) {
          setCustomerError('Falha ao carregar permissões: ' + permissionError.message)
          setAccessReady(false)
          return
        }
        setPermissions(Object.fromEntries((permissionRows || []).map(r => [r.module, r])))
        const first = modules.find(m => m.key !== 'dashboard' && m.key !== 'settings' && m.key !== 'hr' && (permissionRows || []).some(r => r.module === (m.key === 'expenses' || m.key === 'cash_entries' ? 'financial' : m.key) && r.can_view))
        setPage(first?.key || 'no_access')
      } else setPage('dashboard')
      setAccessReady(true)
      // Financeiro compartilhado. Erros são mostrados e não geram fallback silencioso para localStorage.
      const financialTables = ['sales', 'sale_items', 'payments', 'expenses', 'cash_entries', 'goals'] as const
      const financeResults = await Promise.all(financialTables.map(table => supabase.from(table).select('*').eq('organization_id', membership.organization_id)))
      if (!active) return
      for (let i = 0; i < financeResults.length; i++) {
        const result = financeResults[i]
        if (result.error) setFinanceErrors(old => ({ ...old, [financialTables[i]]: result.error!.message }))
      }
      const [salesR, itemsR, paymentsR, expensesR, cashR, goalsR] = financeResults
      if (!itemsR.error) setSaleItemRows(itemsR.data || [])
      const trackedR=await supabase.from('ap_item_sales').select('sale_id').eq('organization_id',membership.organization_id)
      if(!trackedR.error && active)setTrackedSales((trackedR.data||[]).map(x=>x.sale_id))
      if (!salesR.error && !itemsR.error && !paymentsR.error) {
        const mapped = (salesR.data || []).map(s => {
          const items = (itemsR.data || []).filter(i => i.sale_id === s.id)
          const item = items[0]
          const payment = (paymentsR.data || []).find(p => p.sale_id === s.id)
          return { id: s.id, status:s.status||'completed', description: (items.length>1 ? `${items.length} itens · ${item?.description || 'Venda'}` : item?.description || 'Venda') + (Number((installmentResult.data||[]).find(x=>x.sale_id===s.id)?.installments||1)>1 ? ` · ${(installmentResult.data||[]).find(x=>x.sale_id===s.id)?.installments}x no crédito` : ''), customer_id: s.customer_id || '', vehicle_id: s.vehicle_id || '', amount: Number(s.total ?? payment?.amount ?? 0), cost: items.reduce((sum,i)=>sum+Number(i.unit_cost||0)*Number(i.quantity||1),0), method: payment?.method || '', date: String(payment?.paid_at || s.created_at || '').slice(0, 10), installments: Number((installmentResult.data||[]).find(x=>x.sale_id===s.id)?.installments||1), created_at: s.created_at || '' } as RecordItem
        })
        setData(old => ({ ...old, sales: mapped }))
      }
      if (!expensesR.error) setData(old => ({ ...old, expenses: (expensesR.data || []).map(e => ({ id:e.id, description:e.description || '', category:e.category || '', status:e.status || 'pending', paid_at:e.paid_at || '', amount:Number(e.amount || 0), date:String(e.paid_at || e.due_date || e.created_at || '').slice(0,10), created_at:e.created_at || '' })) }))
      if (!cashR.error) setData(old => ({ ...old, cash_entries: (cashR.data || []).map(c => ({ id:c.id, description:c.description || '', kind:c.entry_type || '', category:c.category || '', source_type:c.source_type || '', source_id:c.source_id || '', amount:Number(c.amount || 0), date:String(c.occurred_at || '').slice(0,10), created_at:c.occurred_at || '' })) }))
      if (!goalsR.error) setData(old => ({ ...old, goals: (goalsR.data || []).map(g => ({ id:g.id, name:'Faturamento', amount:Number(g.revenue_target || 0), month:String(g.period_start || '').slice(0,7), created_at:g.period_start || '' })) }))
      const [locationsR,balancesR] = await Promise.all([
        supabase.from('ap_stock_locations').select('id,name').eq('organization_id',membership.organization_id),
        supabase.from('ap_stock_balances').select('location_id,product_id,quantity').eq('organization_id',membership.organization_id)
      ])
      if (!active) return
      if (locationsR.error || balancesR.error) setStockError(locationsR.error?.message || balancesR.error?.message || 'Estoque indisponível')
      else { setStockError(''); setStockLocations(locationsR.data || []); setStockBalances(balancesR.data || []) }
      // Operações da Fase 2: todos os registros são consultados por organização.
      const [quoteResult, itemResult, osResult] = await Promise.all([
        supabase.from('quotes').select('id,customer_id,vehicle_id,status,discount,notes,created_at').eq('organization_id', membership.organization_id).order('created_at', { ascending: false }),
        supabase.from('quote_items').select('id,quote_id,item_type,product_id,service_id,description,quantity,unit_price').eq('organization_id', membership.organization_id),
        supabase.from('work_orders').select('id,customer_id,vehicle_id,quote_id,status,technician,notes,started_at,finished_at,created_at').eq('organization_id', membership.organization_id).order('created_at', { ascending: false }),
      ])
      if (!active) return
      if (quoteResult.error || itemResult.error) setOperationErrors(old => ({ ...old, quotes: quoteResult.error?.message || itemResult.error?.message || 'Erro nos itens' }))
      else setData(old => ({ ...old, quotes: (quoteResult.data || []).map(q => {
        const items = (itemResult.data || []).filter(i => i.quote_id === q.id)
        const item = items[0]
        const amount = items.reduce((total, i) => total + Number(i.quantity || 1) * Number(i.unit_price || 0), 0) - Number(q.discount || 0)
        return { id: q.id, customer_id: q.customer_id || '', vehicle_id: q.vehicle_id || '', status: q.status || 'open', discount: Number(q.discount || 0), notes: q.notes || '', item_type: item?.item_type || (item?.product_id ? 'product' : item?.service_id ? 'service' : ''), item_id: item?.product_id || item?.service_id || '', quantity: Number(item?.quantity || 1), unit_price: Number(item?.unit_price || 0), amount: Math.max(0, amount), item_count: items.length, item_row_id: item?.id || '', created_at: q.created_at || '' } as RecordItem
      }) }))
      if (osResult.error) setOperationErrors(old => ({ ...old, work_orders: osResult.error!.message }))
      else setData(old => ({ ...old, work_orders: (osResult.data || []).map(o => ({ id: o.id, customer_id: o.customer_id || '', vehicle_id: o.vehicle_id || '', quote_id: o.quote_id || '', status: o.status || 'waiting', technician: o.technician || '', notes: o.notes || '', started_at: o.started_at || '', finished_at: o.finished_at || '', created_at: o.created_at || '' })) }))
      setOperationLoading(false)
      // Catálogos compartilhados entre os usuários da organização.
      const catalogTables = ['products', 'services', 'suppliers'] as const
      for (const table of catalogTables) {
        const result = await supabase.from(table).select('*').eq('organization_id', membership.organization_id)
        if (!active) return
        if (result.error) {
          setCatalogErrors(old => ({ ...old, [table]: result.error!.message }))
          continue
        }
        const items: RecordItem[] = (result.data || []).map((r: Record<string, unknown>) => {
          const row: RecordItem = { id: String(r.id) }
          for (const [key, value] of Object.entries(r)) {
            if (typeof value === 'string' || typeof value === 'number') row[key] = value
          }
          if (table === 'products') {
            row.name = String(r.name || r.label || r.title || '').trim()
            row.price = Number(r.sale_price || 0)
            row.cost = Number(r.cost || 0)
            row.quantity = Number(r.stock_qty || 0)
            row.minimum = Number(r.min_stock || 0)
            row.category = ''
          }
          if (table === 'services') row.duration = Number(r.estimated_minutes || 0)
          return row
        })
        setData(old => ({ ...old, [table]: items }))
      }


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

  // Alertas calculados a partir do catálogo sincronizado do Supabase.
  const stockAlerts = useMemo(() => (data.products || [])
    .filter(p => Number(p.minimum || 0) > 0 && Number(p.quantity || 0) <= Number(p.minimum || 0))
    .sort((a, b) => Number(a.quantity || 0) - Number(b.quantity || 0)), [data.products])
  const [stockAlertDismissed, setStockAlertDismissed] = useState(false)

  const sales = (data.sales || []).filter(s=>s.status!=='cancelled')

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

  const filteredCash = (data.cash_entries || []).filter(x => { const d = String(x.date || ''); const now = today(); return period === 'all' || (period === 'today' ? d === now : period === 'month' ? d.startsWith(now.slice(0,7)) : d.slice(0,4) === now.slice(0,4)) })
  const cashIncome = filteredCash.filter(x => x.kind === 'income').reduce((sum,x) => sum + number(x.amount),0)
  const cashExpense = filteredCash.filter(x => x.kind === 'expense').reduce((sum,x) => sum + number(x.amount),0)

  const monthlyGoal = (data.goals || []).filter(x => String(x.month) === today().slice(0, 7)).reduce((s, x) => s + number(x.amount), 0)

  const goalPct = monthlyGoal > 0 ? Math.min(100, revenue / monthlyGoal * 100) : 0

  const chartData = useMemo(() => {

    const dates = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toLocaleDateString('en-CA') })

    return dates.map(d => ({ name: d.slice(8), vendas: sales.filter(x => x.date === d).reduce((s, x) => s + number(x.amount), 0), despesas: expenses.filter(x => x.date === d).reduce((s, x) => s + number(x.amount), 0) }))

  }, [sales, expenses])

  const saleItemPrice=(item:{type:'product'|'service';id:string;quantity:number})=>{
    const entry=(item.type==='product'?data.products:data.services).find(p=>p.id===item.id)
    return Number(entry?.price||0)*item.quantity
  }
  const saleItemTotal=saleItems.reduce((sum,item)=>sum+saleItemPrice(item),0)
  const soldItems=saleItemRows.filter(i=>sales.some(s=>s.id===i.sale_id))
  const filteredSoldItems=soldItems.filter(i=>{const sale=filteredSales.find(s=>s.id===i.sale_id);return !!sale})
  const productRanking=Object.values(filteredSoldItems.filter(i=>i.item_type==='product'&&i.product_id).reduce((acc,i)=>{const id=String(i.product_id);if(!acc[id])acc[id]={id,quantity:0,revenue:0,profit:0};acc[id].quantity+=Number(i.quantity||0);acc[id].revenue+=Number(i.quantity||0)*Number(i.unit_price||0);acc[id].profit+=Number(i.quantity||0)*(Number(i.unit_price||0)-Number(i.unit_cost||0));return acc},{} as Record<string,{id:string;quantity:number;revenue:number;profit:number}>)).sort((a,b)=>b.quantity-a.quantity).slice(0,5)
  const serviceRanking=Object.values(filteredSoldItems.filter(i=>i.item_type==='service'&&i.service_id).reduce((acc,i)=>{const id=String(i.service_id);if(!acc[id])acc[id]={id,quantity:0};acc[id].quantity+=Number(i.quantity||0);return acc},{} as Record<string,{id:string;quantity:number}>)).sort((a,b)=>b.quantity-a.quantity).slice(0,5)
  const stockTotalValue=data.products.reduce((sum,p)=>sum+Number(p.quantity||0)*Number(p.cost||0),0)
  const soldUnits=filteredSoldItems.filter(i=>i.item_type==='product').reduce((sum,i)=>sum+Number(i.quantity||0),0)
  const title = page === 'dashboard' ? 'Visão geral' : page === 'settings' ? 'Configurações' : page === 'inventory' ? 'Controle de estoque' : page === 'hr' ? 'Funcionários e usuários' : config[page]?.title

  function navigate(p: string) { if (!can(p)) return; setPage(p); setSearch(''); setSidebar(false) }

  const [warrantyOrder, setWarrantyOrder] = useState<RecordItem | null>(null)
  const [celebrate, setCelebrate] = useState(false)

  function openNew() { if (!can(page, 'create')) return; setSaleItems([]); setPickId(''); setPickLocation(''); setPickQty('1'); setEditing(null); setForm(page === 'quotes' ? { status: 'open', item_type: 'service', quantity: '1' } : page === 'work_orders' ? { status: 'waiting' } : page === 'sales' ? { date: today(), method: 'pix', installments: '1', customer_mode: 'existing', vehicle_mode: 'none' } : page === 'expenses' ? { date: today(), status: 'paid', payment_method: 'pix' } : page === 'cash_entries' ? { date: today(), kind: 'income' } : page === 'goals' ? { month: today().slice(0, 7) } : {}); setModal(true) }

  function openEdit(row: RecordItem) { if (!can(page, 'edit')) return; if(page==='products') { alert('Para alterar quantidades, use Controle de estoque. Os demais dados do produto podem ser editados.'); } setEditing(row.id); setForm(Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)]))); setModal(true) }

  // Atualiza as colecoes afetadas pela venda sem desmontar a aplicacao nem perder a pagina atual.
  async function refreshAfterSale(organizationId: string) {
    const [salesR, itemsR, paymentsR, installmentsR, customersR, vehiclesR, trackedR, cashR, balancesR, productsR] = await Promise.all([
      supabase.from('sales').select('*').eq('organization_id', organizationId),
      supabase.from('sale_items').select('*').eq('organization_id', organizationId),
      supabase.from('payments').select('*').eq('organization_id', organizationId),
      supabase.from('ap_sale_installments').select('sale_id,installments,rate_percent,base_amount,fee_amount,total_amount').eq('organization_id', organizationId),
      supabase.from('customers').select('id,name,phone,email,document,notes,created_at').eq('organization_id', organizationId),
      supabase.from('vehicles').select('id,customer_id,plate,brand,model,model_year,color,notes,created_at').eq('organization_id', organizationId),
      supabase.from('ap_item_sales').select('sale_id').eq('organization_id', organizationId),
      supabase.from('cash_entries').select('*').eq('organization_id', organizationId),
      supabase.from('ap_stock_balances').select('location_id,product_id,quantity').eq('organization_id', organizationId),
      supabase.from('products').select('*').eq('organization_id', organizationId)
    ])
    const failures = [salesR, itemsR, paymentsR, installmentsR, customersR, vehiclesR, trackedR, cashR, balancesR, productsR]
      .filter(r => r.error).map(r => r.error!.message)
    if (failures.length) throw new Error('Venda gravada, mas houve falha ao atualizar a tela: ' + failures.join('; '))
    const installments = new Map((installmentsR.data || []).map(i => [i.sale_id, i]))
    const mappedSales: RecordItem[] = (salesR.data || []).map(sale => {
      const items = (itemsR.data || []).filter(item => item.sale_id === sale.id)
      const payment = (paymentsR.data || []).find(item => item.sale_id === sale.id)
      const installment = installments.get(sale.id)
      const count = Number(installment?.installments || 1)
      const description = items.length > 1 ? `${items.length} itens · ${items[0]?.description || 'Venda'}` : items[0]?.description || 'Venda'
      return {
        id: sale.id, status: sale.status || 'completed',
        description: description + (count > 1 ? ` · ${count}x no crédito` : ''),
        customer_id: sale.customer_id || '', vehicle_id: sale.vehicle_id || '',
        amount: Number(sale.total ?? payment?.amount ?? 0),
        cost: items.reduce((sum, item) => sum + Number(item.unit_cost || 0) * Number(item.quantity || 1), 0),
        method: payment?.method || '', date: String(payment?.paid_at || sale.created_at || '').slice(0, 10),
        installments: count, created_at: sale.created_at || ''
      }
    })
    setSaleItemRows(itemsR.data || [])
    setInstallmentDetails(Object.fromEntries((installmentsR.data || []).map(r=>[r.sale_id,{installments:Number(r.installments),rate_percent:Number(r.rate_percent),base_amount:Number(r.base_amount),fee_amount:Number(r.fee_amount),total_amount:Number(r.total_amount)}])))
    setTrackedSales((trackedR.data || []).map(row => row.sale_id))
    setStockBalances(balancesR.data || [])
    setData(old => ({
      ...old,
      sales: mappedSales,
      customers: (customersR.data || []).map(row => ({id:row.id, name:row.name || '', phone:row.phone || '', email:row.email || '', document:row.document || '', notes:row.notes || '', created_at:row.created_at || ''})),
      vehicles: (vehiclesR.data || []).map(row => ({id:row.id, customer_id:row.customer_id || '', plate:row.plate || '', brand:row.brand || '', model:row.model || '', model_year:row.model_year || '', color:row.color || '', notes:row.notes || '', created_at:row.created_at || ''})),
      cash_entries: (cashR.data || []).map(row => ({id:row.id, description:row.description || '', kind:row.entry_type || '', category:row.category || '', source_type:row.source_type || '', source_id:row.source_id || '', amount:Number(row.amount || 0), date:String(row.occurred_at || '').slice(0,10), created_at:row.occurred_at || ''})),
      products: (productsR.data || []).map(row => ({id:row.id, name:String(row.name || row.label || row.title || '').trim(), price:Number(row.sale_price || 0), cost:Number(row.cost || 0), quantity:Number(row.stock_qty || 0), minimum:Number(row.min_stock || 0), category:''}))
    }))
  }

  async function save() {
    if (!can(page, editing ? 'edit' : 'create')) { alert('Ação não autorizada.'); return }

    const fields = config[page]?.fields || []

    if (fields.some(f => f.required && !(page === 'sales' && saleItems.length>0 && ['description','amount'].includes(f.key)) && !(page === 'sales' && f.key === 'installments') && !String(form[f.key] || '').trim())) { alert('Preencha os campos obrigatórios.'); return }
    if (page === 'sales') {
      if (saleItems.length && form.customer_mode === 'new') { alert('Cadastre o novo cliente em Clientes antes da venda com itens.'); return }
      if (saleItems.length && form.vehicle_mode === 'new') { alert('Cadastre o veículo em Veículos antes da venda com itens.'); return }
      if (form.customer_mode === 'new' && !form.new_customer_name?.trim()) { alert('Informe o nome do novo cliente.'); return }
      if (form.customer_mode !== 'new' && form.customer_id && !data.customers.some(c => c.id === form.customer_id)) { alert('Cliente inválido.'); return }
      if (form.vehicle_mode === 'new' && (!form.new_vehicle_plate?.trim() || !form.new_vehicle_model?.trim())) { alert('Informe placa e modelo do novo veículo.'); return }
      if (form.vehicle_mode === 'existing' && form.vehicle_id && !data.vehicles.some(v => v.id === form.vehicle_id && (!v.customer_id || v.customer_id === form.customer_id))) { alert('Veículo inválido para o cliente.'); return }
      if (!['pix', 'cash', 'debit', 'credit'].includes(form.method || '')) { alert('Selecione uma forma de pagamento válida.'); return }
      if (form.method === 'credit' && (!Number.isInteger(Number(form.installments)) || Number(form.installments) < 1 || Number(form.installments) > 12)) { alert('Selecione de 1 a 12 parcelas.'); return }
    }

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

    if (page === 'quotes' || page === 'work_orders') {
      if (!orgId || operationLoading || operationErrors[page]) { alert('Operações indisponíveis: ' + (operationErrors[page] || 'aguarde a conexão')); return }
      if (!data.customers.some(c => c.id === form.customer_id)) { alert('Selecione um cliente cadastrado.'); return }
      if (form.vehicle_id && !data.vehicles.some(v => v.id === form.vehicle_id && (!v.customer_id || v.customer_id === form.customer_id))) { alert('O veículo precisa pertencer ao cliente selecionado.'); return }
      if (page === 'work_orders') {
        const quote = data.quotes.find(q => q.id === form.quote_id)
        if (form.quote_id && (!quote || quote.status !== 'approved' || quote.customer_id !== form.customer_id)) { alert('Escolha um orçamento aprovado do mesmo cliente.'); return }
        const payload = { customer_id: form.customer_id, vehicle_id: form.vehicle_id || null, quote_id: form.quote_id || null, technician: form.technician?.trim() || null, status: form.status || 'waiting', notes: form.notes?.trim() || null,
          started_at: form.status === 'in_progress' ? (editing ? (data.work_orders.find(o => o.id === editing)?.started_at || new Date().toISOString()) : new Date().toISOString()) : (editing ? data.work_orders.find(o => o.id === editing)?.started_at || null : null),
          finished_at: form.status === 'finished' ? new Date().toISOString() : null }
        setSaving(true)
        const query = editing ? supabase.from('work_orders').update(payload).eq('id', editing).eq('organization_id', orgId) : supabase.from('work_orders').insert({ ...payload, organization_id: orgId })
        const { data: saved, error } = await query.select('*').single()
        setSaving(false)
        if (error || !saved) { alert('Erro ao salvar OS: ' + (error?.message || 'sem retorno')); return }
        const row: RecordItem = { id: saved.id, customer_id: saved.customer_id || '', vehicle_id: saved.vehicle_id || '', quote_id: saved.quote_id || '', technician: saved.technician || '', status: saved.status || '', notes: saved.notes || '', started_at: saved.started_at || '', finished_at: saved.finished_at || '', created_at: saved.created_at || '' }
        setData(old => ({ ...old, work_orders: editing ? old.work_orders.map(o => o.id === editing ? row : o) : [row, ...old.work_orders] }))
        setModal(false)
        if (saved.status === 'finished' && (!editing || data.work_orders.find(o => o.id === editing)?.status !== 'finished')) {
          setCelebrate(true)
          window.setTimeout(() => setCelebrate(false), 2600)
          setWarrantyOrder(row)
        }
        return
      }
      const oldQuote = editing ? data.quotes.find(q => q.id === editing) : null
      if (editing && data.work_orders.some(o => o.quote_id === editing)) { alert('Orçamento vinculado a uma OS: edição bloqueada nesta fase.'); return }
      if (form.status === 'approved' && !form.item_id) { alert('Adicione um produto ou serviço antes de aprovar o orçamento.'); return }
      if (oldQuote && Number(oldQuote.item_count || 0) > 1) { alert('Este orçamento tem múltiplos itens. A edição de itens ficará disponível na próxima atualização.'); return }
      if (form.item_id && ![...data.products, ...data.services].some(i => i.id === form.item_id)) { alert('Selecione um item válido.'); return }
      if (form.item_id && (!Number.isFinite(Number(form.quantity)) || Number(form.quantity) <= 0 || Number(form.unit_price) < 0)) { alert('Informe quantidade e preço válidos.'); return }
      const discount = Number(form.discount || 0)
      if (!Number.isFinite(discount) || discount < 0) { alert('Desconto inválido.'); return }
      const payload = { customer_id: form.customer_id, vehicle_id: form.vehicle_id || null, status: form.status || 'open', discount, notes: form.notes?.trim() || null }
      setSaving(true)
      const query = editing ? supabase.from('quotes').update(payload).eq('id', editing).eq('organization_id', orgId) : supabase.from('quotes').insert({ ...payload, organization_id: orgId })
      const { data: saved, error } = await query.select('*').single()
      if (error || !saved) { setSaving(false); alert('Erro ao salvar orçamento: ' + (error?.message || 'sem retorno')); return }
      let itemRowId = String(oldQuote?.item_row_id || '')
      if (form.item_id) {
        const selected = (form.item_type === 'product' ? data.products : data.services).find(i => i.id === form.item_id)
        if (!selected) { setSaving(false); alert('Produto ou serviço não encontrado.'); return }
        const itemPayload = { item_type: form.item_type, product_id: form.item_type === 'product' ? form.item_id : null, service_id: form.item_type === 'service' ? form.item_id : null, description: String(selected.name || ''), quantity: Number(form.quantity || 1), unit_price: Number(form.unit_price || 0) }
        const itemQuery = itemRowId ? supabase.from('quote_items').update(itemPayload).eq('id', itemRowId).eq('organization_id', orgId) : supabase.from('quote_items').insert({ ...itemPayload, organization_id: orgId, quote_id: saved.id })
        const { data: item, error: itemError } = await itemQuery.select('id').single()
        if (itemError || !item) { setSaving(false); alert('Orçamento salvo, mas houve erro ao salvar o item: ' + (itemError?.message || 'sem retorno') + '. Reabra e corrija antes de aprovar.'); return }
        itemRowId = item.id
      } else if (itemRowId) {
        const { error: itemError } = await supabase.from('quote_items').delete().eq('id', itemRowId).eq('organization_id', orgId)
        if (itemError) { setSaving(false); alert('Erro ao remover item: ' + itemError.message); return }
        itemRowId = ''
      }
      setSaving(false)
      const row: RecordItem = { id: saved.id, customer_id: saved.customer_id || '', vehicle_id: saved.vehicle_id || '', status: saved.status || 'open', notes: saved.notes || '', discount: Number(saved.discount || 0), item_type: form.item_type || '', item_id: form.item_id || '', quantity: Number(form.quantity || 1), unit_price: Number(form.unit_price || 0), amount: Math.max(0, (form.item_id ? Number(form.quantity || 1) * Number(form.unit_price || 0) : 0) - discount), item_count: itemRowId ? 1 : 0, item_row_id: itemRowId, created_at: saved.created_at || '' }
      setData(old => ({ ...old, quotes: editing ? old.quotes.map(q => q.id === editing ? row : q) : [row, ...old.quotes] }))
      setModal(false)
      return
    }
    if (page === 'products' || page === 'services' || page === 'suppliers') {
      if (!orgId || catalogErrors[page]) { alert('Conexão com Supabase indisponível: ' + (catalogErrors[page] || 'empresa não encontrada')); return }
      const payload = page === 'products' ? {
        name: form.name.trim(), sku: form.sku?.trim() || null,
        sale_price: Number(form.price || 0), cost: Number(form.cost || 0),
        ...(editing ? {} : {stock_qty:Number(form.quantity||0)}), min_stock: Number(form.minimum || 0),
      } : page === 'services' ? {
        name: form.name.trim(), price: Number(form.price || 0),
        estimated_minutes: form.duration ? Number(form.duration) : null,
      } : {
        name: form.name.trim(), phone: form.phone?.trim() || null,
        document: form.document?.trim() || null, email: form.email?.trim() || null,
      }
      setSaving(true)
      const query = editing
        ? supabase.from(page).update(payload).eq('id', editing).eq('organization_id', orgId)
        : supabase.from(page).insert({ ...payload, organization_id: orgId })
      const { data: saved, error } = await query.select('*').single()
      setSaving(false)
      if (error || !saved) { alert('Não foi possível salvar: ' + (error?.message || 'sem retorno')); return }
      const row: RecordItem = { id: saved.id, ...form, name: saved.name || '', created_at: saved.created_at || '' }
      if (page === 'products') {
        row.price = Number(saved.sale_price || 0)
        row.quantity = Number(saved.stock_qty || 0)
        row.minimum = Number(saved.min_stock || 0)
        row.cost = Number(saved.cost || 0)
        row.sku = saved.sku || ''
      }
      if (page === 'services') { row.price = Number(saved.price || 0); row.duration = Number(saved.estimated_minutes || 0) }
      setData(old => ({ ...old, [page]: editing ? old[page].map(x => x.id === editing ? row : x) : [row, ...old[page]] }))
      setModal(false)
      return
    }

    if (['sales','expenses','cash_entries','goals'].includes(page)) {
      if (!orgId) { alert('Empresa não identificada.'); return }
      if (financeErrors[page]) { alert('Financeiro indisponível: ' + financeErrors[page]); return }
      if (page === 'cash_entries' && editing && isAutomaticCash((data.cash_entries || []).find(x => x.id === editing) || {id:editing})) { alert('Lançamentos automáticos não podem ser editados diretamente.'); return }
      if (page === 'sales' && editing) { alert('Edição de venda exige estorno transacional e será habilitada após a validação do fluxo.'); return }
      const amount = page === 'sales' && saleItems.length ? saleItemTotal - Number(form.discount || 0) : Number(form.amount || 0)
      if (page === 'sales' && form.method === 'credit' && cardRates[Number(form.installments||1)] === undefined) { alert('Taxa nao configurada para o parcelamento escolhido.'); return }
      if (!(amount > 0) || !Number.isFinite(amount)) { alert('Informe um valor maior que zero.'); return }
      setSaving(true)
      try {
        if (page === 'sales') {
          // Itens do catálogo usam a RPC transacional que também baixa estoque.
          if (saleItems.length) {
            const { error: itemError } = await supabase.rpc('ap_sale_with_items_card_v2', {
              p_org:orgId, p_items:saleItems, p_method:form.method,
              p_customer:form.customer_id || null,
              p_vehicle:form.vehicle_mode==='existing' ? form.vehicle_id || null : null,
              p_discount:Number(form.discount || 0),
              p_installments:form.method==='credit'?Number(form.installments):1
            })
            if (itemError) throw itemError
            setModal(false)
            setPage('sales')
            setSearch('')
            try { await refreshAfterSale(orgId) }
            catch (refreshError) { console.error('Venda salva; falha na atualização:', refreshError); alert('Venda salva, mas não foi possível atualizar todos os dados. Reabra a tela para consultar.'); return }
            alert('Venda registrada com sucesso!')
            return
          }
          // RPC legada: venda avulsa, cliente e veículo novos.
          const { error } = await supabase.rpc('ap_register_sale_card_v2', {
            p_org: orgId, p_description: form.description.trim(), p_amount: amount,
            p_cost: Number(form.cost || 0),
            p_method: form.method,
            p_installments:form.method==='credit'?Number(form.installments):1,
p_date: form.date || today(),
            p_customer_id: form.customer_mode === 'new' ? null : form.customer_id || null,
            p_new_customer_name: form.customer_mode === 'new' ? form.new_customer_name?.trim() : null,
            p_new_customer_phone: form.customer_mode === 'new' ? form.new_customer_phone?.trim() || null : null,
            p_new_customer_email: form.customer_mode === 'new' ? form.new_customer_email?.trim() || null : null,
            p_new_customer_document: form.customer_mode === 'new' ? form.new_customer_document?.trim() || null : null,
            p_vehicle_id: form.vehicle_mode === 'existing' ? form.vehicle_id || null : null,
            p_new_vehicle_plate: form.vehicle_mode === 'new' ? form.new_vehicle_plate?.trim().toUpperCase() : null,
            p_new_vehicle_brand: form.vehicle_mode === 'new' ? form.new_vehicle_brand?.trim() || null : null,
            p_new_vehicle_model: form.vehicle_mode === 'new' ? form.new_vehicle_model?.trim() : null,
            p_new_vehicle_year: form.vehicle_mode === 'new' && form.new_vehicle_year ? Number(form.new_vehicle_year) : null
          })
          if (error) throw error
          setModal(false)
          setPage('sales')
          setSearch('')
          try { await refreshAfterSale(orgId) }
          catch (refreshError) { console.error('Venda salva; falha na atualização:', refreshError); alert('Venda salva, mas não foi possível atualizar todos os dados. Reabra a tela para consultar.'); return }
          alert('Venda registrada com sucesso!')
        } else {
          const payload = page === 'expenses' ? {
            organization_id:orgId, description:form.description.trim(), category:form.category || null,
            amount, due_date:form.date || today(), paid_at:form.status === 'pending' ? null : new Date((form.date || today()) + 'T12:00:00').toISOString(), status:form.status === 'pending' ? 'pending' : 'paid', payment_method:form.status === 'pending' ? null : form.payment_method || null
          } : page === 'cash_entries' ? {
            organization_id:orgId, description:form.description.trim(), entry_type:form.kind,
            category:'avulso', amount, occurred_at:new Date((form.date || today()) + 'T12:00:00').toISOString()
          } : {
            organization_id:orgId, period_start:(form.month || today().slice(0,7)) + '-01',
            period_end:new Date(Number((form.month || today().slice(0,7)).slice(0,4)), Number((form.month || today().slice(0,7)).slice(5,7)), 0).toLocaleDateString('en-CA'),
            revenue_target:amount, profit_target:0
          }
const q = editing
  ? supabase.from(page)
      .update(payload as never)
      .eq('id', editing)
      .eq('organization_id', orgId)
  : supabase.from(page).insert(payload as never)

const { data: saved, error } = await q.select('*').single()
          if (error || !saved) throw (error || new Error('Registro não retornado'))
          const row: RecordItem = { ...form, id:saved.id, amount, created_at:saved.created_at || today() }
          setData(old => ({ ...old, [page]: editing ? old[page].map(x => x.id === editing ? row : x) : [row,...old[page]] }))
        }
        setModal(false)
      } catch (e: unknown) {
  console.error('Erro ao salvar venda:', e)

  const erro =
    e && typeof e === 'object' && 'message' in e
      ? String(e.message)
      : typeof e === 'string'
        ? e
        : JSON.stringify(e)

  alert('Erro ao salvar a venda: ' + erro)
}
      finally { setSaving(false) }
      return
    }

    const row: RecordItem = { ...form, installments: page === 'sales' ? (form.method === 'credit' ? Number(form.installments || 1) : 1) : (form.installments || ''), id: editing || uid(), created_at: editing ? form.created_at || today() : today() }

    setData(old => ({ ...old, [page]: editing ? (old[page] || []).map(x => x.id === editing ? row : x) : [row, ...(old[page] || [])] }))

    setModal(false)

  }



  async function remove(id: string) {
    if (!can(page, 'delete')) { alert('Ação não autorizada.'); return }

    if (!confirm('Deseja realmente excluir este registro?')) return

    if (['sales','expenses','cash_entries','goals'].includes(page)) {
      if (page === 'sales') { alert('Exclusão de vendas bloqueada até o fluxo de cancelamento/estorno ser implementado.'); return }
      if (!orgId) return
      if (page === 'cash_entries' && isAutomaticCash((data.cash_entries || []).find(x => x.id === id) || {id})) { alert('Lançamento automático: altere a operação de origem. Estornos devem preservar o histórico.'); return }
      const { data: deleted, error } = await supabase.from(page).delete().eq('id',id).eq('organization_id',orgId).select('id')
      if (error || !deleted?.length) { alert('Falha ao excluir no Supabase: ' + (error?.message || 'Sem permissão')); return }
      setData(old => ({ ...old, [page]: old[page].filter(x => x.id !== id) }))
      return
    }
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

    if (page === 'quotes' || page === 'work_orders') {
      if (!orgId || operationLoading || operationErrors[page]) { alert('Conexão indisponível.'); return }
      if (page === 'quotes') {
        if (data.work_orders.some(o => o.quote_id === id)) { alert('Este orçamento possui uma OS vinculada e não pode ser excluído.'); return }
        if (Number(data.quotes.find(q => q.id === id)?.item_count || 0) > 0) { alert('Para preservar os itens, não exclua orçamentos com itens nesta fase.'); return }
      }
      const { data: deleted, error } = await supabase.from(page).delete().eq('id', id).eq('organization_id', orgId).select('id')
      if (error || !deleted?.length) { alert('Não foi possível excluir: ' + (error?.message || 'sem permissão')); return }
      setData(old => ({ ...old, [page]: old[page].filter(x => x.id !== id) }))
      return
    }
    if (page === 'products' || page === 'services' || page === 'suppliers') {
      if (!orgId || catalogErrors[page]) { alert('Conexão com Supabase indisponível.'); return }
      const { data: deleted, error } = await supabase.from(page).delete().eq('id', id).eq('organization_id', orgId).select('id')
      if (error || !deleted?.length) { alert('Não foi possível excluir: ' + (error?.message || 'sem permissão ou registro vinculado')); return }
    }
    setData(old => ({ ...old, [page]: old[page].filter(x => x.id !== id) }))

  }



  async function cancelTrackedSale(id:string){
    if(!orgId||!can('sales','edit')||!trackedSales.includes(id))return
    if(!window.confirm('Cancelar esta venda? O estoque será estornado e o pagamento removido.'))return
    const {error}=await supabase.rpc('ap_cancel_item_sale',{p_org:orgId,p_sale:id})
    if(error)alert('Não foi possível cancelar: '+error.message)
    else window.location.reload()
  }

  function exportCsv() {
    if (!can(page, 'view')) return

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

      <nav>{['PAINEL', 'GESTÃO', 'OPERAÇÃO', 'FINANCEIRO', 'INTELIGÊNCIA', 'RH', 'SISTEMA'].map(g => <div className="nav-group" key={g}><div className="nav-heading">{g}</div>{modules.filter(m => m.group === g && can(m.key)).map(m => { const Icon = m.icon; return <button key={m.key} className={`nav-item ${page === m.key ? 'active' : ''}`} onClick={() => navigate(m.key)}><Icon size={18}/><span>{m.label}</span>{page === m.key && <span className="nav-dot"/>}</button> })}</div>)}</nav>

      <div className="sidebar-bottom"><div className="system-pill"><span className="status-dot"/> {customerLoading ? 'Conectando clientes…' : customerError ? 'Erro na conexão de clientes' : 'Cadastros e financeiro: Supabase (piloto)' }</div><small>Auto Performance · Versão 2.0</small></div>

    </aside>

    <div className="main-shell"><header className="topbar"><div className="top-left"><button className="icon-btn menu-btn" onClick={() => setSidebar(true)} aria-label="Abrir menu"><Menu size={22}/></button><div className="breadcrumb">Workspace <span>/</span> <strong>{title}</strong></div></div><div className="top-right"><span className="date-chip"><CalendarDays size={15}/> {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>{isAdmin && stockAlerts.length > 0 && !stockAlertDismissed && <button type="button" className="outline-btn" title="Estoque mínimo — abrir produtos" onClick={() => { setStockAlertDismissed(true); navigate('products') }} style={{color:'#ffb889',borderColor:'#a65d39'}}>⚠ {stockAlerts.length} em estoque mínimo</button>}<UserAccountMenu /></div></header>

      <main className="content">

        {!accessReady ? <div className="notice">Validando acesso à empresa e permissões…</div> : !can(page) ? <div className="notice">Acesso não autorizado para este módulo. Solicite permissão ao administrador.</div> : page === 'dashboard' ? <>

          <div className="page-heading"><div><div className="eyebrow"><Activity size={14}/> CENTRAL DE CONTROLE</div><h1>Visão geral <span className="wave">✦</span></h1><p>Acompanhe o desempenho e tome decisões com clareza.</p></div><div className="heading-actions"><select className="select" value={period} onChange={e => setPeriod(e.target.value)}><option value="today">Hoje</option><option value="month">Este mês</option><option value="year">Este ano</option><option value="all">Todo o período</option></select><button className="primary-btn" disabled={!can('sales', 'create')} onClick={() => navigate('sales')}><Plus size={17}/> Nova venda</button></div></div>

          <div className="notice"><BadgeCheck size={17}/> Indicadores financeiros carregados do Supabase. Vendas avulsas e despesas são registradas separadamente do caixa avulso.</div>
          {isAdmin && stockAlerts.length > 0 && <section className="panel" style={{padding:18,marginBottom:18,border:'1px solid #a65d39'}} aria-label="Alertas de estoque mínimo">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <strong style={{color:'#ffb889'}}>⚠ Estoque mínimo: {stockAlerts.length} produto(s) precisam de atenção</strong>
              <button type="button" className="outline-btn" onClick={() => navigate('products')}>Ver produtos</button>
            </div>
            <div style={{marginTop:10,display:'grid',gap:6}}>{stockAlerts.slice(0,6).map(p => <div key={p.id} style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><span>{p.name}</span><span style={{color:Number(p.quantity || 0) <= 0 ? '#ff8c8c' : '#ffce8a'}}>Disponível: {Number(p.quantity || 0)} · Mínimo: {Number(p.minimum || 0)}{Number(p.quantity || 0) <= 0 ? ' · ESGOTADO' : ''}</span></div>)}</div>
            {stockAlerts.length > 6 && <small>Mais {stockAlerts.length - 6} produto(s) em alerta.</small>}
          </section>}


          <div className="kpi-grid">

            <Kpi icon={CircleDollarSign} label="Faturamento" value={currency(revenue)} foot="Vendas no período" tone="blue" />

            <Kpi icon={ArrowUpRight} label="Lucro estimado" value={currency(profit)} foot="Receita − custos − despesas" tone="green" />

            <Kpi icon={ShoppingCart} label="Vendas realizadas" value={String(filteredSales.length)} foot="Registros no período" tone="purple" />

            <Kpi icon={BarChart3} label="Ticket médio" value={currency(filteredSales.length ? revenue / filteredSales.length : 0)} foot="Valor médio por venda" tone="orange" />
            <Kpi icon={ArrowDownRight} label="Despesas registradas" value={currency(spent)} foot="Despesas do período · não confundir com custos" tone="red" />
            <Kpi icon={ArrowDownRight} label="Entradas no caixa" value={currency(cashIncome)} foot="Recebimentos efetivamente lançados" tone="green" />
            <Kpi icon={ArrowUpRight} label="Saídas do caixa" value={currency(cashExpense)} foot="Pagamentos efetivamente lançados" tone="red" />
            <Kpi icon={Wallet} label="Saldo movimentado" value={currency(cashIncome - cashExpense)} foot="Entradas − saídas do período; não é saldo bancário" tone="blue" />

          </div>

          <div className="dashboard-grid"><section className="panel chart-panel"><div className="panel-head"><div><h3>Desempenho financeiro</h3><p>Vendas e despesas por dia · últimos 7 dias</p></div><span className="legend"><i style={{background:'#34d399'}}/> Vendas <i style={{background:'#fb7185',marginLeft:8}}/> Despesas</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} barGap={4}><CartesianGrid stroke="#242d43" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="name" stroke="#7885a2" tickLine={false} axisLine={false}/><YAxis stroke="#7885a2" tickLine={false} axisLine={false} width={48}/><Tooltip cursor={{ fill: 'transparent' }} contentStyle={{background:'#172037',border:'1px solid #34415d',borderRadius:12}} formatter={(v) => currency(Number(v))}/><Bar dataKey="vendas" name="Vendas" fill="#34d399" radius={[5,5,0,0]} maxBarSize={28}/><Bar dataKey="despesas" name="Despesas" fill="#fb7185" radius={[5,5,0,0]} maxBarSize={28}/></BarChart></ResponsiveContainer></div></section>
            <section className="panel goal-panel"><div className="panel-head"><div><h3>Meta de faturamento</h3><p>Objetivo do mês atual</p></div><Target size={19} className="muted-icon"/></div><div className="goal-ring" style={{background:`conic-gradient(#5b8cff ${goalPct}%, #27314a ${goalPct}% 100%)`}}><div><strong>{monthlyGoal ? `${goalPct.toFixed(0)}%` : "—"}</strong><small>{monthlyGoal ? "atingido" : "Sem meta definida"}</small></div></div><div className="goal-values"><span>{currency(revenue)}</span><span>{monthlyGoal ? currency(monthlyGoal) : 'Meta não definida'}</span></div><div className="progress-track"><div style={{width:`${goalPct}%`}}/></div><button className="text-action" onClick={() => navigate('goals')}>{monthlyGoal ? 'Gerenciar metas' : 'Definir primeira meta'} →</button></section></div>

          <div className="ap-stock-dashboard">
            <div className="panel ap-stock-dashboard-inner"><div className="panel-head"><div><h3>Inteligência de produtos e estoque</h3><p>Indicadores reais do catálogo e das vendas do período</p></div><button className="text-action" onClick={()=>navigate('inventory')}>Gerenciar estoque →</button></div>
              <div className="ap-stock-kpis"><div><small>Produtos cadastrados</small><strong>{data.products.length}</strong></div><div><small>Unidades vendidas</small><strong>{soldUnits}</strong></div><div><small>Estoque baixo</small><strong style={{color:'#fbbf24'}}>{stockAlerts.length}</strong></div><div><small>Valor em estoque (custo)</small><strong>{currency(stockTotalValue)}</strong></div></div>
              {stockError&&<p className="ap-stock-hint">Estoque por local ainda indisponível: execute a migração SQL para habilitar os novos controles.</p>}
            </div>
            <div className="ap-stock-rankings"><section className="panel"><h3>Top 5 produtos mais vendidos</h3><p>Por quantidade no período selecionado</p>{productRanking.length?productRanking.map((r,i)=><div className="ap-rank" key={r.id}><span>{i+1}. {data.products.find(p=>p.id===r.id)?.name||'Produto removido'}</span><b>{r.quantity} un.</b></div>):<p>Sem vendas de produtos neste período.</p>}</section><section className="panel"><h3>Serviços mais realizados</h3><p>Por quantidade no período selecionado</p>{serviceRanking.length?serviceRanking.map((r,i)=><div className="ap-rank" key={r.id}><span>{i+1}. {data.services.find(p=>p.id===r.id)?.name||'Serviço removido'}</span><b>{r.quantity}</b></div>):<p>Sem serviços vendidos neste período.</p>}</section></div>
          </div>
          <div className="bottom-grid"><section className="panel"><div className="panel-head"><div><h3>Atividade recente</h3><p>Últimas vendas cadastradas</p></div><button className="text-action" onClick={() => navigate('sales')}>Ver todas →</button></div>{sales.length ? <div className="activity-list">{sales.slice(0,5).map(s => <div className="activity-item" key={s.id}><span className="activity-icon"><ShoppingCart size={17}/></span><div><strong>{s.description}</strong><small>{s.customer || 'Venda avulsa'} · {s.date || 'Sem data'}</small></div><b>{currency(number(s.amount))}</b></div>)}</div> : <Empty text="As vendas cadastradas aparecerão aqui."/>}</section>

            <section className="panel"><div className="panel-head"><div><h3>Pulso da loja <Flame size={18} className="flame"/></h3><p>Indicadores operacionais</p></div></div><div className="pulse-list"><Pulse icon={Package} label="Produtos cadastrados" value={String(data.products.length)}/><Pulse icon={ArrowDownRight} label="Produtos em estoque baixo" value={String(data.products.filter(x => number(x.quantity) <= number(x.minimum)).length)}/><Pulse icon={ClipboardList} label="Orçamentos abertos" value={String(data.quotes.filter(x => String(x.status || 'Aberto').toLowerCase().includes('abert')).length)}/><Pulse icon={Wrench} label="Ordens em andamento" value={String(data.work_orders.filter(x => !String(x.status).toLowerCase().includes('conclu')).length)}/></div></section></div>

        </> : page === 'inventory' ? (orgId ? <><div className="page-heading"><div><h1>Controle de estoque</h1><p>Controle por local, entradas, saídas e transferências</p></div></div><InventoryPanel orgId={orgId} products={data.products.map((p) => ({
  ...p,
  name: String(p.label || p.name || 'Produto sem nome').trim()
}))} onUpdated={() => {}}/></> : null) : page === 'hr' ? (orgId ? <HRManager orgId={orgId} /> : <div className="notice">Empresa não identificada.</div>) : page === 'settings' ? <><div className="page-heading"><div><div className="eyebrow">PREFERÊNCIAS</div><h1>Configurações</h1><p>Personalize a identificação deste ambiente local.</p></div></div><div className="panel settings-panel"><label>Nome da loja<input value={shopName} onChange={e => setShopName(e.target.value)} placeholder="Nome da empresa"/></label><p>O nome é salvo automaticamente neste navegador. As permissões dos funcionários são salvas no Supabase. O nome exibido aqui continua local a este navegador.</p><div className="notice"><BadgeCheck size={17}/> Não use esta prévia com dados reais ou sensíveis antes da autenticação e validação das políticas RLS.</div></div><div className="panel settings-panel" style={{marginTop:16}}><h3>Taxas do cartão de crédito (TESTE)</h3><p>Percentuais fictícios por parcela. Atualize com a tabela real antes de utilizar em vendas.</p><div className="form-grid">{Array.from({length:12},(_,i)=>i+1).map(n=><label key={n}>{n}x — acréscimo (%)<input type="number" min="0" max="100" step="0.01" value={cardRates[n]??''} onChange={e=>setCardRates(old=>({...old,[n]:Number(e.target.value)}))}/></label>)}</div><button className="primary-btn" disabled={rateSaving||!orgId} onClick={async()=>{if(!orgId)return;setRateSaving(true);try{const rows=Array.from({length:12},(_,i)=>({organization_id:orgId,installments:i+1,rate_percent:cardRates[i+1]}));if(rows.some(r=>r.rate_percent===undefined||!Number.isFinite(r.rate_percent)||r.rate_percent<0||r.rate_percent>100))throw Error('Preencha taxas validas de 1x a 12x');const {error}=await supabase.from('ap_card_rates').upsert(rows,{onConflict:'organization_id,installments'});if(error)throw error;alert('Taxas atualizadas no Supabase.');}catch(e){alert('Erro ao salvar taxas: '+(e instanceof Error?e.message:String(e)))}finally{setRateSaving(false)}}}>{rateSaving?'Salvando…':'Salvar tabela de taxas'}</button></div></> : <>

          <div className="page-heading"><div><div className="eyebrow">AUTO PERFORMANCE / {page.toUpperCase()}</div><h1>{config[page].title}</h1><p>{config[page].subtitle}</p></div><div className="heading-actions"><button className="outline-btn" onClick={exportCsv}><Download size={17}/> Exportar CSV</button><button className="primary-btn" onClick={openNew} disabled={!can(page, 'create') || (page === 'customers' && (customerLoading || !!customerError)) || (['sales','expenses','cash_entries','goals'].includes(page) && !!financeErrors[page]) || (page === 'vehicles' && (vehicleLoading || !!vehicleError)) || (['quotes','work_orders'].includes(page) && (operationLoading || !!operationErrors[page]))}><Plus size={17}/> Novo registro</button></div></div>

          <div className="module-stats"><div className="stat-block"><small>Total de registros</small><strong>{data[page]?.length || 0}</strong></div><div className="stat-block"><small>Resultado da busca</small><strong>{visibleRows.length}</strong></div><div className="stat-block"><small>Armazenamento</small><strong className="stat-local">{'Supabase'}</strong></div></div>

          {['sales','expenses','cash_entries','goals'].includes(page) && Object.keys(financeErrors).length > 0 && <div className="notice">Falha ao consultar financeiro: {Object.entries(financeErrors).map(([t,e]) => t + ': ' + e).join('; ')}</div>}
          {page === 'customers' && (customerLoading || customerError) && <div className="notice">{customerLoading ? 'Carregando clientes do Supabase…' : customerError}</div>}

          {page === 'vehicles' && (vehicleLoading || vehicleError) && <div className="notice">{vehicleLoading ? 'Carregando veículos do Supabase…' : vehicleError}</div>}

          {['quotes','work_orders'].includes(page) && (operationLoading || operationErrors[page]) && <div className="notice">{operationLoading ? 'Carregando operações do Supabase…' : operationErrors[page]}</div>}
          <section className="panel table-panel"><div className="table-tools"><h3>Registros</h3><div className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar registros..."/></div></div><div className="table-scroll"><table><thead><tr>{config[page].fields.slice(0,5).map(f => <th key={f.key}>{f.label}</th>)}<th>Ações</th></tr></thead><tbody>{visibleRows.map(r => <tr key={r.id}>{config[page].fields.slice(0,5).map(f => <td key={f.key}>{['amount','price','cost'].includes(f.key) && !(page === 'cash_entries' && f.key === 'amount') ? currency(number(r[f.key])) : ['vehicles','sales'].includes(page) && f.key === 'customer_id' ? (data.customers.find(c => c.id === r.customer_id)?.name || (r.customer_id ? 'Cliente não encontrado' : 'Sem proprietário')) : ['quotes','work_orders'].includes(page) && f.key === 'customer_id' ? (data.customers.find(c => c.id === r.customer_id)?.name || '—') : ['quotes','work_orders','sales'].includes(page) && f.key === 'vehicle_id' ? (data.vehicles.find(v => v.id === r.vehicle_id)?.plate || '—') : f.key === 'item_id' ? ([...data.products,...data.services].find(i => i.id === r.item_id)?.name || '—') : f.key === 'item_type' ? (r.item_type === 'product' ? 'Produto' : r.item_type === 'service' ? 'Serviço' : '—') : page === 'cash_entries' && f.key === 'kind' ? <span className={`ap-movement ${r.kind === 'income' ? 'in' : 'out'}`}>{r.kind === 'income' ? '↙' : '↗'} {cashTypeLabel(String(r.kind || ''))}</span> : page === 'cash_entries' && f.key === 'amount' ? <span className={`ap-movement ${r.kind === 'income' ? 'in' : 'out'}`}>{r.kind === 'income' ? '+' : '−'} {currency(number(r.amount))}</span> : page === 'cash_entries' && f.key === 'description' ? <>{String(r.description || '').startsWith('Recebimento de venda') ? 'Recebimento de venda' : String(r.description || '')}{isAutomaticCash(r) && <small className="ap-auto-label">Automático</small>}</> : String(r[f.key] ?? '—')}</td>)}<td><div className="table-actions">{page === 'sales' && <button type="button" onClick={() => setSaleDetails(r)} title="Consultar detalhes da venda">Detalhes</button>}{can(page, 'edit') && !(page === 'cash_entries' && isAutomaticCash(r)) && <button onClick={() => openEdit(r)} title="Editar">Editar</button>}{page === 'sales' && can('sales','edit') && trackedSales.includes(r.id) && r.status!=='cancelled' && <button type="button" onClick={()=>void cancelTrackedSale(r.id)}>Cancelar venda</button>}{page === 'work_orders' && can(page, 'edit') && r.status === 'finished' && <button type="button" onClick={() => setWarrantyOrder(r)} title="Emitir termo de garantia">Garantia</button>}{can(page, 'delete') && !(page === 'cash_entries' && isAutomaticCash(r)) && <button onClick={() => remove(r.id)} title="Excluir" className="delete-btn"><Trash2 size={16}/></button>}</div></td></tr>)}</tbody></table>{!visibleRows.length && <Empty text={search ? 'Nenhum registro corresponde à pesquisa.' : 'Nenhum registro cadastrado. Use “Novo registro” para começar.'}/>}</div></section>

        </>}

      </main>

    </div>

    {celebrate && <div aria-hidden="true" className="ap-celebration">{Array.from({length:32},(_,i)=><span key={i} style={{left:`${(i*37)%100}%`,animationDelay:`${(i%7)*0.09}s`,background:['#6678ff','#a56cff','#35e1cc','#ffc857'][i%4]}} />)}</div>}
    {warrantyOrder && <WarrantyDialog orderId={warrantyOrder.id} customer={String(data.customers.find(c=>c.id===warrantyOrder.customer_id)?.name || 'Cliente não identificado')} vehicle={(()=>{const v=data.vehicles.find(v=>v.id===warrantyOrder.vehicle_id);return v ? [v.brand,v.model,v.plate].filter(Boolean).join(' · ') : 'Não informado'})()} technician={String(warrantyOrder.technician || '')} finishedAt={String(warrantyOrder.finished_at || '')} onClose={()=>setWarrantyOrder(null)}/>}
    {saleDetails && page === 'sales' && (() => {
      const sale = data.sales.find(r => r.id === saleDetails.id) || saleDetails
      const info = installmentDetails[sale.id]
      const count = Math.max(1, Number(info?.installments || sale.installments || 1))
      const totalCents = Math.round(Number(info?.total_amount ?? sale.amount ?? 0) * 100)
      const base = Number(info?.base_amount ?? sale.amount ?? 0)
      const fee = Number(info?.fee_amount ?? 0)
      const client = data.customers.find(c => c.id === sale.customer_id)
      const vehicle = data.vehicles.find(v => v.id === sale.vehicle_id)
      const items = saleItemRows.filter(item => item.sale_id === sale.id)
      const method = ({credit_card:'Cartão de crédito',debit_card:'Cartão de débito',pix:'PIX',cash:'Dinheiro',transfer:'Transferência'} as Record<string,string>)[String(sale.method)] || String(sale.method || 'Não informado')
      const summary = `Venda: ${String(sale.description || '')}\nCliente: ${String(client?.name || 'Não informado')}\nPagamento: ${method} · ${count}x\nValor original: ${currency(base)}\nTaxa: ${Number(info?.rate_percent || 0)}% (${currency(fee)})\nTotal: ${currency(totalCents/100)}`
      return <div className="ap-detail-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSaleDetails(null)}}>
        <aside className="ap-detail-drawer" role="dialog" aria-modal="true" aria-label="Detalhes da venda">
          <div className="ap-detail-head"><div><div className="eyebrow">AUTO PERFORMANCE / VENDAS</div><h2>Detalhes da venda</h2></div><button className="icon-btn" type="button" onClick={()=>setSaleDetails(null)} aria-label="Fechar detalhes"><X size={21}/></button></div>
          <div className="ap-detail-body">
            <div className="ap-detail-total"><span>Total cobrado</span><strong>{currency(totalCents/100)}</strong><small>{sale.status==='cancelled'?'Cancelada':'Venda registrada'} · {String(sale.date || '')}</small></div>
            <section className="ap-detail-section"><h3>Pagamento</h3><div className="ap-detail-line"><span>Forma de pagamento</span><b>{method}</b></div><div className="ap-detail-line"><span>Parcelas</span><b>{count}x</b></div><div className="ap-detail-line"><span>Valor original</span><b>{currency(base)}</b></div><div className="ap-detail-line"><span>Taxa aplicada</span><b>{info?`${info.rate_percent}%`:'Não registrada'}</b></div><div className="ap-detail-line"><span>Acréscimo</span><b>{info?currency(fee):'Não registrado'}</b></div><div className="ap-detail-line ap-detail-emphasis"><span>Valor final</span><b>{currency(totalCents/100)}</b></div></section>
            {info && count > 1 && <section className="ap-detail-section"><h3>Divisão das parcelas</h3><p className="ap-detail-hint">Valores informativos. O recebimento é lançado integralmente na venda.</p>{Array.from({length:Math.min(count,24)},(_,i)=>{const basic=Math.floor(totalCents/count);const cents=basic+(i<totalCents%count?1:0);return <div className="ap-detail-line" key={i}><span>Parcela {String(i+1).padStart(2,'0')}/{String(count).padStart(2,'0')}</span><b>{currency(cents/100)}</b></div>})}</section>}
            <section className="ap-detail-section"><h3>Cliente e veículo</h3><div className="ap-detail-line"><span>Cliente</span><b>{String(client?.name || 'Não informado')}</b></div><div className="ap-detail-line"><span>Veículo</span><b>{String(vehicle?.plate || 'Não vinculado')}</b></div><div className="ap-detail-line"><span>Descrição</span><b>{String(sale.description || 'Venda')}</b></div></section>
            {items.length>0 && <section className="ap-detail-section"><h3>Itens da venda</h3>{items.map((item,i)=><div className="ap-detail-line" key={i}><span>{item.quantity}x {item.item_type==='product'?(data.products.find(p=>p.id===item.product_id)?.name || 'Produto'):(data.services.find(p=>p.id===item.service_id)?.name || 'Serviço')}</span><b>{currency(Number(item.unit_price)*Number(item.quantity))}</b></div>)}</section>}
            <button type="button" className="outline-btn ap-detail-copy" onClick={()=>{void navigator.clipboard.writeText(summary).then(()=>alert('Resumo copiado!')).catch(()=>alert('Não foi possível copiar o resumo.'))}}>Copiar resumo da venda</button>
          </div>
        </aside>
      </div>
    })()}
    {modal && config[page] && <div className="modal-backdrop" onMouseDown={e => { if(e.target === e.currentTarget) setModal(false) }}><div className="modal"><div className="modal-head"><div><div className="eyebrow">{editing ? 'EDITAR' : 'CADASTRAR'}</div><h2>{config[page].title}</h2></div><button className="icon-btn" onClick={() => setModal(false)} aria-label="Fechar"><X size={21}/></button></div><form onSubmit={e => { e.preventDefault(); save() }}>
      {page === 'sales' && !editing && <div className="quick-sale-relations">
        <h3>Cliente</h3>
        <label>Como identificar o cliente?
          <select className="select" value={form.customer_mode || 'existing'} onChange={e => setForm(old => ({ ...old, customer_mode:e.target.value, customer_id:'', vehicle_id:'', vehicle_mode:'none' }))}>
            <option value="existing">Selecionar cliente cadastrado</option>
            <option value="new">+ Cadastrar cliente nesta venda</option>
          </select>
        </label>
        {form.customer_mode === 'new' ? <div className="quick-sale-grid">
          <label>Nome completo *<input required value={form.new_customer_name || ''} onChange={e => setForm(old => ({ ...old, new_customer_name:e.target.value }))}/></label>
          <label>Telefone<input value={form.new_customer_phone || ''} onChange={e => setForm(old => ({ ...old, new_customer_phone:e.target.value }))}/></label>
          <label>CPF/CNPJ<input value={form.new_customer_document || ''} onChange={e => setForm(old => ({ ...old, new_customer_document:e.target.value }))}/></label>
          <label>E-mail<input type="email" value={form.new_customer_email || ''} onChange={e => setForm(old => ({ ...old, new_customer_email:e.target.value }))}/></label>
        </div> : <label>Cliente existente
          <select className="select" value={form.customer_id || ''} onChange={e => setForm(old => ({ ...old, customer_id:e.target.value, vehicle_id:'', vehicle_mode:'none' }))}>
            <option value="">Venda de balcão / sem cliente</option>
            {data.customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `· ${c.phone}` : ''}</option>)}
          </select>
        </label>}
        <h3>Veículo</h3>
        <label>Veículo da venda
          <select className="select" value={form.vehicle_mode || 'none'} onChange={e => setForm(old => ({ ...old, vehicle_mode:e.target.value, vehicle_id:'' }))}>
            <option value="none">Venda sem veículo</option>
            {form.customer_mode !== 'new' && form.customer_id && <option value="existing">Selecionar veículo cadastrado</option>}
            <option value="new">+ Cadastrar veículo nesta venda</option>
          </select>
        </label>
        {form.vehicle_mode === 'existing' && <label>Veículo cadastrado
          <select className="select" value={form.vehicle_id || ''} onChange={e => setForm(old => ({ ...old, vehicle_id:e.target.value }))} required>
            <option value="">Selecione o veículo</option>
            {data.vehicles.filter(v => v.customer_id === form.customer_id).map(v => <option key={v.id} value={v.id}>{v.plate} · {v.brand} {v.model}</option>)}
          </select>
        </label>}
        {form.vehicle_mode === 'new' && <div className="quick-sale-grid">
          <label>Placa *<input required maxLength={8} value={form.new_vehicle_plate || ''} onChange={e => setForm(old => ({ ...old, new_vehicle_plate:e.target.value.toUpperCase() }))}/></label>
          <label>Marca<input value={form.new_vehicle_brand || ''} onChange={e => setForm(old => ({ ...old, new_vehicle_brand:e.target.value }))}/></label>
          <label>Modelo *<input required value={form.new_vehicle_model || ''} onChange={e => setForm(old => ({ ...old, new_vehicle_model:e.target.value }))}/></label>
          <label>Ano<input type="number" min="1900" max="2100" value={form.new_vehicle_year || ''} onChange={e => setForm(old => ({ ...old, new_vehicle_year:e.target.value }))}/></label>
        </div>}
        <p>Cliente e veículo novos serão cadastrados automaticamente ao finalizar a venda.</p>
      </div>}
      {page === 'sales' && !editing && <section className="ap-sale-items">
        <h3>Produtos e serviços da venda</h3><p>Selecione itens cadastrados. A baixa de estoque ocorre somente ao finalizar a venda.</p>
        {stockError&&<p className="ap-stock-hint">Para vendas com produtos, execute o SQL de estoque: {stockError}</p>}
        <div className="ap-sale-picker">
          <label>Tipo<select className="select" value={pickType} onChange={e=>{setPickType(e.target.value as 'product'|'service');setPickId('');setPickLocation('')}}><option value="product">Produto</option><option value="service">Serviço</option></select></label>
          <label>Item<select className="select" value={pickId} onChange={e=>{setPickId(e.target.value);setPickLocation('')}}><option value="">Selecione</option>{(pickType==='product'?data.products:data.services).map(p=><option key={p.id} value={p.id}>{p.name} · {currency(Number(p.price||0))}</option>)}</select></label>
          {pickType==='product'&&<label>Estoque de origem<select className="select" value={pickLocation} onChange={e=>setPickLocation(e.target.value)}><option value="">Selecione</option>{stockLocations.map(l=><option key={l.id} value={l.id}>{l.name} · {stockBalances.find(b=>b.location_id===l.id&&b.product_id===pickId)?.quantity??0} disponível</option>)}</select></label>}
          <label>Quantidade<input type="number" min="1" step="1" value={pickQty} onChange={e=>setPickQty(e.target.value)}/></label>
          <button type="button" className="outline-btn" onClick={()=>{
            const n=Number(pickQty);if(!pickId||!Number.isInteger(n)||n<=0){alert('Selecione um item e quantidade inteira positiva.');return}
            if(pickType==='product'){
              if(!pickLocation){alert('Selecione o estoque de origem.');return}
              const available=Number(stockBalances.find(b=>b.location_id===pickLocation&&b.product_id===pickId)?.quantity||0)
              const already=saleItems.filter(i=>i.type==='product'&&i.id===pickId&&i.location_id===pickLocation).reduce((sum,i)=>sum+i.quantity,0)
              if(already+n>available){alert(`Estoque insuficiente: ${available-already} unidade(s) disponíveis.`);return}
            }
            setSaleItems(old=>{const idx=old.findIndex(i=>i.type===pickType&&i.id===pickId&&i.location_id===(pickType==='product'?pickLocation:undefined));if(idx<0)return [...old,{type:pickType,id:pickId,quantity:n,...(pickType==='product'?{location_id:pickLocation}:{})}];return old.map((i,j)=>j===idx?{...i,quantity:i.quantity+n}:i)})
            setPickId('');setPickQty('1')
          }}>+ Adicionar item</button>
        </div>
        {saleItems.map((item,i)=><div className="ap-sale-item" key={`${item.type}-${item.id}-${item.location_id||''}`}><span>{(item.type==='product'?data.products:data.services).find(p=>p.id===item.id)?.name||'Item'} · {item.quantity} × {currency(saleItemPrice({...item,quantity:1}))}</span><strong>{currency(saleItemPrice(item))}</strong><button type="button" className="icon-btn" onClick={()=>setSaleItems(old=>old.filter((_,j)=>j!==i))} aria-label="Remover item"><Trash2 size={15}/></button></div>)}
        {saleItems.length>0&&<><div className="ap-sale-item-total"><strong>Subtotal: {currency(saleItemTotal)}</strong><label>Desconto (R$)<input type="number" min="0" max={saleItemTotal} step="0.01" value={form.discount||'0'} onChange={e=>setForm(old=>({...old,discount:e.target.value}))}/></label><strong>Total: {currency(Math.max(0,saleItemTotal-Number(form.discount||0)))}</strong></div><p>Preço e custo são conferidos novamente pelo servidor. Cliente e veículo novos devem ser cadastrados antes desta venda.</p></>}
        <small>Sem itens selecionados, a venda avulsa atual continua disponível.</small>
      </section>}
      {page === 'products' && editing && <p className="ap-stock-hint">A quantidade é controlada exclusivamente em Controle de estoque. Alterações aqui não modificam o saldo.</p>}
      {page === 'expenses' && <div className="ap-expense-options"><label>Situação da despesa<select className="select" value={form.status || 'paid'} onChange={e=>setForm(old=>({...old,status:e.target.value}))}><option value="paid">Paga — movimentar o caixa</option><option value="pending">Pendente — não movimentar o caixa</option></select></label>{form.status !== 'pending' && <label>Forma de pagamento<select className="select" value={form.payment_method || 'pix'} onChange={e=>setForm(old=>({...old,payment_method:e.target.value}))}><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="debit">Débito</option><option value="credit">Crédito</option><option value="transfer">Transferência</option><option value="other">Outro</option></select></label>}</div>}
      <div className="form-grid">{config[page].fields.filter(f => !(page === 'products' && editing && f.key === 'quantity') && !(page === 'sales' && (f.key === 'customer_id' || f.key === 'vehicle_id' || (saleItems.length>0 && ['description','amount','cost'].includes(f.key)) || (f.key === 'installments' && form.method !== 'credit')))).map(f => <label key={f.key}>{f.label}{f.required && <span className="required"> *</span>}{(['vehicles','quotes','work_orders'].includes(page) && f.key === 'customer_id') ? <select className="select" value={form.customer_id || ''} onChange={e => setForm(old => ({ ...old, customer_id: e.target.value, vehicle_id: '', quote_id: '' }))}><option value="">{page === 'vehicles' ? 'Sem proprietário' : 'Selecione o cliente'}</option>{data.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : (['quotes','work_orders','sales'].includes(page) && f.key === 'vehicle_id') ? <select className="select" value={form.vehicle_id || ''} onChange={e => setForm(old => ({ ...old, vehicle_id: e.target.value }))}><option value="">Sem veículo</option>{data.vehicles.filter(v => !v.customer_id || v.customer_id === form.customer_id).map(v => <option key={v.id} value={v.id}>{v.plate || v.model || v.id.slice(0,8)}</option>)}</select> : (page === 'work_orders' && f.key === 'quote_id') ? <select className="select" value={form.quote_id || ''} onChange={e => setForm(old => ({ ...old, quote_id: e.target.value }))}><option value="">Sem orçamento</option>{data.quotes.filter(q => q.status === 'approved' && q.customer_id === form.customer_id).map(q => <option key={q.id} value={q.id}>Orçamento {q.id.slice(0,8)} · {currency(number(q.amount))}</option>)}</select> : (page === 'quotes' && f.key === 'item_type') ? <select className="select" value={form.item_type || 'service'} onChange={e => setForm(old => ({ ...old, item_type: e.target.value, item_id: '', unit_price: '' }))}><option value="service">Serviço</option><option value="product">Produto</option></select> : (page === 'quotes' && f.key === 'item_id') ? <select className="select" value={form.item_id || ''} onChange={e => { const item = (form.item_type === 'product' ? data.products : data.services).find(i => i.id === e.target.value); setForm(old => ({ ...old, item_id: e.target.value, unit_price: item ? String(item.price || 0) : '' })) }}><option value="">Sem item</option>{(form.item_type === 'product' ? data.products : data.services).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select> : (['quotes','work_orders'].includes(page) && f.key === 'status') ? <select className="select" value={form.status || (page === 'quotes' ? 'open' : 'waiting')} onChange={e => setForm(old => ({ ...old, status: e.target.value }))}>{(page === 'quotes' ? [['open','Aberto'],['approved','Aprovado'],['rejected','Recusado']] : [['waiting','Aguardando'],['in_progress','Em andamento'],['finished','Concluída'],['delivered','Entregue'],['cancelled','Cancelada']]).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select> : (page === 'cash_entries' && f.key === 'kind') ? <select className="select" value={form.kind || 'income'} onChange={e => setForm(old => ({...old,kind:e.target.value}))}><option value="income">Entrada — dinheiro recebido</option><option value="expense">Saída — dinheiro pago</option></select> : (page === 'sales' && f.key === 'method') ? <select className="select" value={['pix','cash','debit','credit'].includes(form.method || '') ? form.method : form.method ? 'legacy' : ''} onChange={e => setForm(old => ({ ...old, method: e.target.value, installments: '1' }))} required><option value="" disabled>Selecione a forma de pagamento</option>{form.method && !['pix','cash','debit','credit'].includes(form.method) && <option value="legacy" disabled>Anterior: {form.method} — selecione uma opção</option>}<option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="debit">Cartão de débito</option><option value="credit">Cartão de crédito</option></select> : (page === 'sales' && f.key === 'installments') ? <><select className="select" value={form.installments || '1'} onChange={e => setForm(old => ({ ...old, installments: e.target.value }))}>{Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}x — {cardRates[n]===undefined?'taxa não configurada':cardRates[n]+'%'}</option>)}</select><small style={{ display: 'block', marginTop: 6, opacity: .8 }}>Acréscimo: {currency(Math.round((saleItems.length?Math.max(0,saleItemTotal-number(form.discount)):number(form.amount))*(cardRates[Number(form.installments||1)]||0))/100)} · Total: {currency(Math.round((saleItems.length?Math.max(0,saleItemTotal-number(form.discount)):number(form.amount))*(1+(cardRates[Number(form.installments||1)]||0)/100)*100)/100)} · Parcela aproximada: {currency((Math.round((saleItems.length?Math.max(0,saleItemTotal-number(form.discount)):number(form.amount))*(1+(cardRates[Number(form.installments||1)]||0)/100)*100)/100)/Math.max(1,Number(form.installments||1)))}</small></> : <input type={f.type || 'text'} step={f.type === 'number' ? 'any' : undefined} min={f.type === 'number' ? '0' : undefined} value={form[f.key] || ''} onChange={e => setForm(old => ({ ...old, [f.key]: e.target.value }))} required={f.required}/>}</label>)}</div><div className="modal-actions"><button type="button" className="outline-btn" onClick={() => setModal(false)}>Cancelar</button><button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar'}</button></div></form></div></div>}

  </div>

}

function Kpi({icon:Icon,label,value,foot,tone}:{icon:typeof Activity;label:string;value:string;foot:string;tone:string}) { return <div className="kpi-card"><div className="kpi-top"><span>{label}</span><span className={`kpi-icon ${tone}`}><Icon size={19}/></span></div><strong>{value}</strong><small>{foot}</small></div> }

function Pulse({icon:Icon,label,value}:{icon:typeof Activity;label:string;value:string}) { return <div className="pulse-row"><span><Icon size={17}/>{label}</span><strong>{value}</strong></div> }

function Empty({text}:{text:string}) { return <div className="empty-state"><Boxes size={30}/><strong>Sem dados por enquanto</strong><p>{text}</p></div> }

export default App
