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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agencias: {
        Row: {
          ativa: boolean
          cidade_id: string
          cnpj: string | null
          comissao_percentual: number
          created_at: string
          empresa_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          cidade_id: string
          cnpj?: string | null
          comissao_percentual?: number
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          cidade_id?: string
          cnpj?: string | null
          comissao_percentual?: number
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agencias_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agencias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_publica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agencias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      assentos: {
        Row: {
          ativo: boolean
          codigo: string
          coluna: number
          created_at: string
          embarcacao_id: string
          fileira: number
          id: string
          tipo: Database["public"]["Enums"]["tipo_assento"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          coluna: number
          created_at?: string
          embarcacao_id: string
          fileira: number
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_assento"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          coluna?: number
          created_at?: string
          embarcacao_id?: string
          fileira?: number
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_assento"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assentos_embarcacao_id_fkey"
            columns: ["embarcacao_id"]
            isOneToOne: false
            referencedRelation: "embarcacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      caixa_sessoes: {
        Row: {
          aberto_em: string
          created_at: string
          fechado_em: string | null
          id: string
          observacao: string | null
          updated_at: string
          usuario_id: string
          valor_abertura: number
          valor_fechamento: number | null
        }
        Insert: {
          aberto_em?: string
          created_at?: string
          fechado_em?: string | null
          id?: string
          observacao?: string | null
          updated_at?: string
          usuario_id: string
          valor_abertura: number
          valor_fechamento?: number | null
        }
        Update: {
          aberto_em?: string
          created_at?: string
          fechado_em?: string | null
          id?: string
          observacao?: string | null
          updated_at?: string
          usuario_id?: string
          valor_abertura?: number
          valor_fechamento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "caixa_sessoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      cidades: {
        Row: {
          codigo_ibge: string | null
          created_at: string
          id: string
          nome: string
          sigla: string
          slug: string
          timezone: string
          uf: string
          updated_at: string
        }
        Insert: {
          codigo_ibge?: string | null
          created_at?: string
          id?: string
          nome: string
          sigla: string
          slug: string
          timezone?: string
          uf: string
          updated_at?: string
        }
        Update: {
          codigo_ibge?: string | null
          created_at?: string
          id?: string
          nome?: string
          sigla?: string
          slug?: string
          timezone?: string
          uf?: string
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          telefone: string
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          telefone: string
          updated_at?: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          telefone?: string
          updated_at?: string
        }
        Relationships: []
      }
      descontos_tipo_passageiro: {
        Row: {
          created_at: string
          percentual: number
          tipo: Database["public"]["Enums"]["tipo_passageiro"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          percentual: number
          tipo: Database["public"]["Enums"]["tipo_passageiro"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          percentual?: number
          tipo?: Database["public"]["Enums"]["tipo_passageiro"]
          updated_at?: string
        }
        Relationships: []
      }
      embarcacoes: {
        Row: {
          capacidade_carga_kg: number | null
          capacidade_passageiros: number
          colunas_mapa: number
          created_at: string
          empresa_id: string
          foto_url: string | null
          id: string
          inscricao_capitania: string | null
          nome: string
          status: Database["public"]["Enums"]["status_embarcacao"]
          tipo: string
          updated_at: string
        }
        Insert: {
          capacidade_carga_kg?: number | null
          capacidade_passageiros: number
          colunas_mapa: number
          created_at?: string
          empresa_id: string
          foto_url?: string | null
          id?: string
          inscricao_capitania?: string | null
          nome: string
          status?: Database["public"]["Enums"]["status_embarcacao"]
          tipo?: string
          updated_at?: string
        }
        Update: {
          capacidade_carga_kg?: number | null
          capacidade_passageiros?: number
          colunas_mapa?: number
          created_at?: string
          empresa_id?: string
          foto_url?: string | null
          id?: string
          inscricao_capitania?: string | null
          nome?: string
          status?: Database["public"]["Enums"]["status_embarcacao"]
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "embarcacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_publica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embarcacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          cnpj: string
          created_at: string
          email: string
          id: string
          inscricao_estadual: string | null
          logo_url: string | null
          minutos_reserva_site: number
          nome_fantasia: string
          razao_social: string
          telefone: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          cnpj: string
          created_at?: string
          email: string
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          minutos_reserva_site?: number
          nome_fantasia: string
          razao_social: string
          telefone: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          cnpj?: string
          created_at?: string
          email?: string
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          minutos_reserva_site?: number
          nome_fantasia?: string
          razao_social?: string
          telefone?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      encomenda_eventos: {
        Row: {
          created_at: string
          descricao: string | null
          encomenda_id: string
          id: string
          status: Database["public"]["Enums"]["status_encomenda"]
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          encomenda_id: string
          id?: string
          status: Database["public"]["Enums"]["status_encomenda"]
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          encomenda_id?: string
          id?: string
          status?: Database["public"]["Enums"]["status_encomenda"]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encomenda_eventos_encomenda_id_fkey"
            columns: ["encomenda_id"]
            isOneToOne: false
            referencedRelation: "encomendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encomenda_eventos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      encomendas: {
        Row: {
          codigo: string
          created_at: string
          descricao: string
          destinatario_doc: string | null
          destinatario_nome: string
          destinatario_tel: string
          destino_cidade_id: string
          empresa_id: string
          entregue_a: string | null
          frete: number
          frete_pago: boolean
          id: string
          origem_cidade_id: string
          pagador: Database["public"]["Enums"]["pagador_frete"]
          peso_kg: number
          remetente_doc: string
          remetente_nome: string
          remetente_tel: string
          status: Database["public"]["Enums"]["status_encomenda"]
          updated_at: string
          valor_declarado: number | null
          viagem_id: string | null
          volumes: number
        }
        Insert: {
          codigo?: string
          created_at?: string
          descricao: string
          destinatario_doc?: string | null
          destinatario_nome: string
          destinatario_tel: string
          destino_cidade_id: string
          empresa_id: string
          entregue_a?: string | null
          frete: number
          frete_pago?: boolean
          id?: string
          origem_cidade_id: string
          pagador?: Database["public"]["Enums"]["pagador_frete"]
          peso_kg: number
          remetente_doc: string
          remetente_nome: string
          remetente_tel: string
          status?: Database["public"]["Enums"]["status_encomenda"]
          updated_at?: string
          valor_declarado?: number | null
          viagem_id?: string | null
          volumes?: number
        }
        Update: {
          codigo?: string
          created_at?: string
          descricao?: string
          destinatario_doc?: string | null
          destinatario_nome?: string
          destinatario_tel?: string
          destino_cidade_id?: string
          empresa_id?: string
          entregue_a?: string | null
          frete?: number
          frete_pago?: boolean
          id?: string
          origem_cidade_id?: string
          pagador?: Database["public"]["Enums"]["pagador_frete"]
          peso_kg?: number
          remetente_doc?: string
          remetente_nome?: string
          remetente_tel?: string
          status?: Database["public"]["Enums"]["status_encomenda"]
          updated_at?: string
          valor_declarado?: number | null
          viagem_id?: string | null
          volumes?: number
        }
        Relationships: [
          {
            foreignKeyName: "encomendas_destino_cidade_id_fkey"
            columns: ["destino_cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encomendas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_publica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encomendas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encomendas_origem_cidade_id_fkey"
            columns: ["origem_cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encomendas_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "viagens"
            referencedColumns: ["id"]
          },
        ]
      }
      horarios_linha: {
        Row: {
          ativo: boolean
          created_at: string
          dia_semana: number
          embarcacao_id: string
          hora_saida: string
          id: string
          linha_id: string
          updated_at: string
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dia_semana: number
          embarcacao_id: string
          hora_saida: string
          id?: string
          linha_id: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dia_semana?: number
          embarcacao_id?: string
          hora_saida?: string
          id?: string
          linha_id?: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "horarios_linha_embarcacao_id_fkey"
            columns: ["embarcacao_id"]
            isOneToOne: false
            referencedRelation: "embarcacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_linha_linha_id_fkey"
            columns: ["linha_id"]
            isOneToOne: false
            referencedRelation: "linhas"
            referencedColumns: ["id"]
          },
        ]
      }
      linhas: {
        Row: {
          ativa: boolean
          created_at: string
          empresa_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "linhas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_publica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linhas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          caixa_id: string | null
          created_at: string
          empresa_id: string
          gateway: string | null
          gateway_id: string | null
          id: string
          metodo: Database["public"]["Enums"]["metodo_pagamento"]
          pago_em: string | null
          parcelas: number
          pedido_id: string
          pix_copia_cola: string | null
          status: Database["public"]["Enums"]["status_pagamento"]
          updated_at: string
          valor: number
        }
        Insert: {
          caixa_id?: string | null
          created_at?: string
          empresa_id: string
          gateway?: string | null
          gateway_id?: string | null
          id?: string
          metodo: Database["public"]["Enums"]["metodo_pagamento"]
          pago_em?: string | null
          parcelas?: number
          pedido_id: string
          pix_copia_cola?: string | null
          status?: Database["public"]["Enums"]["status_pagamento"]
          updated_at?: string
          valor: number
        }
        Update: {
          caixa_id?: string | null
          created_at?: string
          empresa_id?: string
          gateway?: string | null
          gateway_id?: string | null
          id?: string
          metodo?: Database["public"]["Enums"]["metodo_pagamento"]
          pago_em?: string | null
          parcelas?: number
          pedido_id?: string
          pix_copia_cola?: string | null
          status?: Database["public"]["Enums"]["status_pagamento"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixa_sessoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_publica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      paradas_linha: {
        Row: {
          created_at: string
          id: string
          linha_id: string
          minutos_desde_origem: number
          ordem: number
          porto_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          linha_id: string
          minutos_desde_origem: number
          ordem: number
          porto_id: string
        }
        Update: {
          created_at?: string
          id?: string
          linha_id?: string
          minutos_desde_origem?: number
          ordem?: number
          porto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paradas_linha_linha_id_fkey"
            columns: ["linha_id"]
            isOneToOne: false
            referencedRelation: "linhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paradas_linha_porto_id_fkey"
            columns: ["porto_id"]
            isOneToOne: false
            referencedRelation: "portos"
            referencedColumns: ["id"]
          },
        ]
      }
      passagens: {
        Row: {
          assento_id: string | null
          bpe_chave: string | null
          bpe_protocolo: string | null
          created_at: string
          destino_ordem: number
          documento: string
          embarcado_em: string | null
          empresa_id: string
          id: string
          nascimento: string | null
          nome: string
          origem_ordem: number
          pedido_id: string
          qr_token: string
          status: Database["public"]["Enums"]["status_passagem"]
          taxa_embarque: number
          telefone: string | null
          tipo: Database["public"]["Enums"]["tipo_passageiro"]
          trecho: unknown
          updated_at: string
          validado_por_id: string | null
          valor: number
          viagem_id: string
        }
        Insert: {
          assento_id?: string | null
          bpe_chave?: string | null
          bpe_protocolo?: string | null
          created_at?: string
          destino_ordem: number
          documento: string
          embarcado_em?: string | null
          empresa_id: string
          id?: string
          nascimento?: string | null
          nome: string
          origem_ordem: number
          pedido_id: string
          qr_token: string
          status?: Database["public"]["Enums"]["status_passagem"]
          taxa_embarque?: number
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_passageiro"]
          trecho?: unknown
          updated_at?: string
          validado_por_id?: string | null
          valor: number
          viagem_id: string
        }
        Update: {
          assento_id?: string | null
          bpe_chave?: string | null
          bpe_protocolo?: string | null
          created_at?: string
          destino_ordem?: number
          documento?: string
          embarcado_em?: string | null
          empresa_id?: string
          id?: string
          nascimento?: string | null
          nome?: string
          origem_ordem?: number
          pedido_id?: string
          qr_token?: string
          status?: Database["public"]["Enums"]["status_passagem"]
          taxa_embarque?: number
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_passageiro"]
          trecho?: unknown
          updated_at?: string
          validado_por_id?: string | null
          valor?: number
          viagem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "passagens_assento_id_fkey"
            columns: ["assento_id"]
            isOneToOne: false
            referencedRelation: "assentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passagens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_publica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passagens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passagens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passagens_validado_por_id_fkey"
            columns: ["validado_por_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passagens_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "viagens"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          agencia_id: string | null
          canal: Database["public"]["Enums"]["canal_venda"]
          cliente_id: string | null
          codigo: string
          comissao_agencia: number
          comprador_email: string | null
          comprador_nome: string
          comprador_telefone: string
          created_at: string
          desconto: number
          empresa_id: string
          expira_em: string | null
          id: string
          numero: string
          status: Database["public"]["Enums"]["status_pedido"]
          subtotal: number
          taxas: number
          total: number
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          agencia_id?: string | null
          canal: Database["public"]["Enums"]["canal_venda"]
          cliente_id?: string | null
          codigo: string
          comissao_agencia?: number
          comprador_email?: string | null
          comprador_nome: string
          comprador_telefone: string
          created_at?: string
          desconto?: number
          empresa_id: string
          expira_em?: string | null
          id?: string
          numero: string
          status?: Database["public"]["Enums"]["status_pedido"]
          subtotal: number
          taxas?: number
          total: number
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          agencia_id?: string | null
          canal?: Database["public"]["Enums"]["canal_venda"]
          cliente_id?: string | null
          codigo?: string
          comissao_agencia?: number
          comprador_email?: string | null
          comprador_nome?: string
          comprador_telefone?: string
          created_at?: string
          desconto?: number
          empresa_id?: string
          expira_em?: string | null
          id?: string
          numero?: string
          status?: Database["public"]["Enums"]["status_pedido"]
          subtotal?: number
          taxas?: number
          total?: number
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_agencia_id_fkey"
            columns: ["agencia_id"]
            isOneToOne: false
            referencedRelation: "agencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_publica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          agencia_id: string | null
          ativo: boolean
          convite_enviado_em: string | null
          created_at: string
          empresa_id: string
          id: string
          nome: string
          onboarding_concluido: boolean
          onboarding_passo: number
          papel: Database["public"]["Enums"]["papel_usuario"]
          telefone: string | null
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          agencia_id?: string | null
          ativo?: boolean
          convite_enviado_em?: string | null
          created_at?: string
          empresa_id: string
          id: string
          nome: string
          onboarding_concluido?: boolean
          onboarding_passo?: number
          papel: Database["public"]["Enums"]["papel_usuario"]
          telefone?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          agencia_id?: string | null
          ativo?: boolean
          convite_enviado_em?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          onboarding_concluido?: boolean
          onboarding_passo?: number
          papel?: Database["public"]["Enums"]["papel_usuario"]
          telefone?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfis_agencia_id_fkey"
            columns: ["agencia_id"]
            isOneToOne: false
            referencedRelation: "agencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_publica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_linhas: {
        Row: {
          created_at: string
          linha_id: string
          perfil_id: string
        }
        Insert: {
          created_at?: string
          linha_id: string
          perfil_id: string
        }
        Update: {
          created_at?: string
          linha_id?: string
          perfil_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfis_linhas_linha_id_fkey"
            columns: ["linha_id"]
            isOneToOne: false
            referencedRelation: "linhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_linhas_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      portos: {
        Row: {
          ativo: boolean
          cidade_id: string
          created_at: string
          endereco: string | null
          id: string
          nome: string
          taxa_embarque: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cidade_id: string
          created_at?: string
          endereco?: string | null
          id?: string
          nome: string
          taxa_embarque?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cidade_id?: string
          created_at?: string
          endereco?: string | null
          id?: string
          nome?: string
          taxa_embarque?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portos_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifas_trecho: {
        Row: {
          created_at: string
          destino_parada_id: string
          id: string
          linha_id: string
          origem_parada_id: string
          updated_at: string
          valor: number
          valor_encomenda_kg: number | null
        }
        Insert: {
          created_at?: string
          destino_parada_id: string
          id?: string
          linha_id: string
          origem_parada_id: string
          updated_at?: string
          valor: number
          valor_encomenda_kg?: number | null
        }
        Update: {
          created_at?: string
          destino_parada_id?: string
          id?: string
          linha_id?: string
          origem_parada_id?: string
          updated_at?: string
          valor?: number
          valor_encomenda_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tarifas_trecho_destino_parada_id_fkey"
            columns: ["destino_parada_id"]
            isOneToOne: false
            referencedRelation: "paradas_linha"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarifas_trecho_linha_id_fkey"
            columns: ["linha_id"]
            isOneToOne: false
            referencedRelation: "linhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarifas_trecho_origem_parada_id_fkey"
            columns: ["origem_parada_id"]
            isOneToOne: false
            referencedRelation: "paradas_linha"
            referencedColumns: ["id"]
          },
        ]
      }
      viagens: {
        Row: {
          comandante: string | null
          created_at: string
          embarcacao_id: string
          empresa_id: string
          id: string
          linha_id: string
          observacao: string | null
          partida: string
          status: Database["public"]["Enums"]["status_viagem"]
          updated_at: string
          vendas_abertas: boolean
        }
        Insert: {
          comandante?: string | null
          created_at?: string
          embarcacao_id: string
          empresa_id: string
          id?: string
          linha_id: string
          observacao?: string | null
          partida: string
          status?: Database["public"]["Enums"]["status_viagem"]
          updated_at?: string
          vendas_abertas?: boolean
        }
        Update: {
          comandante?: string | null
          created_at?: string
          embarcacao_id?: string
          empresa_id?: string
          id?: string
          linha_id?: string
          observacao?: string | null
          partida?: string
          status?: Database["public"]["Enums"]["status_viagem"]
          updated_at?: string
          vendas_abertas?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "viagens_embarcacao_id_fkey"
            columns: ["embarcacao_id"]
            isOneToOne: false
            referencedRelation: "embarcacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_publica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagens_linha_id_fkey"
            columns: ["linha_id"]
            isOneToOne: false
            referencedRelation: "linhas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      empresa_publica: {
        Row: {
          cnpj: string | null
          email: string | null
          id: string | null
          logo_url: string | null
          minutos_reserva_site: number | null
          nome_fantasia: string | null
          razao_social: string | null
          telefone: string | null
          whatsapp: string | null
        }
        Insert: {
          cnpj?: string | null
          email?: string | null
          id?: string | null
          logo_url?: string | null
          minutos_reserva_site?: number | null
          nome_fantasia?: string | null
          razao_social?: string | null
          telefone?: string | null
          whatsapp?: string | null
        }
        Update: {
          cnpj?: string | null
          email?: string | null
          id?: string | null
          logo_url?: string | null
          minutos_reserva_site?: number | null
          nome_fantasia?: string | null
          razao_social?: string | null
          telefone?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      alterar_status_viagem: {
        Args: {
          novo_status: Database["public"]["Enums"]["status_viagem"]
          viagem_id: string
        }
        Returns: Json
      }
      alternar_vendas_viagem: {
        Args: { abertas: boolean; viagem_id: string }
        Returns: Json
      }
      assentos_ocupados: {
        Args: { destino: number; origem: number; viagem_id: string }
        Returns: string[]
      }
      atualizar_onboarding: {
        Args: { p_concluido?: boolean; p_passo: number; p_telefone?: string }
        Returns: undefined
      }
      avancar_encomenda: {
        Args: { codigo: string; descricao?: string }
        Returns: Json
      }
      buscar_viagens: {
        Args: { destino_slug: string; dia?: string; origem_slug: string }
        Returns: Json
      }
      cancelar_pedido: {
        Args: { codigo: string; motivo?: string }
        Returns: Json
      }
      confirmar_pagamento: {
        Args: { p_codigo?: string; p_gateway_id?: string }
        Returns: Json
      }
      criar_encomenda: { Args: { payload: Json }; Returns: Json }
      criar_pedido_balcao: { Args: { payload: Json }; Returns: Json }
      criar_pedido_site: { Args: { payload: Json }; Returns: Json }
      pedido_publico: { Args: { codigo: string }; Returns: Json }
      rastrear_encomenda: { Args: { codigo: string }; Returns: Json }
      resumo_financeiro: {
        Args: { fim: string; inicio: string }
        Returns: Json
      }
      validar_embarque: { Args: { qr_token: string }; Returns: Json }
    }
    Enums: {
      canal_venda: "SITE" | "BALCAO" | "AGENCIA" | "WHATSAPP"
      metodo_pagamento: "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | "DINHEIRO"
      pagador_frete: "REMETENTE" | "DESTINATARIO"
      papel_usuario: "ADMIN" | "GERENTE" | "VENDEDOR" | "CONFERENTE"
      status_embarcacao: "ATIVA" | "MANUTENCAO" | "INATIVA"
      status_encomenda:
        | "RECEBIDA"
        | "EMBARCADA"
        | "EM_TRANSITO"
        | "DISPONIVEL_RETIRADA"
        | "ENTREGUE"
        | "DEVOLVIDA"
      status_pagamento: "PENDENTE" | "APROVADO" | "RECUSADO" | "ESTORNADO"
      status_passagem:
        | "RESERVADA"
        | "EMITIDA"
        | "EMBARCADA"
        | "CANCELADA"
        | "NAO_COMPARECEU"
      status_pedido:
        | "AGUARDANDO_PAGAMENTO"
        | "PAGO"
        | "CANCELADO"
        | "EXPIRADO"
        | "REEMBOLSADO"
      status_viagem:
        | "PROGRAMADA"
        | "EMBARQUE"
        | "EM_CURSO"
        | "CONCLUIDA"
        | "CANCELADA"
      tipo_assento: "POLTRONA" | "POLTRONA_JANELA" | "ESPECIAL"
      tipo_passageiro:
        | "INTEIRA"
        | "CRIANCA"
        | "COLO"
        | "IDOSO"
        | "ESTUDANTE"
        | "PCD"
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
      canal_venda: ["SITE", "BALCAO", "AGENCIA", "WHATSAPP"],
      metodo_pagamento: ["PIX", "CARTAO_CREDITO", "CARTAO_DEBITO", "DINHEIRO"],
      pagador_frete: ["REMETENTE", "DESTINATARIO"],
      papel_usuario: ["ADMIN", "GERENTE", "VENDEDOR", "CONFERENTE"],
      status_embarcacao: ["ATIVA", "MANUTENCAO", "INATIVA"],
      status_encomenda: [
        "RECEBIDA",
        "EMBARCADA",
        "EM_TRANSITO",
        "DISPONIVEL_RETIRADA",
        "ENTREGUE",
        "DEVOLVIDA",
      ],
      status_pagamento: ["PENDENTE", "APROVADO", "RECUSADO", "ESTORNADO"],
      status_passagem: [
        "RESERVADA",
        "EMITIDA",
        "EMBARCADA",
        "CANCELADA",
        "NAO_COMPARECEU",
      ],
      status_pedido: [
        "AGUARDANDO_PAGAMENTO",
        "PAGO",
        "CANCELADO",
        "EXPIRADO",
        "REEMBOLSADO",
      ],
      status_viagem: [
        "PROGRAMADA",
        "EMBARQUE",
        "EM_CURSO",
        "CONCLUIDA",
        "CANCELADA",
      ],
      tipo_assento: ["POLTRONA", "POLTRONA_JANELA", "ESPECIAL"],
      tipo_passageiro: [
        "INTEIRA",
        "CRIANCA",
        "COLO",
        "IDOSO",
        "ESTUDANTE",
        "PCD",
      ],
    },
  },
} as const
