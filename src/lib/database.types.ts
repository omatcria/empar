export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          arquivada: boolean
          banco: string | null
          contexto: Database["public"]["Enums"]["context_enum"]
          cor: string
          created_at: string
          id: string
          instituicao: string | null
          nome: string
          saldo_inicial_centavos: number
          tipo: Database["public"]["Enums"]["account_type_enum"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          arquivada?: boolean
          banco?: string | null
          contexto: Database["public"]["Enums"]["context_enum"]
          cor?: string
          created_at?: string
          id?: string
          instituicao?: string | null
          nome: string
          saldo_inicial_centavos?: number
          tipo: Database["public"]["Enums"]["account_type_enum"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          arquivada?: boolean
          banco?: string | null
          contexto?: Database["public"]["Enums"]["context_enum"]
          cor?: string
          created_at?: string
          id?: string
          instituicao?: string | null
          nome?: string
          saldo_inicial_centavos?: number
          tipo?: Database["public"]["Enums"]["account_type_enum"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          action: string
          at: string
          entity: string
          entity_id: string
          id: string
          meta: Json | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          action: string
          at?: string
          entity: string
          entity_id: string
          id?: string
          meta?: Json | null
          user_id: string
          workspace_id: string
        }
        Update: {
          action?: string
          at?: string
          entity?: string
          entity_id?: string
          id?: string
          meta?: Json | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      browser_scrape_quota: {
        Row: {
          attempts: number
          user_id: string
          window_started: string
        }
        Insert: {
          attempts: number
          user_id: string
          window_started: string
        }
        Update: {
          attempts?: number
          user_id?: string
          window_started?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          category_id: string
          contexto: Database["public"]["Enums"]["context_enum"]
          created_at: string
          id: string
          limite_centavos: number
          mes_referencia: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          category_id: string
          contexto: Database["public"]["Enums"]["context_enum"]
          created_at?: string
          id?: string
          limite_centavos: number
          mes_referencia: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          category_id?: string
          contexto?: Database["public"]["Enums"]["context_enum"]
          created_at?: string
          id?: string
          limite_centavos?: number
          mes_referencia?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          account_pagamento_id: string | null
          arquivado: boolean
          banco: string | null
          bandeira: string | null
          contexto: Database["public"]["Enums"]["context_enum"]
          cor: string
          created_at: string
          dia_fechamento: number
          dia_vencimento: number
          id: string
          limite_centavos: number
          nome: string
          tipo: Database["public"]["Enums"]["card_kind_enum"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          account_pagamento_id?: string | null
          arquivado?: boolean
          banco?: string | null
          bandeira?: string | null
          contexto: Database["public"]["Enums"]["context_enum"]
          cor?: string
          created_at?: string
          dia_fechamento: number
          dia_vencimento: number
          id?: string
          limite_centavos?: number
          nome: string
          tipo?: Database["public"]["Enums"]["card_kind_enum"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          account_pagamento_id?: string | null
          arquivado?: boolean
          banco?: string | null
          bandeira?: string | null
          contexto?: Database["public"]["Enums"]["context_enum"]
          cor?: string
          created_at?: string
          dia_fechamento?: number
          dia_vencimento?: number
          id?: string
          limite_centavos?: number
          nome?: string
          tipo?: Database["public"]["Enums"]["card_kind_enum"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_account_pagamento_id_fkey"
            columns: ["account_pagamento_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          categoria_pai_id: string | null
          chave: string | null
          contexto: Database["public"]["Enums"]["context_enum"]
          cor: string
          created_at: string
          icone: string
          id: string
          nome: string
          sistema: boolean
          tipo: Database["public"]["Enums"]["tx_type_enum"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          categoria_pai_id?: string | null
          chave?: string | null
          contexto: Database["public"]["Enums"]["context_enum"]
          cor?: string
          created_at?: string
          icone?: string
          id?: string
          nome: string
          sistema?: boolean
          tipo: Database["public"]["Enums"]["tx_type_enum"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          categoria_pai_id?: string | null
          chave?: string | null
          contexto?: Database["public"]["Enums"]["context_enum"]
          cor?: string
          created_at?: string
          icone?: string
          id?: string
          nome?: string
          sistema?: boolean
          tipo?: Database["public"]["Enums"]["tx_type_enum"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_categoria_pai_id_fkey"
            columns: ["categoria_pai_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_installments: {
        Row: {
          debt_id: string
          id: string
          numero: number
          pago: boolean
          pago_em: string | null
          user_id: string
          valor_centavos: number
          vencimento: string
          workspace_id: string
        }
        Insert: {
          debt_id: string
          id?: string
          numero: number
          pago?: boolean
          pago_em?: string | null
          user_id: string
          valor_centavos: number
          vencimento: string
          workspace_id: string
        }
        Update: {
          debt_id?: string
          id?: string
          numero?: number
          pago?: boolean
          pago_em?: string | null
          user_id?: string
          valor_centavos?: number
          vencimento?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_installments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_installments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          contexto: Database["public"]["Enums"]["context_enum"]
          created_at: string
          credor: string
          data_acordo: string | null
          descricao: string | null
          id: string
          observacoes: string | null
          origem: string
          updated_at: string
          user_id: string
          valor_acordo_centavos: number | null
          valor_original_centavos: number | null
          workspace_id: string
        }
        Insert: {
          contexto?: Database["public"]["Enums"]["context_enum"]
          created_at?: string
          credor: string
          data_acordo?: string | null
          descricao?: string | null
          id?: string
          observacoes?: string | null
          origem?: string
          updated_at?: string
          user_id: string
          valor_acordo_centavos?: number | null
          valor_original_centavos?: number | null
          workspace_id: string
        }
        Update: {
          contexto?: Database["public"]["Enums"]["context_enum"]
          created_at?: string
          credor?: string
          data_acordo?: string | null
          descricao?: string | null
          id?: string
          observacoes?: string | null
          origem?: string
          updated_at?: string
          user_id?: string
          valor_acordo_centavos?: number | null
          valor_original_centavos?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          contexto: Database["public"]["Enums"]["context_enum"]
          created_at: string
          id: string
          nome: string
          prazo: string | null
          preset: Database["public"]["Enums"]["goal_preset_enum"] | null
          updated_at: string
          user_id: string
          valor_alvo_centavos: number
          valor_atual_centavos: number
          workspace_id: string
        }
        Insert: {
          contexto: Database["public"]["Enums"]["context_enum"]
          created_at?: string
          id?: string
          nome: string
          prazo?: string | null
          preset?: Database["public"]["Enums"]["goal_preset_enum"] | null
          updated_at?: string
          user_id: string
          valor_alvo_centavos: number
          valor_atual_centavos?: number
          workspace_id: string
        }
        Update: {
          contexto?: Database["public"]["Enums"]["context_enum"]
          created_at?: string
          id?: string
          nome?: string
          prazo?: string | null
          preset?: Database["public"]["Enums"]["goal_preset_enum"] | null
          updated_at?: string
          user_id?: string
          valor_alvo_centavos?: number
          valor_atual_centavos?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_movements: {
        Row: {
          account_id: string | null
          created_at: string
          data: string
          id: string
          investment_id: string
          tipo: string
          user_id: string
          valor_centavos: number
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          data?: string
          id?: string
          investment_id: string
          tipo?: string
          user_id: string
          valor_centavos: number
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          data?: string
          id?: string
          investment_id?: string
          tipo?: string
          user_id?: string
          valor_centavos?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_movements_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_movements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          arquivado: boolean
          banco: string | null
          contexto: Database["public"]["Enums"]["context_enum"]
          cor: string | null
          created_at: string
          data_inicio: string
          forma_rendimento: string
          id: string
          nome: string
          taxa: number
          tipo: string
          updated_at: string
          user_id: string
          vencimento: string | null
          workspace_id: string
        }
        Insert: {
          arquivado?: boolean
          banco?: string | null
          contexto?: Database["public"]["Enums"]["context_enum"]
          cor?: string | null
          created_at?: string
          data_inicio?: string
          forma_rendimento?: string
          id?: string
          nome: string
          taxa?: number
          tipo?: string
          updated_at?: string
          user_id: string
          vencimento?: string | null
          workspace_id: string
        }
        Update: {
          arquivado?: boolean
          banco?: string | null
          contexto?: Database["public"]["Enums"]["context_enum"]
          cor?: string | null
          created_at?: string
          data_inicio?: string
          forma_rendimento?: string
          id?: string
          nome?: string
          taxa?: number
          tipo?: string
          updated_at?: string
          user_id?: string
          vencimento?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          card_id: string
          created_at: string
          data_fechamento: string
          data_vencimento: string
          id: string
          mes_referencia: string
          paga: boolean
          paid_account_id: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          data_fechamento: string
          data_vencimento: string
          id?: string
          mes_referencia: string
          paga?: boolean
          paid_account_id?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          data_fechamento?: string
          data_vencimento?: string
          id?: string
          mes_referencia?: string
          paga?: boolean
          paid_account_id?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_paid_account_id_fkey"
            columns: ["paid_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          mei_alertas: boolean
          membros_desejos: boolean
          membros_lancamentos: boolean
          orcamento_80: boolean
          reacoes: boolean
          user_id: string
          venc_contas: boolean
          venc_dividas: boolean
          venc_faturas: boolean
          venc_recorrencias: boolean
          wishlist_precos: boolean
        }
        Insert: {
          mei_alertas?: boolean
          membros_desejos?: boolean
          membros_lancamentos?: boolean
          orcamento_80?: boolean
          reacoes?: boolean
          user_id: string
          venc_contas?: boolean
          venc_dividas?: boolean
          venc_faturas?: boolean
          venc_recorrencias?: boolean
          wishlist_precos?: boolean
        }
        Update: {
          mei_alertas?: boolean
          membros_desejos?: boolean
          membros_lancamentos?: boolean
          orcamento_80?: boolean
          reacoes?: boolean
          user_id?: string
          venc_contas?: boolean
          venc_dividas?: boolean
          venc_faturas?: boolean
          venc_recorrencias?: boolean
          wishlist_precos?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          corpo: string
          created_at: string
          dedupe_key: string | null
          id: string
          lida: boolean
          meta: Json | null
          tipo: string
          titulo: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          corpo: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          lida?: boolean
          meta?: Json | null
          tipo: string
          titulo: string
          user_id: string
          workspace_id: string
        }
        Update: {
          corpo?: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          lida?: boolean
          meta?: Json | null
          tipo?: string
          titulo?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_workspace_id: string | null
          avatar_url: string | null
          cdi_anual: number
          created_at: string
          id: string
          locale: string
          moeda: string
          nome: string | null
          onboarding_completo: boolean
          prolabore_padrao_centavos: number
          updated_at: string
        }
        Insert: {
          active_workspace_id?: string | null
          avatar_url?: string | null
          cdi_anual?: number
          created_at?: string
          id: string
          locale?: string
          moeda?: string
          nome?: string | null
          onboarding_completo?: boolean
          prolabore_padrao_centavos?: number
          updated_at?: string
        }
        Update: {
          active_workspace_id?: string | null
          avatar_url?: string | null
          cdi_anual?: number
          created_at?: string
          id?: string
          locale?: string
          moeda?: string
          nome?: string | null
          onboarding_completo?: boolean
          prolabore_padrao_centavos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_workspace_id_fkey"
            columns: ["active_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recurrences: {
        Row: {
          ativo: boolean
          contexto: Database["public"]["Enums"]["context_enum"]
          created_at: string
          dia: number
          frequencia: Database["public"]["Enums"]["recurrence_freq_enum"]
          id: string
          proxima_data: string
          template: Json
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          ativo?: boolean
          contexto: Database["public"]["Enums"]["context_enum"]
          created_at?: string
          dia: number
          frequencia: Database["public"]["Enums"]["recurrence_freq_enum"]
          id?: string
          proxima_data: string
          template: Json
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          ativo?: boolean
          contexto?: Database["public"]["Enums"]["context_enum"]
          created_at?: string
          dia?: number
          frequencia?: Database["public"]["Enums"]["recurrence_freq_enum"]
          id?: string
          proxima_data?: string
          template?: Json
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_provisions: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          percentual: number
          saldo_provisionado_centavos: number
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          percentual?: number
          saldo_provisionado_centavos?: number
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          percentual?: number
          saldo_provisionado_centavos?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_provisions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_reactions: {
        Row: {
          created_at: string
          emoji: Database["public"]["Enums"]["reaction_emoji"]
          id: string
          transaction_id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          emoji: Database["public"]["Enums"]["reaction_emoji"]
          id?: string
          transaction_id: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          emoji?: Database["public"]["Enums"]["reaction_emoji"]
          id?: string
          transaction_id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_reactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_reactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          anexo: string | null
          card_id: string | null
          category_id: string
          centro_de_custo: string | null
          contexto: Database["public"]["Enums"]["context_enum"]
          created_at: string
          data: string
          data_vencimento: string | null
          descricao: string
          id: string
          invoice_id: string | null
          pago: boolean
          parcela_group_id: string | null
          parcela_n: number | null
          parcela_total: number | null
          rateio_id: string | null
          recorrencia_id: string | null
          tags: string[]
          tipo: Database["public"]["Enums"]["tx_type_enum"]
          transfer_id: string | null
          transfer_kind:
            | Database["public"]["Enums"]["transfer_kind_enum"]
            | null
          updated_at: string
          user_id: string
          valor_centavos: number
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          anexo?: string | null
          card_id?: string | null
          category_id: string
          centro_de_custo?: string | null
          contexto: Database["public"]["Enums"]["context_enum"]
          created_at?: string
          data: string
          data_vencimento?: string | null
          descricao?: string
          id?: string
          invoice_id?: string | null
          pago?: boolean
          parcela_group_id?: string | null
          parcela_n?: number | null
          parcela_total?: number | null
          rateio_id?: string | null
          recorrencia_id?: string | null
          tags?: string[]
          tipo: Database["public"]["Enums"]["tx_type_enum"]
          transfer_id?: string | null
          transfer_kind?:
            | Database["public"]["Enums"]["transfer_kind_enum"]
            | null
          updated_at?: string
          user_id: string
          valor_centavos: number
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          anexo?: string | null
          card_id?: string | null
          category_id?: string
          centro_de_custo?: string | null
          contexto?: Database["public"]["Enums"]["context_enum"]
          created_at?: string
          data?: string
          data_vencimento?: string | null
          descricao?: string
          id?: string
          invoice_id?: string | null
          pago?: boolean
          parcela_group_id?: string | null
          parcela_n?: number | null
          parcela_total?: number | null
          rateio_id?: string | null
          recorrencia_id?: string | null
          tags?: string[]
          tipo?: Database["public"]["Enums"]["tx_type_enum"]
          transfer_id?: string | null
          transfer_kind?:
            | Database["public"]["Enums"]["transfer_kind_enum"]
            | null
          updated_at?: string
          user_id?: string
          valor_centavos?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recorrencia_id_fkey"
            columns: ["recorrencia_id"]
            isOneToOne: false
            referencedRelation: "recurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_categories: {
        Row: {
          cor: string
          created_at: string
          icone: string
          id: string
          nome: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          cor?: string
          created_at?: string
          icone?: string
          id?: string
          nome: string
          user_id: string
          workspace_id: string
        }
        Update: {
          cor?: string
          created_at?: string
          icone?: string
          id?: string
          nome?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          category_id: string | null
          comprado: boolean
          comprado_em: string | null
          created_at: string
          descricao: string | null
          id: string
          imagem_url: string | null
          loja: string | null
          monitorar: boolean
          preco_alvo_centavos: number | null
          preco_atual_centavos: number | null
          preco_inicial_centavos: number | null
          preco_minimo_centavos: number | null
          titulo: string
          ultima_verificacao: string | null
          ultimo_erro: string | null
          updated_at: string
          url: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          category_id?: string | null
          comprado?: boolean
          comprado_em?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          loja?: string | null
          monitorar?: boolean
          preco_alvo_centavos?: number | null
          preco_atual_centavos?: number | null
          preco_inicial_centavos?: number | null
          preco_minimo_centavos?: number | null
          titulo: string
          ultima_verificacao?: string | null
          ultimo_erro?: string | null
          updated_at?: string
          url: string
          user_id: string
          workspace_id: string
        }
        Update: {
          category_id?: string | null
          comprado?: boolean
          comprado_em?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          loja?: string | null
          monitorar?: boolean
          preco_alvo_centavos?: number | null
          preco_atual_centavos?: number | null
          preco_inicial_centavos?: number | null
          preco_minimo_centavos?: number | null
          titulo?: string
          ultima_verificacao?: string | null
          ultimo_erro?: string | null
          updated_at?: string
          url?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "wishlist_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_price_history: {
        Row: {
          id: string
          item_id: string
          preco_centavos: number
          verificado_em: string
          workspace_id: string
        }
        Insert: {
          id?: string
          item_id: string
          preco_centavos: number
          verificado_em?: string
          workspace_id: string
        }
        Update: {
          id?: string
          item_id?: string
          preco_centavos?: number
          verificado_em?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "wishlist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_price_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          role: Database["public"]["Enums"]["member_role"]
          token: string
          used_at: string | null
          used_by: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          token: string
          used_at?: string | null
          used_by?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          token?: string
          used_at?: string | null
          used_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string | null
          role: Database["public"]["Enums"]["member_role"]
          status: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          mei_abertura: string | null
          mei_ativo: boolean
          mei_limite_anual_centavos: number
          nome: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mei_abertura?: string | null
          mei_ativo?: boolean
          mei_limite_anual_centavos?: number
          nome: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mei_abertura?: string | null
          mei_ativo?: boolean
          mei_limite_anual_centavos?: number
          nome?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { _token: string }; Returns: string }
      acquire_browser_scrape: { Args: never; Returns: boolean }
      fmt_brl: { Args: { v: number }; Returns: string }
      generate_due_notifications: { Args: { _today?: string }; Returns: number }
      has_write: { Args: { _ws: string }; Returns: boolean }
      is_member: { Args: { _ws: string }; Returns: boolean }
      is_owner: { Args: { _ws: string }; Returns: boolean }
      notification_pref_column: { Args: { tipo: string }; Returns: string }
      regenerate_debt_installments: {
        Args: { _debt_id: string; _first_due: string; _n: number }
        Returns: {
          debt_id: string
          id: string
          numero: number
          pago: boolean
          pago_em: string | null
          user_id: string
          valor_centavos: number
          vencimento: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "debt_installments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reset_workspace_data: { Args: { _ws: string }; Returns: undefined }
      seed_workspace_defaults: {
        Args: { _uid: string; _ws: string }
        Returns: undefined
      }
    }
    Enums: {
      account_type_enum:
        | "conta_corrente"
        | "conta_digital"
        | "conta_pj"
        | "poupanca"
        | "dinheiro"
        | "investimento"
      card_kind_enum: "credito" | "debito" | "credito_debito"
      context_enum: "PESSOAL" | "EMPRESARIAL"
      goal_preset_enum: "RESERVA_PESSOAL" | "RESERVA_EMPRESARIAL"
      member_role: "owner" | "editor" | "viewer"
      reaction_emoji: "like" | "love" | "angry" | "sad"
      recurrence_freq_enum: "mensal" | "semanal" | "anual"
      transfer_kind_enum: "PRO_LABORE" | "DISTRIBUICAO_LUCROS" | "TRANSFER"
      tx_type_enum: "RECEITA" | "DESPESA"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type_enum: [
        "conta_corrente",
        "conta_digital",
        "conta_pj",
        "poupanca",
        "dinheiro",
        "investimento",
      ],
      card_kind_enum: ["credito", "debito", "credito_debito"],
      context_enum: ["PESSOAL", "EMPRESARIAL"],
      goal_preset_enum: ["RESERVA_PESSOAL", "RESERVA_EMPRESARIAL"],
      member_role: ["owner", "editor", "viewer"],
      reaction_emoji: ["like", "love", "angry", "sad"],
      recurrence_freq_enum: ["mensal", "semanal", "anual"],
      transfer_kind_enum: ["PRO_LABORE", "DISTRIBUICAO_LUCROS", "TRANSFER"],
      tx_type_enum: ["RECEITA", "DESPESA"],
    },
  },
} as const
