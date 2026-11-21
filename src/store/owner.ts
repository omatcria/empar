import { useAuth } from './auth'
import { useData } from './data'

/** Colunas de propriedade em todo insert: criador + espaço ativo. */
export function ownerCols(): { user_id: string; workspace_id: string } {
  const user_id = useAuth.getState().user?.id
  const workspace_id = useData.getState().workspaceId
  if (!user_id) throw new Error('Usuário não autenticado')
  if (!workspace_id) throw new Error('Nenhum espaço ativo')
  return { user_id, workspace_id }
}
