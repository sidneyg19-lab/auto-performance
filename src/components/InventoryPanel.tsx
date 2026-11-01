
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import './InventoryPanel.css'

type Product = {
  id: string
  name?: string
  label?: string
  title?: string
  sku?: string
  price?: number
  quantity?: number
  minimum?: number
  cost?: number
}

type Location = {
  id: string
  name: string
  active: boolean
}

type Balance = {
  location_id: string
  product_id: string
  quantity: number
}

type Movement = {
  id: string
  location_id: string
  product_id: string
  quantity_delta: number
  reason: string
  created_at: string
}

export default function InventoryPanel({
  orgId,
  products,
  onUpdated
}: {
  orgId: string
  products: Product[]
  onUpdated: () => void
}) {
  const [tab, setTab] = useState<'stocks' | 'moves'>('stocks')
  const [locations, setLocations] = useState<Location[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const movingRef = useRef(false)

  const [name, setName] = useState('')
  const [product, setProduct] = useState('')
  const [location, setLocation] = useState('')
  const [destination, setDestination] = useState('')
  const [qty, setQty] = useState('1')
  const [reason, setReason] = useState('entry')

  const productName = (p: Product) =>
    String(p.label || p.name || p.title || '').trim() ||
    `Produto ${p.id.slice(0, 8)}`

  const label = (id: string) => {
    const p = products.find(item => item.id === id)
    return p ? productName(p) : `Produto ${id.slice(0, 8)}`
  }

  const load = useCallback(async () => {
    const [l, b, m] = await Promise.all([
      supabase
        .from('ap_stock_locations')
        .select('*')
        .eq('organization_id', orgId)
        .order('name'),

      supabase
        .from('ap_stock_balances')
        .select('*')
        .eq('organization_id', orgId),

      supabase
        .from('ap_stock_movements')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(100)
    ])

    const e = l.error || b.error || m.error

    if (e) {
      setError('Erro ao carregar o estoque: ' + e.message)
      return
    }

    setLocations(l.data || [])
    setBalances(b.data || [])
    setMovements(m.data || [])
  }, [orgId])

  useEffect(() => {
    void load()
  }, [load])

  async function createLocation() {
    if (!name.trim() || loading) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const { error: e } = await supabase.rpc(
        'ap_stock_create_location',
        {
          p_org: orgId,
          p_name: name.trim()
        }
      )

      if (e) throw e

      setName('')
      await load()
      setSuccess('Local de estoque criado com sucesso!')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível criar o estoque.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function move() {
    if (movingRef.current) return

    const n = Number(qty)

    if (
      !product ||
      !location ||
      !Number.isFinite(n) ||
      n <= 0
    ) {
      setError('Selecione produto, estoque e quantidade válida.')
      setSuccess('')
      return
    }

    if (
      reason === 'transfer' &&
      (!destination || destination === location)
    ) {
      setError(
        'Selecione um estoque de destino diferente da origem.'
      )
      setSuccess('')
      return
    }

    movingRef.current = true
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const { error: e } = await supabase.rpc(
        'ap_stock_adjust',
        {
          p_org: orgId,
          p_product: product,
          p_location: location,
          p_delta: reason === 'entry' ? n : -n,
          p_reason: reason,
          p_destination:
            reason === 'transfer' ? destination : null
        }
      )

      if (e) throw e

      await load()

      const operationName =
        reason === 'entry'
          ? 'Entrada'
          : reason === 'exit'
            ? 'Saída'
            : reason === 'transfer'
              ? 'Transferência'
              : 'Ajuste'

      setSuccess(
        `${operationName} de ${n} unidade(s) registrada com sucesso!`
      )

      setQty('1')

      // Atualiza os indicadores do painel sem recarregar
      // a página inteira.
      onUpdated()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível registrar a movimentação.'
      )
    } finally {
      movingRef.current = false
      setLoading(false)
    }
  }

  const total = (id: string) =>
    balances
      .filter(b => b.product_id === id)
      .reduce((a, b) => a + Number(b.quantity), 0)

  const movementNames: Record<string, string> = {
    entry: 'Entrada',
    exit: 'Saída',
    transfer_in: 'Transferência recebida',
    transfer_out: 'Transferência enviada',
    sale: 'Venda',
    sale_reversal: 'Estorno de venda',
    adjustment: 'Ajuste'
  }

  return (
    <section className="panel ap-inventory">
      <div className="panel-head">
        <div>
          <h3>Controle de estoques</h3>
          <p>Acompanhe os saldos por local e o histórico de movimentações</p>
        </div>
      </div>

      <div className="ap-inventory-tabs">
        <button
          type="button"
          className={tab === 'stocks' ? 'active' : ''}
          onClick={() => setTab('stocks')}
        >
          Estoques e saldos
        </button>

        <button
          type="button"
          className={tab === 'moves' ? 'active' : ''}
          onClick={() => setTab('moves')}
        >
          Movimentações
        </button>
      </div>

      {error && (
        <div className="notice" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#34d399'
          }}
        >
          ✓ {success}
        </div>
      )}

      {tab === 'stocks' ? (
        <>
          <div className="ap-inventory-grid">
            <label>
              Novo local de estoque
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex.: Depósito, Loja, Prateleira A"
              />
            </label>

            <button
              type="button"
              className="primary-btn"
              disabled={loading || !name.trim()}
              onClick={createLocation}
            >
              {loading ? 'Processando...' : 'Criar estoque'}
            </button>
          </div>

          <div className="ap-stock-table">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  {locations.map(l => (
                    <th key={l.id}>{l.name}</th>
                  ))}
                  <th>Total</th>
                  <th>Mínimo</th>
                  <th>Situação</th>
                </tr>
              </thead>

              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td>{productName(p)}</td>

                    {locations.map(l => (
                      <td key={l.id}>
                        {balances.find(
                          b =>
                            b.product_id === p.id &&
                            b.location_id === l.id
                        )?.quantity ?? 0}
                      </td>
                    ))}

                    <td>{total(p.id)}</td>
                    <td>{p.minimum ?? 0}</td>
                    <td>{total(p.id) <= 0 ? 'Sem estoque' : Number(p.minimum || 0) > 0 && total(p.id) <= Number(p.minimum) ? 'Estoque baixo' : 'Normal'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4>Entrada, saída ou transferência</h4>

          <div className="ap-inventory-grid">
            <label>
              Produto
              <select
                className="select"
                value={product}
                onChange={e => setProduct(e.target.value)}
              >
                <option value="">Selecione</option>

                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {productName(p)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Estoque de origem
              <select
                className="select"
                value={location}
                onChange={e => setLocation(e.target.value)}
              >
                <option value="">Selecione</option>

                {locations
                  .filter(l => l.active)
                  .map(l => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              Operação
              <select
                className="select"
                value={reason}
                onChange={e => setReason(e.target.value)}
              >
                <option value="entry">Entrada</option>
                <option value="exit">Saída</option>
                <option value="transfer">Transferência</option>
                <option value="adjustment">Ajuste negativo</option>
              </select>
            </label>

            <label>
              Quantidade
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={qty}
                onChange={e => setQty(e.target.value)}
              />
            </label>

            {reason === 'transfer' && (
              <label>
                Destino
                <select
                  className="select"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                >
                  <option value="">Selecione</option>

                  {locations
                    .filter(
                      l => l.active && l.id !== location
                    )
                    .map(l => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>

          <button
            type="button"
            className="primary-btn"
            disabled={
              loading ||
              !product ||
              !location ||
              (reason === 'transfer' && !destination)
            }
            onClick={move}
          >
            {loading
              ? 'Processando movimentação...'
              : 'Confirmar movimentação'}
          </button>
        </>
      ) : (
        <div className="ap-stock-table">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Produto</th>
                <th>Estoque</th>
                <th>Motivo</th>
                <th>Quantidade</th>
              </tr>
            </thead>

            <tbody>
              {movements.map(m => (
                <tr key={m.id}>
                  <td>
                    {new Date(m.created_at).toLocaleString('pt-BR')}
                  </td>

                  <td>{label(m.product_id)}</td>

                  <td>
                    {locations.find(
                      l => l.id === m.location_id
                    )?.name || '—'}
                  </td>

                  <td>
                    {movementNames[m.reason] || m.reason}
                  </td>

                  <td
                    style={{
                      color:
                        m.quantity_delta > 0
                          ? '#34d399'
                          : '#fb7185'
                    }}
                  >
                    {m.quantity_delta > 0 ? '+' : ''}
                    {m.quantity_delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
