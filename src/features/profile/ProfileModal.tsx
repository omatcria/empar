import { useEffect, useState } from 'react'
import { useData } from '@/store/data'
import { useAuth } from '@/store/auth'
import { supabase } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/primitives'
import { Field, TextInput } from '@/components/ui/form'
import { Avatar } from '@/components/ui/Avatar'
import { LogOut } from '@/components/icons'

/** Modal rápido de perfil: foto + nome (+ sair). */
export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, updateProfile } = useData()
  const signOut = useAuth((s) => s.signOut)
  const email = useAuth((s) => s.user?.email)

  const [nome, setNome] = useState(profile?.nome ?? '')
  const [avatarPath, setAvatarPath] = useState<string | null>(profile?.avatar_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setNome(profile?.nome ?? '')
    setAvatarPath(profile?.avatar_url ?? null)
  }, [open, profile])

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert('Imagem muito grande (máx. 2MB).')
      return
    }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${profile?.id}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true })
      if (error) throw error
      setAvatarPath(fileName)
    } catch (err) {
      console.error(err)
      alert('Erro ao enviar a imagem.')
    } finally {
      setUploading(false)
    }
  }

  async function salvar() {
    setSaving(true)
    try {
      await updateProfile({ nome: nome.trim() || null, avatar_url: avatarPath })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Meu perfil"
      footer={
        <>
          <Button
            variant="ghost"
            className="mr-auto text-app-muted"
            icon={<LogOut className="size-4" />}
            onClick={() => signOut()}
          >
            Sair
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <Avatar path={avatarPath} nome={nome || profile?.nome || email} className="size-16 text-xl" />
          <div>
            <label className="cursor-pointer text-sm font-medium text-primary hover:underline">
              {uploading ? 'Enviando…' : 'Alterar foto'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatar}
                disabled={uploading}
              />
            </label>
            <p className="mt-1 text-xs text-app-muted">JPG, PNG ou GIF. Máx. 2MB.</p>
          </div>
        </div>

        <Field label="Nome" htmlFor="prof-nome">
          <TextInput id="prof-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
        </Field>

        {email && <p className="text-xs text-app-muted">Conta: {email}</p>}
      </div>
    </Modal>
  )
}
