import { useEffect, useState } from 'react'
import { Printer, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Accessory = { name: string; model: string; price: string }
type Props = { organizationId: string; saleId: string; orderId: string; customer: string; vehicle: string; technician: string; finishedAt: string; onClose: () => void }
type Draft = { equipment: string; model: string; serial: string; term: string; coverage: string; exclusions: string; guidance: string; accessories: Accessory[] }
const escapeHtml = (v: string) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c))
const money = (v: string) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const initial: Draft = {
  equipment: '', model: '', serial: '', term: '',
  coverage: 'Cobertura conforme a garantia informada para o equipamento e para o serviço executado, respeitando os direitos previstos na legislação aplicável.',
  exclusions: 'As condições de exclusão devem ser informadas ao cliente e não afastam os direitos previstos em lei.',
  guidance: 'Guarde este termo e o comprovante de compra. Em caso de problema, entre em contato com a loja.',
  accessories: []
}
const fieldStyle: React.CSSProperties = { background: '#0e182c', color: '#eef4ff', border: '1px solid #354666', borderRadius: 8, padding: '11px 12px', width: '100%', minWidth: 0, boxSizing: 'border-box' }
const panelStyle: React.CSSProperties = { background: '#111d34', border: '1px solid #334461', borderRadius: 12, padding: 15, marginTop: 14 }
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12, fontWeight: 600, color: '#bcd0ee' }

export default function WarrantyDialog({ organizationId, saleId, orderId, customer, vehicle, technician, finishedAt, onClose }: Props) {
  const storageKey = `auto-performance-warranty-${orderId}`
  const [draft, setDraft] = useState<Draft>(() => {
    try { const saved = localStorage.getItem(storageKey); return saved ? { ...initial, ...JSON.parse(saved) } : initial } catch { return initial }
  })
  const [persistError,setPersistError]=useState('')
  const [persisted,setPersisted]=useState(false)
  useEffect(()=>{let active=true;void (async()=>{
    const {data,error}=await supabase.from('ap_warranties').select('details').eq('organization_id',organizationId).eq('work_order_id',orderId).maybeSingle()
    if(!active)return
    if(error){setPersistError(error.message);return}
    if(data?.details && typeof data.details==='object'){setDraft({...initial,...data.details as Draft});setPersisted(true)}
  })();return()=>{active=false}},[organizationId,orderId])
  async function saveWarranty(){
    if(!draft.equipment.trim()||!draft.term.trim()){alert('Informe equipamento e prazo de garantia.');return false}
    const {error}=await supabase.from('ap_warranties').upsert({organization_id:organizationId,work_order_id:orderId,sale_id:saleId||null,details:draft},{onConflict:'organization_id,work_order_id'})
    if(error){setPersistError(error.message);alert('Não foi possível salvar garantia: '+error.message);return false}
    setPersisted(true);setPersistError('');return true
  }
  const change = (field: keyof Omit<Draft, 'accessories'>, value: string) => setDraft(old => ({ ...old, [field]: value }))
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(draft)) } catch { /* armazenamento indisponível */ } }, [storageKey, draft])
  const add = () => setDraft(old => ({ ...old, accessories: [...old.accessories, { name: '', model: '', price: '' }] }))
  const updateAccessory = (i: number, field: keyof Accessory, value: string) => setDraft(old => ({ ...old, accessories: old.accessories.map((a, j) => j === i ? { ...a, [field]: value } : a) }))
  const total = draft.accessories.reduce((sum, a) => sum + (Number(a.price) || 0), 0)
  const date = finishedAt && !Number.isNaN(Date.parse(finishedAt)) ? new Date(finishedAt).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')

  async function print() {
    if(!await saveWarranty())return
    if (!draft.equipment.trim() || !draft.term.trim()) { alert('Informe o equipamento e o prazo de garantia.'); return }
    const box = (label: string, value: string) => `<div class="cell"><span class="caption">${escapeHtml(label)}</span><strong>${escapeHtml(value || 'Não informado')}</strong></div>`
    const clause = (number: string, title: string, content: string) => `<div class="clause"><b class="number">${number}</b><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(content).replace(/\n/g, '<br>')}</p></div></div>`
    const rows = draft.accessories.filter(a => a.name.trim()).map(a => `<tr><td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.model)}</td><td>${money(a.price)}</td></tr>`).join('')
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Garantia OS ${escapeHtml(orderId.slice(0, 8))}</title><style>
      *{box-sizing:border-box}body{font:13px Arial,sans-serif;color:#1c2a40;margin:24px;line-height:1.45}header{border-bottom:3px solid #5267e8;padding-bottom:12px;margin-bottom:18px}header small{color:#55627c}h1{font-size:22px;margin:5px 0}h2{font-size:15px;margin:21px 0 9px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.cell,.clause{border:1px solid #cbd4e3;border-radius:7px;padding:11px;break-inside:avoid}.cell{min-height:59px}.caption{display:block;color:#596982;font-size:10px;margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px}.cell strong{font-size:12px;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd4e3;padding:9px;text-align:left}th{background:#edf1fa}.clause{display:flex;gap:12px;margin-bottom:8px}.number{background:#e9eeff;border-radius:5px;padding:7px;height:max-content}.clause p{margin:5px 0 0;white-space:normal;overflow-wrap:anywhere}.signatures{display:flex;gap:35px;margin-top:60px}.signatures div{flex:1;border-top:1px solid #444;text-align:center;padding-top:7px}.note{color:#637089;font-size:10px;margin-top:16px}@media print{@page{size:A4;margin:14mm}body{margin:0}h2{break-after:avoid}}
    </style></head><body><header><small>ALDEIR SOM AUTOMOTIVO</small><h1>TERMO DE GARANTIA E INSTALAÇÃO</h1><small>Documento comercial. Não substitui nota fiscal.</small></header>
    <h2>Identificação do atendimento</h2><div class="grid">${box('Ordem de serviço', orderId.slice(0, 8))}${box('Data de conclusão', date)}${box('Cliente', customer)}${box('Veículo', vehicle)}${box('Instalador', technician)}${box('Equipamento', draft.equipment)}${box('Marca / modelo', draft.model)}${box('Número de série', draft.serial)}</div>
    <h2>Opcionais instalados</h2><table><thead><tr><th>Item</th><th>Modelo / compatibilidade</th><th>Valor</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Nenhum opcional informado</td></tr>'}<tr><td colspan="2"><strong>Total dos opcionais informados</strong></td><td><strong>${money(String(total))}</strong></td></tr></tbody></table>
    <h2>Condições de garantia</h2>${clause('01', 'Prazo de garantia', draft.term)}${clause('02', 'Cobertura', draft.coverage)}${clause('03', 'Exclusões e limitações', draft.exclusions)}${clause('04', 'Orientações ao cliente', draft.guidance)}
    <div class="signatures"><div>Responsável pela loja</div><div>Cliente / responsável</div></div><p class="note">Emitido em ${new Date().toLocaleString('pt-BR')} pelo Auto Performance. As condições informadas não substituem os direitos legais do consumidor.</p></body></html>`
    const popup = window.open('', '_blank')
    if (!popup) { alert('Permita pop-ups para imprimir o termo.'); return }
    popup.document.open(); popup.document.write(html); popup.document.close(); popup.focus(); popup.print()
  }

  const input = (name: keyof Omit<Draft, 'accessories'>, label: string, placeholder: string, required = false) => <label style={labelStyle}>{label}{required ? ' *' : ''}<input style={fieldStyle} value={draft[name]} onChange={e => change(name, e.target.value)} placeholder={placeholder} /></label>
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="modal" style={{ maxWidth: 800, maxHeight: '92vh', overflowY: 'auto' }}>
      <div className="modal-head"><div><div className="eyebrow">DOCUMENTO DE ENTREGA</div><h2>Termo de garantia</h2></div><button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={21}/></button></div>
      <div style={{ padding: '10px 22px 22px' }}>
        <div style={panelStyle}><h3 style={{ margin: '0 0 12px' }}>01 · Dados do atendimento</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
          {([['OS', orderId.slice(0,8)], ['Cliente', customer], ['Veículo', vehicle], ['Instalador', technician || 'Não informado']] as const).map(([label, value]) => <div key={label} style={{ ...fieldStyle, minHeight: 58 }}><span style={{ fontSize: 11, color: '#a8b9d6' }}>{label}</span><div style={{ marginTop: 5, overflowWrap: 'anywhere' }}>{value}</div></div>)}
        </div></div>
        <div style={panelStyle}><h3 style={{ margin: '0 0 12px' }}>02 · Equipamento principal</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
          {input('equipment', 'Equipamento instalado', 'Central multimídia', true)}{input('model', 'Marca / modelo', 'Ex.: Aikon / modelo')}{input('serial', 'Número de série', 'Número de série')}{input('term', 'Prazo de garantia', 'Ex.: 12 meses', true)}
        </div></div>
        <div style={panelStyle}><h3 style={{ margin: '0 0 12px' }}>03 · Opcionais instalados</h3>
          {draft.accessories.map((a, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 100px 34px', gap: 8, marginBottom: 10, alignItems: 'end' }}>
            <label style={labelStyle}>Opcional<input style={fieldStyle} value={a.name} placeholder="Moldura / chicote" onChange={e => updateAccessory(i, 'name', e.target.value)}/></label>
            <label style={labelStyle}>Modelo<input style={fieldStyle} value={a.model} placeholder="Compatibilidade" onChange={e => updateAccessory(i, 'model', e.target.value)}/></label>
            <label style={labelStyle}>Valor (R$)<input style={fieldStyle} type="number" min="0" step="0.01" value={a.price} placeholder="0,00" onChange={e => updateAccessory(i, 'price', e.target.value)}/></label>
            <button type="button" className="icon-btn" aria-label="Remover opcional" onClick={() => setDraft(old => ({ ...old, accessories: old.accessories.filter((_, j) => j !== i) }))}><Trash2 size={16}/></button>
          </div>)}
          <button type="button" className="outline-btn" onClick={add}><Plus size={16}/> Adicionar opcional</button>
          <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 700 }}>Total dos opcionais: {money(String(total))}</div>
        </div>
        <div style={panelStyle}><h3 style={{ margin: '0 0 12px' }}>04 · Condições da garantia</h3>
          {([['coverage', 'Cobertura'], ['exclusions', 'Exclusões e limitações'], ['guidance', 'Orientações ao cliente']] as const).map(([key, label], i) => <label key={key} style={{ ...labelStyle, marginBottom: 12 }}><span>{String(i + 2).padStart(2, '0')} · {label}</span><textarea style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'inherit' }} rows={3} value={draft[key]} onChange={e => change(key, e.target.value)}/></label>)}
          <p style={{ fontSize: 12, color: '#afbed8', margin: 0 }}>O prazo é preenchido na seção 02. Confirme as condições com a loja; o termo não elimina a garantia legal.</p>
        </div>
        <p style={{ fontSize: 12, opacity: .85, marginTop: 12 }}>Os dados são salvos no Supabase antes de imprimir. Use Imprimir / Salvar PDF para guardar uma cópia.</p>
      </div>
      {persistError&&<p style={{color:'#ffb4b4',padding:12}}>Falha de sincronização: {persistError}</p>}{persisted&&<p style={{padding:12}}>Garantia sincronizada com Supabase.</p>}<div className="modal-actions"><button type="button" className="outline-btn" onClick={onClose}>Fechar</button><button type="button" className="outline-btn" onClick={()=>void saveWarranty()}>Salvar garantia</button><button type="button" className="primary-btn" onClick={print}><Printer size={17}/> Imprimir / Salvar PDF</button></div>
    </div>
  </div>
}
