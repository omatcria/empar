import { useState } from 'react'
import { Building2, User } from '@/components/icons'
import { useAuth } from '@/store/auth'
import { Button, Surface } from '@/components/ui'
import { Field, TextInput } from '@/components/ui/form'

export function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'entrar' | 'criar'>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      if (mode === 'entrar') {
        const { error } = await signIn(email, senha)
        if (error) setError(traduz(error))
      } else {
        const { error, needsConfirmation } = await signUp(email, senha, nome)
        if (error) setError(traduz(error))
        else if (needsConfirmation)
          setInfo('Conta criada! Confirme o e-mail para entrar.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/brand/empar-symbol.png" alt="" className="mx-auto mb-4 h-16 w-auto" />
          <h1>
            <img src="/brand/empar-wordmark.png" alt="Empar" className="mx-auto h-8 w-auto" />
          </h1>
          <p className="mt-1 flex items-center justify-center gap-2 text-sm text-app-muted">
            <User className="size-3.5 text-pessoal-strong" /> Pessoal
            <span className="text-app-border">·</span>
            <Building2 className="size-3.5 text-empresarial-strong" /> Empresarial
          </p>
        </div>

        <Surface className="p-6">
          {/* Alternância entrar / criar */}
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-app-surface-2 p-1">
            {(['entrar', 'criar'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m)
                  setError(null)
                  setInfo(null)
                }}
                className={
                  'h-9 rounded-lg text-sm font-medium transition-colors cursor-pointer ' +
                  (mode === m
                    ? 'bg-app-surface text-app-fg shadow'
                    : 'text-app-muted hover:text-app-fg2')
                }
              >
                {m === 'entrar' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {mode === 'criar' && (
              <Field label="Nome" htmlFor="nome">
                <TextInput
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  autoComplete="name"
                />
              </Field>
            )}
            <Field label="E-mail" htmlFor="email">
              <TextInput
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                autoComplete="email"
              />
            </Field>
            <Field label="Senha" htmlFor="senha">
              <TextInput
                id="senha"
                type="password"
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'}
              />
            </Field>

            {error && (
              <p role="alert" className="text-sm text-expense">
                {error}
              </p>
            )}
            {info && (
              <p role="status" className="text-sm text-income">
                {info}
              </p>
            )}

            <Button type="submit" size="lg" loading={loading} className="mt-1">
              {mode === 'entrar' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>
        </Surface>

        <p className="mt-6 text-center text-xs text-app-muted">
          Seus dados ficam isolados por RLS no Supabase.
        </p>
      </div>
    </div>
  )
}

function traduz(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'E-mail ou senha inválidos.'
  if (m.includes('already registered')) return 'Este e-mail já tem conta.'
  if (m.includes('password')) return 'Senha muito curta (mínimo 6 caracteres).'
  return msg
}
