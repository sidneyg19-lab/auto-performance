import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Camera, ChevronDown, KeyRound, LogOut, Save, UserRound, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Profile = { full_name: string | null; phone: string | null; avatar_path: string | null }
const bucket = 'user-avatars'
const buttonStyle: CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: 0, borderRadius: 10, background: 'transparent', color: '#e7eeff', textAlign: 'left', cursor: 'pointer', fontSize: 14 }
const inputStyle: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: 11, borderRadius: 9, border: '1px solid #354765', background: '#0d1629', color: '#fff' }

export default function UserAccountMenu() {
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [profile, setProfile] = useState<Profile>({ full_name: null, phone: null, avatar_path: null })
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    async function load() {
      const { data: auth } = await supabase.auth.getUser()
      if (!active || !auth.user) return
      const id = auth.user.id
      setUserId(id)
      setEmail(auth.user.email || '')
      const [p, member] = await Promise.all([
        supabase.from('profiles').select('full_name,phone,avatar_path').eq('id', id).maybeSingle(),
        supabase.from('organization_members').select('role').eq('user_id', id).eq('active', true).limit(1).maybeSingle(),
      ])
      if (!active) return
      if (member.data?.role) setRole(member.data.role)
      if (p.data) {
        const current = p.data as Profile
        setProfile(current)
        setName(current.full_name || '')
        setPhone(current.phone || '')
        if (current.avatar_path) {
          const signed = await supabase.storage.from(bucket).createSignedUrl(current.avatar_path, 3600)
          if (active && signed.data?.signedUrl) setAvatarUrl(signed.data.signedUrl)
        }
      }
    }
    void load()
    return () => { active = false }
  }, [])

  async function saveProfile() {
    if (!userId || !name.trim()) { setMessage('Informe seu nome.'); return }
    setBusy(true); setMessage('')
    const { error } = await supabase.from('profiles').upsert({ id: userId, full_name: name.trim(), phone: phone.trim() || null }, { onConflict: 'id' })
    setBusy(false)
    if (error) { setMessage('Erro ao salvar perfil: ' + error.message); return }
    setProfile(old => ({ ...old, full_name: name.trim(), phone: phone.trim() || null }))
    setEdit(false); setMessage('Perfil atualizado.')
  }

  async function uploadPhoto(file?: File) {
    if (!file || !userId) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setMessage('Use JPG, PNG ou WebP.'); return }
    if (file.size > 2 * 1024 * 1024) { setMessage('A foto deve ter até 2 MB.'); return }
    setBusy(true); setMessage('')
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${userId}/avatar-${crypto.randomUUID()}.${extension}`
    const uploaded = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false })
    if (uploaded.error) { setMessage('Erro no upload: ' + uploaded.error.message); setBusy(false); return }
    const updated = await supabase.from('profiles').upsert({ id: userId, avatar_path: path }, { onConflict: 'id' })
    if (updated.error) {
      await supabase.storage.from(bucket).remove([path])
      setMessage('Erro ao associar a foto: ' + updated.error.message)
      setBusy(false); return
    }
    const signed = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
    if (signed.data?.signedUrl) setAvatarUrl(signed.data.signedUrl)
    const oldPath = profile.avatar_path
    setProfile(old => ({ ...old, avatar_path: path }))
    if (oldPath && oldPath !== path) await supabase.storage.from(bucket).remove([oldPath])
    setBusy(false); setMessage('Foto atualizada.')
  }

  async function changePassword() {
    if (newPassword.length < 8) { setMessage('Use uma senha com pelo menos 8 caracteres.'); return }
    setBusy(true); setMessage('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setBusy(false)
    if (error) { setMessage('Não foi possível alterar a senha: ' + error.message); return }
    setNewPassword(''); setPasswordOpen(false); setMessage('Senha alterada com sucesso.')
  }

  async function logout() {
    setBusy(true); setMessage('')
    const { error } = await supabase.auth.signOut()
    if (error) { setBusy(false); setMessage('Não foi possível sair: ' + error.message) }
  }

  const initials = (profile.full_name || email || 'U').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('')
  return <div style={{ position: 'relative' }}>
    <button type="button" onClick={() => { setOpen(v => !v); setMessage('') }} aria-label="Abrir minha conta" aria-expanded={open} style={{ border: 0, padding: 0, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#c8d4ef' }}>
      <span className="user-avatar" style={{ overflow: 'hidden', display: 'grid', placeItems: 'center' }}>{avatarUrl ? <img src={avatarUrl} alt="Minha foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}</span>
      <ChevronDown size={14}/>
    </button>
    {open && <>
      <button type="button" aria-label="Fechar menu da conta" onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'transparent', border: 0, zIndex: 100 }} />
      <section aria-label="Minha conta" style={{ position: 'absolute', top: 'calc(100% + 12px)', right: 0, zIndex: 101, width: 'min(330px, calc(100vw - 28px))', maxHeight: 'min(75vh, 650px)', overflowY: 'auto', borderRadius: 16, background: '#151f36', border: '1px solid #354765', boxShadow: '0 18px 55px #0009', padding: 12, color: '#e7eeff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8 }}>
          <span className="user-avatar" style={{ width: 48, height: 48, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>{avatarUrl ? <img src={avatarUrl} alt="Minha foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserRound size={22}/>}</span>
          <div style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block' }}>{profile.full_name || 'Minha conta'}</strong><small style={{ display: 'block', overflowWrap: 'anywhere', color: '#9cacc9' }}>{email}</small><small style={{ color: '#9cacc9' }}>{role || 'Usuário'}</small></div>
          <button type="button" aria-label="Fechar" onClick={() => setOpen(false)} style={{ border: 0, background: 'transparent', color: '#c8d4ef', cursor: 'pointer' }}><X size={18}/></button>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={e => { void uploadPhoto(e.target.files?.[0]); e.target.value = '' }}/>
        <button type="button" disabled={busy} style={buttonStyle} onClick={() => fileRef.current?.click()}><Camera size={17}/> Enviar foto da galeria</button>
        <button type="button" style={buttonStyle} onClick={() => { setEdit(v => !v); setPasswordOpen(false) }}><UserRound size={17}/> Editar meu perfil</button>
        {edit && <div style={{ display: 'grid', gap: 9, padding: 10 }}><label>Nome<input style={inputStyle} value={name} onChange={e => setName(e.target.value)} /></label><label>Telefone<input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} /></label><button type="button" disabled={busy} style={{ ...buttonStyle, background: '#345be5', justifyContent: 'center' }} onClick={() => void saveProfile()}><Save size={16}/> Salvar perfil</button></div>}
        <button type="button" style={buttonStyle} onClick={() => { setPasswordOpen(v => !v); setEdit(false) }}><KeyRound size={17}/> Alterar senha</button>
        {passwordOpen && <div style={{ display: 'grid', gap: 9, padding: 10 }}><label>Nova senha<input style={inputStyle} type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)}/></label><button type="button" disabled={busy} style={{ ...buttonStyle, background: '#345be5', justifyContent: 'center' }} onClick={() => void changePassword()}>Atualizar senha</button></div>}
        <div style={{ borderTop: '1px solid #354765', margin: '8px 0' }}/>
        <button type="button" disabled={busy} style={{ ...buttonStyle, color: '#ff9ea8' }} onClick={() => void logout()}><LogOut size={17}/> Sair do sistema</button>
        {message && <p role="status" style={{ fontSize: 12, padding: '0 10px', color: '#a9c5ff', overflowWrap: 'anywhere' }}>{message}</p>}
      </section>
    </>}
  </div>
}
