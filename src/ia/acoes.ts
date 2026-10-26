import { chamadosApi } from '@/api/http'
import {
  listarChamados,
  getChamado,
  atualizarStatusChamado,
  responderChamado,
  aceitarChamado,
  registrarAtividade,
  concluirChamado,
  conferirChamado,
  deletarChamado,
  atualizarChamadosEmLote,
  encaminharChamado,
  listarTecnicos,
} from '@/api/chamados'
import {
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  desativarUsuario,
  gerarCodigoPrimeiroAcesso,
  gerarSenhaProvisoria,
  listarEscolas,
} from '@/api/usuarios'
import { listarAtribuicoes, atribuirDia, removerAtribuicao } from '@/api/agenda'
import {
  listarRegrasEncaminhamento,
  salvarRegraEncaminhamento,
  alternarRegraEncaminhamento,
  removerRegraEncaminhamento,
  aplicarEncaminhamentoPendente,
} from '@/api/encaminhamentos'
import {
  criarEquipamento,
  atualizarEquipamento,
  removerEquipamento,
  registrarEmprestimo,
  registrarDevolucao,
  registrarManutencao,
  atualizarStatusManutencao,
  adicionarItemCatalogo,
  removerItemCatalogo,
} from '@/api/sce'
import { marcarNotificacaoLida, marcarTodasNotificacoesLidas } from '@/api/notificacoes'

export const WRITE_TOOLS = new Set<string>([
  'atribuir_agenda',
  'remover_agenda',
  'encaminhar_chamado',
  'atualizar_status_chamado',
  'aceitar_chamado',
  'registrar_atendimento',
  'concluir_chamado',
  'conferir_chamado',
  'responder_chamado',
  'deletar_chamado',
  'atualizar_chamados_em_lote',
  'criar_usuario',
  'atualizar_usuario',
  'desativar_usuario',
  'gerar_codigo_primeiro_acesso',
  'gerar_senha_provisoria',
  'salvar_regra_encaminhamento',
  'alternar_regra_encaminhamento',
  'remover_regra_encaminhamento',
  'aplicar_encaminhamento_pendente',
  'criar_equipamento',
  'atualizar_equipamento',
  'remover_equipamento',
  'registrar_emprestimo',
  'registrar_devolucao',
  'registrar_manutencao',
  'atualizar_status_manutencao',
  'adicionar_item_catalogo',
  'remover_item_catalogo',
  'criar_escola',
  'marcar_notificacao_lida',
  'marcar_todas_notificacoes_lidas',
])

export const ACOES_TOOL_NAMES = new Set<string>([
  'listar_agenda',
  'atribuir_agenda',
  'remover_agenda',
  'encaminhar_chamado',
  'atualizar_status_chamado',
  'aceitar_chamado',
  'registrar_atendimento',
  'concluir_chamado',
  'conferir_chamado',
  'responder_chamado',
  'deletar_chamado',
  'atualizar_chamados_em_lote',
  'listar_usuarios',
  'criar_usuario',
  'atualizar_usuario',
  'desativar_usuario',
  'gerar_codigo_primeiro_acesso',
  'gerar_senha_provisoria',
  'listar_regras_encaminhamento',
  'salvar_regra_encaminhamento',
  'alternar_regra_encaminhamento',
  'remover_regra_encaminhamento',
  'aplicar_encaminhamento_pendente',
  'criar_equipamento',
  'atualizar_equipamento',
  'remover_equipamento',
  'registrar_emprestimo',
  'registrar_devolucao',
  'registrar_manutencao',
  'atualizar_status_manutencao',
  'adicionar_item_catalogo',
  'remover_item_catalogo',
  'criar_escola',
  'marcar_notificacao_lida',
  'marcar_todas_notificacoes_lidas',
])

// ---------- helpers ----------

async function resolverTecnico(ref: unknown): Promise<{ id: string; nome: string }> {
  const tecnicos: any[] = await listarTecnicos()
  const r = String(ref ?? '').trim()
  if (!r) throw new Error('Tecnico nao informado')
  const porId = tecnicos.find((t: any) => t.id === r)
  if (porId) return { id: porId.id, nome: porId.nome }
  const alvo = r.toLowerCase()
  const cand = tecnicos.filter(
    (t: any) =>
      String(t.nome || '').toLowerCase().includes(alvo) ||
      String(t.email || '').toLowerCase().includes(alvo),
  )
  if (cand.length === 1) return { id: cand[0].id, nome: cand[0].nome }
  if (cand.length > 1)
    throw new Error('Tecnico ambiguo: ' + cand.map((t: any) => t.nome).join(', '))
  throw new Error('Tecnico nao encontrado: ' + r)
}

async function resolverUsuario(ref: unknown): Promise<any> {
  const r = String(ref ?? '').trim()
  if (!r) throw new Error('Usuario nao informado')
  let lista: any[] = []
  try {
    const res: any = await listarUsuarios({ search: r, limit: 50 })
    lista = res?.data || []
  } catch {
    lista = []
  }
  const cand = lista.filter(
    (u: any) =>
      u.id === r ||
      String(u.email || '').toLowerCase() === r.toLowerCase() ||
      String(u.nome || '').toLowerCase() === r.toLowerCase() ||
      String(u.nome || '').toLowerCase().includes(r.toLowerCase()),
  )
  if (cand.length === 1) return cand[0]
  if (cand.length > 1) {
    const exato = cand.find(
      (u: any) =>
        u.id === r || String(u.email || '').toLowerCase() === r.toLowerCase(),
    )
    if (exato) return exato
    throw new Error('Usuario ambiguo: ' + cand.map((u: any) => u.nome).join(', '))
  }
  throw new Error('Usuario nao encontrado: ' + r)
}

async function resolverChamado(ref: unknown): Promise<any> {
  const r = String(ref ?? '').trim()
  if (!r) throw new Error('Chamado nao informado')
  try {
    return await getChamado(r)
  } catch {
    // segue para busca
  }
  for (let page = 1; page <= 5; page++) {
    const res: any = await listarChamados({ page, limit: 100 })
    const data: any[] = res?.data || []
    const found = data.find((c: any) => c.id === r || c.protocolo === r)
    if (found) return found
    if (data.length < 100) break
  }
  throw new Error('Chamado nao encontrado: ' + r)
}

async function resolverEscola(ref: unknown): Promise<string> {
  const escolas: string[] = await listarEscolas()
  const r = String(ref ?? '').trim().toLowerCase()
  if (!r) throw new Error('Escola nao informada')
  const cand = escolas.filter(
    (e) => e.toLowerCase() === r || e.toLowerCase().includes(r),
  )
  if (cand.length === 1) return cand[0]
  if (cand.length > 1) {
    const exato = cand.find((e) => e.toLowerCase() === r)
    if (exato) return exato
    throw new Error('Escola ambigua: ' + cand.join(', '))
  }
  throw new Error('Escola nao encontrada: ' + ref)
}

async function resolverRegra(ref: unknown): Promise<any> {
  const lista: any = await listarRegrasEncaminhamento()
  const regras: any[] = lista?.data || []
  const r = String(ref ?? '').trim()
  if (!r) throw new Error('Regra nao informada')
  const cand = regras.filter(
    (x: any) => x.id === r || x.categoriaChave === r,
  )
  if (cand.length === 1) return cand[0]
  if (cand.length > 1) {
    const exato = cand.find((x: any) => x.id === r)
    if (exato) return exato
    throw new Error('Regra ambigua: ' + cand.map((x: any) => x.categoriaChave).join(', '))
  }
  throw new Error('Regra nao encontrada: ' + r)
}

// ---------- tool definitions ----------

export const ACOES_TOOLS: any[] = [
  // Agenda
  {
    type: 'function',
    function: {
      name: 'listar_agenda',
      description: 'Lista atribuicoes da agenda de atendimento (tecnico por dia/escola).',
      parameters: {
        type: 'object',
        properties: {
          inicio: { type: 'string', description: 'Data inicial YYYY-MM-DD' },
          fim: { type: 'string', description: 'Data final YYYY-MM-DD (exclusivo)' },
          tecnicoId: { type: 'string', description: 'Id do tecnico' },
          escola: { type: 'string', description: 'Nome (ou parte) da escola' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'atribuir_agenda',
      description:
        'Atribui um dia da agenda a um tecnico/escola. ACAO DE ESCRITA: apresente resumo e peca confirmacao; so execute com confirmar=true apos "sim".',
      parameters: {
        type: 'object',
        properties: {
          escola: { type: 'string', description: 'Nome da escola' },
          data: { type: 'string', description: 'Data YYYY-MM-DD' },
           tecnico: { type: 'string', description: 'Nome ou id do tecnico' },
           solicitarPonto: { type: 'boolean', description: 'true se deve solicitar ponto (bater ponto) para este atendimento. Se o usuario nao informou, PERGUNTE antes de executar.' },
           observacao: { type: 'string', description: 'Observacao opcional para a atribuicao' },
           confirmar: { type: 'boolean', description: 'true somente apos confirmacao explicita do usuario' },
        },
        required: ['escola', 'data', 'tecnico'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remover_agenda',
      description: 'Remove uma atribuicao da agenda. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Id da atribuicao' },
          confirmar: { type: 'boolean' },
        },
        required: ['id'],
      },
    },
  },
  // Chamados
  {
    type: 'function',
    function: {
      name: 'encaminhar_chamado',
      description: 'Encaminha/reencaminha um chamado para um tecnico. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          chamado: { type: 'string', description: 'Id ou protocolo do chamado' },
          modo: { type: 'string', description: 'UNIDADE ou TECNICO' },
          tecnico: { type: 'string', description: 'Nome ou id do tecnico (obrigatorio se modo=TECNICO)' },
          observacao: { type: 'string', description: 'Observacao opcional' },
          confirmar: { type: 'boolean' },
        },
        required: ['chamado', 'modo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'atualizar_status_chamado',
      description: 'Atualiza o status de um chamado. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          chamado: { type: 'string', description: 'Id ou protocolo' },
          status: { type: 'string', description: 'ABERTO, ENCAMINHADO, ANDAMENTO, COMUNICADO, AGUARDANDO_CONFERENCIA, RESOLVIDO' },
          descricaoResolucao: { type: 'string', description: 'Descricao da resolucao (quando aplicavel)' },
          tecnicoResolucao: { type: 'string', description: 'Nome do tecnico de resolucao' },
          confirmar: { type: 'boolean' },
        },
        required: ['chamado', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'aceitar_chamado',
      description: 'Tecnico aceita o chamado encaminhado. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          chamado: { type: 'string', description: 'Id ou protocolo' },
          confirmar: { type: 'boolean' },
        },
        required: ['chamado'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_atendimento',
      description: 'Registra atividade de atendimento no chamado. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          chamado: { type: 'string', description: 'Id ou protocolo' },
          texto: { type: 'string', description: 'Descricao do que foi feito' },
          equipamentos: { type: 'array', items: { type: 'string' }, description: 'Ids de equipamentos envolvidos' },
          confirmar: { type: 'boolean' },
        },
        required: ['chamado', 'texto'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'concluir_chamado',
      description: 'Conclui o atendimento (passa para aguardando conferencia). ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          chamado: { type: 'string', description: 'Id ou protocolo' },
          texto: { type: 'string', description: 'Descricao da conclusao' },
          equipamentos: { type: 'array', items: { type: 'string' } },
          confirmar: { type: 'boolean' },
        },
        required: ['chamado', 'texto'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'conferir_chamado',
      description: 'Escola confere o chamado (aprovar ou contestar). ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          chamado: { type: 'string', description: 'Id ou protocolo' },
          aprovado: { type: 'boolean', description: 'true aprova e encerra; false contesta' },
          texto: { type: 'string', description: 'Texto (obrigatorio se contestar)' },
          confirmar: { type: 'boolean' },
        },
        required: ['chamado', 'aprovado'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'responder_chamado',
      description: 'Matriz envia pergunta (COMUNICADO) a escola. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          chamado: { type: 'string', description: 'Id ou protocolo' },
          texto: { type: 'string', description: 'Pergunta/mensagem' },
          confirmar: { type: 'boolean' },
        },
        required: ['chamado', 'texto'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deletar_chamado',
      description: 'Exclui logicamente um chamado. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          chamado: { type: 'string', description: 'Id ou protocolo' },
          confirmar: { type: 'boolean' },
        },
        required: ['chamado'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'atualizar_chamados_em_lote',
      description: 'Atualiza varios chamados de uma vez. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          chamados: { type: 'array', items: { type: 'string' }, description: 'Ids ou protocolos' },
          status: { type: 'string', description: 'Novo status' },
          tecnicoResolucao: { type: 'string', description: 'Tecnico de resolucao' },
          resposta: { type: 'string', description: 'Resposta' },
          confirmar: { type: 'boolean' },
        },
        required: ['chamados'],
      },
    },
  },
  // Usuarios
  {
    type: 'function',
    function: {
      name: 'listar_usuarios',
      description: 'Lista usuarios do sistema (todos os niveis).',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Busca por nome/email' },
          nivel: { type: 'string', description: 'ADMIN, TECNICO, GESTOR, VISUALIZADOR' },
          filial: { type: 'string', description: 'Unidade escolar' },
          status: { type: 'string', description: 'ATIVO ou INATIVO' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_usuario',
      description: 'Cria um novo usuario. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          nome: { type: 'string' },
          nivel: { type: 'string', description: 'ADMIN, TECNICO, GESTOR, VISUALIZADOR' },
          filial: { type: 'string', description: 'Unidade(s) escolar(es)' },
          escopoTipos: { type: 'array', items: { type: 'string' }, description: 'Escopo de tipos de chamado' },
          rotasPermitidas: { type: 'array', items: { type: 'string' }, description: 'Rotas permitidas' },
          confirmar: { type: 'boolean' },
        },
        required: ['email', 'nome', 'nivel', 'filial'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'atualizar_usuario',
      description: 'Atualiza um usuario. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          usuario: { type: 'string', description: 'Id, email ou nome do usuario' },
          nome: { type: 'string' },
          nivel: { type: 'string' },
          filial: { type: 'string' },
          status: { type: 'string', description: 'ATIVO ou INATIVO' },
          escopoTipos: { type: 'array', items: { type: 'string' } },
          rotasPermitidas: { type: 'array', items: { type: 'string' } },
          confirmar: { type: 'boolean' },
        },
        required: ['usuario'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'desativar_usuario',
      description: 'Desativa (remove) um usuario. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          usuario: { type: 'string', description: 'Id, email ou nome' },
          confirmar: { type: 'boolean' },
        },
        required: ['usuario'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gerar_codigo_primeiro_acesso',
      description: 'Gera codigo de primeiro acesso para um email. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          confirmar: { type: 'boolean' },
        },
        required: ['email'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gerar_senha_provisoria',
      description: 'Gera senha provisoria para quem ja tem senha e esqueceu. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          confirmar: { type: 'boolean' },
        },
        required: ['email'],
      },
    },
  },
  // Encaminhamentos
  {
    type: 'function',
    function: {
      name: 'listar_regras_encaminhamento',
      description: 'Lista regras de encaminhamento automatico (admin).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'salvar_regra_encaminhamento',
      description: 'Cria ou sobrescreve regra de encaminhamento. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          categoriaChave: { type: 'string', description: 'Chave da categoria do formulario' },
          modo: { type: 'string', description: 'UNIDADE ou TECNICO' },
          tecnico: { type: 'string', description: 'Nome ou id do tecnico (se modo=TECNICO)' },
          ativa: { type: 'boolean', description: 'Liga/desliga a regra' },
          confirmar: { type: 'boolean' },
        },
        required: ['categoriaChave', 'modo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'alternar_regra_encaminhamento',
      description: 'Liga/desliga uma regra sem mexer no destino. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          regra: { type: 'string', description: 'Id da regra ou categoriaChave' },
          ativa: { type: 'boolean' },
          confirmar: { type: 'boolean' },
        },
        required: ['regra', 'ativa'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remover_regra_encaminhamento',
      description: 'Remove uma regra de encaminhamento. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          regra: { type: 'string', description: 'Id da regra ou categoriaChave' },
          confirmar: { type: 'boolean' },
        },
        required: ['regra'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'aplicar_encaminhamento_pendente',
      description: 'Aplica regras ativas nos chamados abertos sem responsavel. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: { confirmar: { type: 'boolean' } },
        required: [],
      },
    },
  },
  // Equipamentos
  {
    type: 'function',
    function: {
      name: 'criar_equipamento',
      description: 'Cadastra um equipamento no SCE. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          unidade: { type: 'string' },
          categoria: { type: 'string' },
          marca: { type: 'string' },
          modelo: { type: 'string' },
          patrimonio: { type: 'string' },
          numeroSerie: { type: 'string' },
          status: { type: 'string' },
          observacoes: { type: 'string' },
          confirmar: { type: 'boolean' },
        },
        required: ['unidade', 'categoria', 'marca', 'modelo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'atualizar_equipamento',
      description: 'Atualiza campos de um equipamento. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Id do equipamento' },
          unidade: { type: 'string' },
          categoria: { type: 'string' },
          marca: { type: 'string' },
          modelo: { type: 'string' },
          patrimonio: { type: 'string' },
          numeroSerie: { type: 'string' },
          status: { type: 'string' },
          observacoes: { type: 'string' },
          confirmar: { type: 'boolean' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remover_equipamento',
      description: 'Remove um equipamento. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          confirmar: { type: 'boolean' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_emprestimo',
      description: 'Registra emprestimo de equipamentos. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: 'Ids dos equipamentos' },
          responsavel: { type: 'string' },
          cpf: { type: 'string' },
          emailResponsavel: { type: 'string' },
          dataPrevistaDevolucao: { type: 'string', description: 'YYYY-MM-DD' },
          observacoes: { type: 'string' },
          tipoEmprestimo: { type: 'string', description: 'interno ou interestadual' },
          escolaDestino: { type: 'string', description: 'Obrigatoria se interestadual' },
          confirmar: { type: 'boolean' },
        },
        required: ['ids', 'responsavel', 'tipoEmprestimo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_devolucao',
      description: 'Registra devolucao de equipamentos. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
          observacao: { type: 'string' },
          confirmar: { type: 'boolean' },
        },
        required: ['ids'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_manutencao',
      description: 'Cria registro de manutencao em um equipamento. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          equipamentoId: { type: 'string' },
          descricao: { type: 'string' },
          status: { type: 'string', description: 'Pendente, Em andamento, Concluido' },
          confirmar: { type: 'boolean' },
        },
        required: ['equipamentoId', 'descricao', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'atualizar_status_manutencao',
      description: 'Muda apenas o status de manutencao. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          equipamentoId: { type: 'string' },
          novoStatus: { type: 'string', description: 'Pendente, Em andamento, Concluido' },
          confirmar: { type: 'boolean' },
        },
        required: ['equipamentoId', 'novoStatus'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'adicionar_item_catalogo',
      description: 'Adiciona item ao catalogo de equipamentos. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          categoria: { type: 'string' },
          marca: { type: 'string' },
          modelo: { type: 'string' },
          confirmar: { type: 'boolean' },
        },
        required: ['categoria', 'marca', 'modelo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remover_item_catalogo',
      description: 'Remove item do catalogo. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Id do item do catalogo' },
          confirmar: { type: 'boolean' },
        },
        required: ['id'],
      },
    },
  },
  // Escolas / Notificacoes
  {
    type: 'function',
    function: {
      name: 'criar_escola',
      description: 'Cadastra uma escola. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string' },
          tecnico: { type: 'string', description: 'Tecnico responsavel' },
          confirmar: { type: 'boolean' },
        },
        required: ['nome', 'tecnico'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'marcar_notificacao_lida',
      description: 'Marca uma notificacao como lida. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          confirmar: { type: 'boolean' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'marcar_todas_notificacoes_lidas',
      description: 'Marca todas as notificacoes como lidas. ACAO DE ESCRITA: confirmar=true apos confirmacao.',
      parameters: {
        type: 'object',
        properties: { confirmar: { type: 'boolean' } },
        required: [],
      },
    },
  },
]

// ---------- dispatcher ----------

export async function executarAcao(nome: string, args: any): Promise<any | null> {
  if (!ACOES_TOOL_NAMES.has(nome)) return null
  const a = args ?? {}
  if (nome === 'atribuir_agenda' && a.solicitarPonto === undefined) {
    return {
      status: 'precisa_informacao',
      acao: nome,
      pergunta: 'Deseja solicitar ponto (bater ponto) para este atendimento? Responda sim ou nao.',
    }
  }
  try {
    if (WRITE_TOOLS.has(nome) && a.confirmar !== true) {
      return {
        status: 'confirmacao_necessaria',
        acao: nome,
        parametros: a,
        instrucao:
          'Apresente um resumo claro desta acao ao usuario e peca confirmacao. ' +
          'So execute chamando a mesma tool novamente com confirmar=true apos o usuario dizer "sim".',
      }
    }

    switch (nome) {
      case 'listar_agenda': {
        const lista = await listarAtribuicoes({
          inicio: a.inicio,
          fim: a.fim,
          tecnicoId: a.tecnicoId,
          escola: a.escola,
        })
        return { total: lista.length, atribuicoes: lista }
      }
      case 'atribuir_agenda': {
        if (a.solicitarPonto === undefined) {
          return {
            status: 'precisa_informacao',
            acao: 'atribuir_agenda',
            pergunta: 'Deseja solicitar ponto (bater ponto) para este atendimento? Responda sim ou nao.',
          }
        }
        const escola = await resolverEscola(a.escola)
        const tec = await resolverTecnico(a.tecnico)
        try {
          const criada = await atribuirDia({
            escola,
            data: String(a.data),
            tecnicoId: tec.id,
            tecnicoNome: tec.nome,
            solicitarPonto: Boolean(a.solicitarPonto),
            observacao: a.observacao,
          })
          return { sucesso: true, atribuicao: criada }
        } catch (e: any) {
          const data = e?.response?.data
          const msg = (typeof data === 'string' ? data : data?.message) || e?.message || 'Falha ao atribuir'
          return { sucesso: false, erro: msg }
        }
      }
      case 'remover_agenda': {
        await removerAtribuicao(String(a.id))
        return { sucesso: true, id: a.id }
      }
      case 'encaminhar_chamado': {
        const c = await resolverChamado(a.chamado)
        const modo = String(a.modo || 'UNIDADE').toUpperCase()
        const payload: any = { modo, observacao: a.observacao }
        if (modo === 'TECNICO') {
          const tec = await resolverTecnico(a.tecnico)
          payload.tecnicoId = tec.id
        }
        const r = await encaminharChamado(c.id, payload)
        return { sucesso: true, chamado: r.chamado, tecnico: r.tecnico }
      }
      case 'atualizar_status_chamado': {
        const c = await resolverChamado(a.chamado)
        const atualizado = await atualizarStatusChamado(c.id, {
          status: a.status,
          descricaoResolucao: a.descricaoResolucao,
          tecnicoResolucao: a.tecnicoResolucao,
        })
        return { sucesso: true, chamado: atualizado }
      }
      case 'aceitar_chamado': {
        const c = await resolverChamado(a.chamado)
        const atualizado = await aceitarChamado(c.id)
        return { sucesso: true, chamado: atualizado }
      }
      case 'registrar_atendimento': {
        const c = await resolverChamado(a.chamado)
        const ativ = await registrarAtividade(c.id, {
          texto: String(a.texto),
          equipamentos: a.equipamentos,
        })
        return { sucesso: true, atividade: ativ }
      }
      case 'concluir_chamado': {
        const c = await resolverChamado(a.chamado)
        const atualizado = await concluirChamado(c.id, {
          texto: String(a.texto),
          equipamentos: a.equipamentos,
        })
        return { sucesso: true, chamado: atualizado }
      }
      case 'conferir_chamado': {
        const c = await resolverChamado(a.chamado)
        const atualizado = await conferirChamado(c.id, {
          aprovado: Boolean(a.aprovado),
          texto: a.texto,
        })
        return { sucesso: true, chamado: atualizado }
      }
      case 'responder_chamado': {
        const c = await resolverChamado(a.chamado)
        const atualizado = await responderChamado(c.id, { texto: String(a.texto) })
        return { sucesso: true, chamado: atualizado }
      }
      case 'deletar_chamado': {
        const c = await resolverChamado(a.chamado)
        await deletarChamado(c.id)
        return { sucesso: true, id: c.id, protocolo: c.protocolo }
      }
      case 'atualizar_chamados_em_lote': {
        const refs: string[] = Array.isArray(a.chamados) ? a.chamados : []
        const ids: string[] = []
        for (const r of refs) {
          const c = await resolverChamado(r)
          ids.push(c.id)
        }
        const r = await atualizarChamadosEmLote(ids, {
          status: a.status,
          tecnicoResolucao: a.tecnicoResolucao,
          resposta: a.resposta,
        })
        return { sucesso: true, ...r }
      }
      case 'listar_usuarios': {
        const r: any = await listarUsuarios({
          search: a.search,
          nivel: a.nivel,
          filial: a.filial,
          status: a.status,
          limit: 100,
        })
        return { total: r?.meta?.total ?? r?.data?.length, usuarios: r?.data }
      }
      case 'criar_usuario': {
        const criado = await criarUsuario({
          email: String(a.email),
          nome: String(a.nome),
          nivel: a.nivel,
          filial: String(a.filial),
          escopoTipos: a.escopoTipos,
          rotasPermitidas: a.rotasPermitidas,
        })
        return { sucesso: true, usuario: criado }
      }
      case 'atualizar_usuario': {
        const u = await resolverUsuario(a.usuario)
        const atualizado = await atualizarUsuario(u.id, {
          nome: a.nome,
          nivel: a.nivel,
          filial: a.filial,
          status: a.status,
          escopoTipos: a.escopoTipos,
          rotasPermitidas: a.rotasPermitidas,
        })
        return { sucesso: true, usuario: atualizado }
      }
      case 'desativar_usuario': {
        const u = await resolverUsuario(a.usuario)
        await desativarUsuario(u.id)
        return { sucesso: true, id: u.id, nome: u.nome }
      }
      case 'gerar_codigo_primeiro_acesso': {
        const r = await gerarCodigoPrimeiroAcesso(String(a.email))
        return { sucesso: true, codigo: r }
      }
      case 'gerar_senha_provisoria': {
        const r = await gerarSenhaProvisoria(String(a.email))
        return { sucesso: true, resultado: r }
      }
      case 'listar_regras_encaminhamento': {
        const lista: any = await listarRegrasEncaminhamento()
        return { categorias: lista?.categorias, tecnicos: lista?.tecnicos, regras: lista?.data }
      }
      case 'salvar_regra_encaminhamento': {
        const payload: any = {
          categoriaChave: String(a.categoriaChave),
          modo: String(a.modo || 'UNIDADE').toUpperCase(),
          ativa: a.ativa !== false,
        }
        if (payload.modo === 'TECNICO') {
          const tec = await resolverTecnico(a.tecnico)
          payload.tecnicoId = tec.id
        }
        const salva = await salvarRegraEncaminhamento(payload)
        return { sucesso: true, regra: salva }
      }
      case 'alternar_regra_encaminhamento': {
        const reg = await resolverRegra(a.regra)
        const atualizada = await alternarRegraEncaminhamento(reg.id, Boolean(a.ativa))
        return { sucesso: true, regra: atualizada }
      }
      case 'remover_regra_encaminhamento': {
        const reg = await resolverRegra(a.regra)
        await removerRegraEncaminhamento(reg.id)
        return { sucesso: true, id: reg.id }
      }
      case 'aplicar_encaminhamento_pendente': {
        const r = await aplicarEncaminhamentoPendente()
        return { sucesso: true, resultado: r }
      }
      case 'criar_equipamento': {
        const payload: any = {
          unidade: String(a.unidade),
          categoria: String(a.categoria),
          marca: String(a.marca),
          modelo: String(a.modelo),
        }
        if (a.patrimonio !== undefined) payload.patrimonio = a.patrimonio
        if (a.numeroSerie !== undefined) payload.numeroSerie = a.numeroSerie
        if (a.status !== undefined) payload.status = a.status
        if (a.observacoes !== undefined) payload.observacoes = a.observacoes
        const r = await criarEquipamento(payload)
        return { sucesso: true, resultado: r }
      }
      case 'atualizar_equipamento': {
        const campos: any = {}
        if (a.unidade !== undefined) campos.unidade = a.unidade
        if (a.categoria !== undefined) campos.categoria = a.categoria
        if (a.marca !== undefined) campos.marca = a.marca
        if (a.modelo !== undefined) campos.modelo = a.modelo
        if (a.patrimonio !== undefined) campos.patrimonio = a.patrimonio
        if (a.numeroSerie !== undefined) campos.numeroSerie = a.numeroSerie
        if (a.status !== undefined) campos.status = a.status
        if (a.observacoes !== undefined) campos.observacoes = a.observacoes
        await atualizarEquipamento(String(a.id), campos)
        return { sucesso: true, id: a.id }
      }
      case 'remover_equipamento': {
        await removerEquipamento(String(a.id))
        return { sucesso: true, id: a.id }
      }
      case 'registrar_emprestimo': {
        const payload: any = {
          ids: a.ids,
          responsavel: String(a.responsavel),
          tipoEmprestimo: String(a.tipoEmprestimo),
        }
        if (a.cpf !== undefined) payload.cpf = a.cpf
        if (a.emailResponsavel !== undefined) payload.emailResponsavel = a.emailResponsavel
        if (a.dataPrevistaDevolucao !== undefined) payload.dataPrevistaDevolucao = a.dataPrevistaDevolucao
        if (a.observacoes !== undefined) payload.observacoes = a.observacoes
        if (a.escolaDestino !== undefined) payload.escolaDestino = a.escolaDestino
        await registrarEmprestimo(payload)
        return { sucesso: true }
      }
      case 'registrar_devolucao': {
        await registrarDevolucao(a.ids, a.observacao)
        return { sucesso: true }
      }
      case 'registrar_manutencao': {
        await registrarManutencao(String(a.equipamentoId), String(a.descricao), a.status)
        return { sucesso: true }
      }
      case 'atualizar_status_manutencao': {
        await atualizarStatusManutencao(String(a.equipamentoId), a.novoStatus)
        return { sucesso: true }
      }
      case 'adicionar_item_catalogo': {
        const r = await adicionarItemCatalogo(String(a.categoria), String(a.marca), String(a.modelo))
        return { sucesso: true, item: r }
      }
      case 'remover_item_catalogo': {
        await removerItemCatalogo(Number(a.id))
        return { sucesso: true, id: a.id }
      }
      case 'criar_escola': {
        const r = await chamadosApi.post('/escolas', {
          nome: String(a.nome),
          tecnico: String(a.tecnico),
        })
        return { sucesso: true, escola: r.data }
      }
      case 'marcar_notificacao_lida': {
        await marcarNotificacaoLida(String(a.id))
        return { sucesso: true, id: a.id }
      }
      case 'marcar_todas_notificacoes_lidas': {
        await marcarTodasNotificacoesLidas()
        return { sucesso: true }
      }
      default:
        return { erro: 'acao desconhecida' }
    }
  } catch (e: any) {
    const msg =
      e?.response?.data?.message ||
      e?.response?.data?.error ||
      e?.message ||
      String(e)
    return { erro: msg }
  }
}