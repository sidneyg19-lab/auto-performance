import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Receivable = { id:string; sale_id:string; amount:number; due_date:string; invoice_number:string|null; created_at:string }
type Receipt = { receivable_id:string; payment_id:string; payments:{ amount:number; method:string; paid_at:string } | null }
type Sale = { id:string; customer_id:string|null; discount:number|null; total:number|null }
type Customer = { id:string; name:string; phone:string|null; document:string|null; email:string|null }
type Item = { sale_id:string; description:string; quantity:number; unit_price:number }
const brl=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n)
const localDay=()=>new Date().toLocaleDateString('en-CA')
export default function ReceivablesPanel({orgId,onReceived,canReceive}:{orgId:string;onReceived:()=>Promise<void>;canReceive:boolean}){
 const [rows,setRows]=useState<Receivable[]>([])
 const [receipts,setReceipts]=useState<Receipt[]>([])
 const [sales,setSales]=useState<Sale[]>([])
 const [customers,setCustomers]=useState<Customer[]>([])
 const [items,setItems]=useState<Item[]>([])
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const [expanded,setExpanded]=useState<string|null>(null)
 const [amount,setAmount]=useState('')
 const [method,setMethod]=useState('pix')
 const load=useCallback(async()=>{
  const [a,b,c,d,e]=await Promise.all([
   supabase.from('ap_receivables').select('*').eq('organization_id',orgId).order('due_date'),
   supabase.from('ap_receivable_receipts').select('receivable_id,payment_id,payments(amount,method,paid_at)').eq('organization_id',orgId),
   supabase.from('sales').select('id,customer_id,discount,total').eq('organization_id',orgId),
   supabase.from('customers').select('id,name,phone,document,email').eq('organization_id',orgId),
   supabase.from('sale_items').select('sale_id,description,quantity,unit_price').eq('organization_id',orgId)
  ])
  const err=[a,b,c,d,e].find(x=>x.error)?.error
  if(err){setError(err.message);return}
  setRows((a.data||[]) as Receivable[])
  setReceipts((b.data||[]) as unknown as Receipt[])
  setSales((c.data||[]) as Sale[])
  setCustomers((d.data||[]) as Customer[])
  setItems((e.data||[]) as Item[])
  setError('')
 },[orgId])
 useEffect(()=>{void load()},[load])
 const paid=(id:string)=>receipts.filter(r=>r.receivable_id===id).reduce((n,r)=>n+Number(r.payments?.amount||0),0)
 const balance=(r:Receivable)=>Math.max(0,Math.round((Number(r.amount)-paid(r.id))*100)/100)
 const status=(r:Receivable)=>balance(r)===0?'Quitado':r.due_date<localDay()?'Vencido':paid(r.id)>0?'Parcialmente recebido':r.due_date===localDay()?'Vence hoje':'A receber'
 const dueSoon=rows.filter(r=>balance(r)>0&&r.due_date<=new Date(Date.now()+5*86400000).toLocaleDateString('en-CA'))
 async function receive(r:Receivable){
  const n=Number(amount)
  if(!Number.isFinite(n)||n<=0||n>balance(r)){alert('Informe um valor positivo até o saldo devedor.');return}
  if(!window.confirm(`Confirmar recebimento de ${brl(n)}? Essa ação registrará entrada financeira.`))return
  setBusy(true)
  const {error:err}=await supabase.rpc('ap_receive_credit_sale',{p_org:orgId,p_receivable:r.id,p_amount:n,p_method:method})
  if(err){alert(err.message)}else{setAmount('');await load();await onReceived()}
  setBusy(false)
 }
 function whatsapp(r:Receivable){
  const sale=sales.find(s=>s.id===r.sale_id)
  const customer=customers.find(c=>c.id===sale?.customer_id)
  const phone=String(customer?.phone||'').replace(/\D/g,'')
  if(!phone){alert('Cadastre o telefone do cliente antes de cobrar pelo WhatsApp.');return}
  const destination=phone.length===10||phone.length===11?'55'+phone:phone
  const message=`Olá, ${customer?.name||''}! Tudo bem? Entramos em contato sobre a venda ${r.sale_id.slice(0,8)}${r.invoice_number?' (NF '+r.invoice_number+')':''}, com saldo de ${brl(balance(r))} e vencimento em ${r.due_date.split('-').reverse().join('/')}. Poderia nos informar a previsão de pagamento? Obrigado!`
  window.open(`https://wa.me/${destination}?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer')
 }
 return <div style={{padding:24}}>
  <div className="page-heading"><div><h1>Contas a receber</h1><p>Vendas faturadas, vencimentos e recebimentos reais</p></div><button className="outline-btn" onClick={()=>void load()}>Atualizar</button></div>
  {error&&<div className="notice">Não foi possível consultar contas a receber: {error}</div>}
  <div className="module-stats"><div className="stat-block"><small>Saldo em aberto</small><strong>{brl(rows.reduce((n,r)=>n+balance(r),0))}</strong></div><div className="stat-block"><small>Vencidas</small><strong>{rows.filter(r=>balance(r)>0&&r.due_date<localDay()).length}</strong></div><div className="stat-block"><small>Vencendo em até 5 dias (inclui atrasadas)</small><strong>{dueSoon.length}</strong></div></div>
  <section className="panel" style={{padding:18}}>{rows.length===0?<p>Nenhuma venda a prazo cadastrada.</p>:rows.map(r=>{
   const sale=sales.find(s=>s.id===r.sale_id);const customer=customers.find(c=>c.id===sale?.customer_id)
   return <div key={r.id} style={{padding:'16px 0',borderBottom:'1px solid #65708a44'}}>
    <div style={{display:'flex',gap:14,justifyContent:'space-between',flexWrap:'wrap',alignItems:'center'}}><div><strong>{customer?.name||'Cliente não encontrado'}</strong><p>Venda {r.sale_id.slice(0,8)} · NF {r.invoice_number||'não informada'} · Vencimento {r.due_date.split('-').reverse().join('/')}</p><small>{customer?.document||'Sem CPF/CNPJ'} · {customer?.email||'Sem e-mail'}</small></div><div><strong>{brl(balance(r))}</strong><p>{status(r)} · Total {brl(Number(r.amount))}</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="outline-btn" onClick={()=>{setExpanded(expanded===r.id?null:r.id);setAmount(String(balance(r).toFixed(2)))}}>{expanded===r.id?'Fechar':'Detalhes / receber'}</button>{balance(r)>0&&<button className="outline-btn" onClick={()=>whatsapp(r)}>Cobrar no WhatsApp</button>}</div></div>
    {expanded===r.id&&<div style={{marginTop:14}}><h4>Itens vendidos</h4>{items.filter(i=>i.sale_id===r.sale_id).map((i,n)=><p key={n}>{i.description} · {i.quantity} × {brl(Number(i.unit_price))} = {brl(Number(i.quantity)*Number(i.unit_price))}</p>)}<p>Desconto: {brl(Number(sale?.discount||0))}</p><h4>Histórico de recebimentos</h4>{receipts.filter(x=>x.receivable_id===r.id).map(x=><p key={x.payment_id}>{x.payments?.paid_at?.slice(0,10)} · {x.payments?.method} · {brl(Number(x.payments?.amount||0))}</p>)}{paid(r.id)===0&&<p>Nenhum recebimento registrado.</p>}
     {canReceive&&balance(r)>0&&<div className="form-grid" style={{marginTop:10}}><label>Valor recebido<input type="number" min="0.01" step="0.01" max={balance(r)} value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Forma de recebimento<select className="select" value={method} onChange={e=>setMethod(e.target.value)}><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="debit_card">Débito</option><option value="credit_card">Crédito</option></select></label><button className="primary-btn" disabled={busy} onClick={()=>void receive(r)}>{busy?'Processando…':'Confirmar recebimento'}</button></div>}
    </div>}
   </div>
  })}</section>
 </div>
}
