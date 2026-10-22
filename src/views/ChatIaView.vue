<template>
  <div class="chat-shell" :class="{ collapsed: !historyOpen, compact }">
    <aside class="rail">
      <button class="rail-toggle" @click="historyOpen = !historyOpen" :title="historyOpen ? 'Recolher historico' : 'Expandir historico'">
        <component :is="historyOpen ? PanelLeftClose : PanelLeftOpen" :size="16" />
      </button>
      <Transition name="fade-slide">
        <div v-if="historyOpen" class="rail-body">
          <header class="rail-head">
<div class="brand">
              <img class="brand-logo" src="/logoCafeIA.png" alt="CafeIA" />
              <div class="brand-text">
                <strong>Caf&eacute;IA</strong>
                <small>Portal URE Leste 3</small>
              </div>
            </div>
            <button class="new-btn" @click="novaConversa">
              <Plus :size="15" /> Nova
            </button>
          </header>

          <div class="rail-list">
            <button
              v-for="c in conversas"
              :key="c.id"
              class="conv"
              :class="{ active: c.id === convId }"
              @click="selecionarConv(c.id)"
            >
              <MessageSquare :size="14" class="conv-icon" />
              <span class="conv-body">
                <span class="conv-title">{{ c.title }}</span>
                <span class="conv-meta">{{ quando(c.atualizado) }}</span>
              </span>
              <span
                class="conv-del"
                title="Excluir conversa"
                @click.stop="excluirConversa(c.id)"
              >
                <Trash2 :size="13" />
              </span>
            </button>
            <p v-if="!conversas.length" class="rail-empty">Nenhuma conversa salva</p>
          </div>

          <footer class="rail-foot">
            <button class="refresh-btn" @click="recarregar" :disabled="carregandoDados">
              <RefreshCw :size="14" :class="{ spin: carregandoDados }" />
              {{ carregandoDados ? 'Carregando...' : 'Atualizar dados' }}
            </button>
          </footer>
        </div>
      </Transition>
    </aside>

    <section class="stage">
      <header class="stage-head">
        <div class="stage-title">
          <h1>Caf&eacute;IA</h1>
          <p>Assistente do portal</p>
        </div>
        <div class="stage-actions">
          <button class="model-btn" @click="toggleModelos" :disabled="carregandoModelos">
            <Cpu :size="15" /> Selecionar modelo
          </button>
        </div>
        <Transition name="fade-slide">
          <div v-if="painelModelos" class="model-panel">
            <header>
              <strong>Modelos disponíveis</strong>
              <button @click="painelModelos = false">&times;</button>
            </header>
            <input
              v-model="buscaModelo"
              class="model-search"
              placeholder="Filtrar modelo..."
              spellcheck="false"
            />
            <div class="model-list">
              <button
                v-for="m in modelosFiltrados"
                :key="m"
                class="model-item"
                :class="{ active: m === modeloIa }"
                @click="escolherModelo(m)"
              >{{ m }}</button>
              <p v-if="carregandoModelos">Carregando...</p>
              <p v-else-if="!modelosFiltrados.length">Nenhum modelo encontrado.</p>
            </div>
          </div>
        </Transition>

      </header>

      <div v-if="status" class="stage-status">
        <Loader2 v-if="carregandoDados" :size="13" class="spin" />
        <CheckCircle2 v-else :size="13" />
        {{ status }}
      </div>

      <div class="stream" ref="chatBox">
<div v-if="!mensagens.length" class="welcome">
          <div class="welcome-cup" aria-hidden="true">
            <img class="cup-logo" src="/logoCafeIA.png" alt="" />
          </div>
          <h2>Ola, {{ nomeUsuario }}</h2>
          <p v-if="carregandoDados" class="brewing">
            Espere um pouco, o cafe ja esta passando!
            <span class="dot-wave"><i></i><i></i><i></i></span>
          </p>
          <p v-else>Pergunte sobre chamados, equipamentos, tecnicos e escolas. Eu consulto os dois banco de dados do portal.</p>
          <div class="chips" v-if="!carregandoDados && !compact">
            <button v-for="s in sugestoes" :key="s" class="chip" @click="perguntar(s)">{{ s }}</button>
          </div>
        </div>

        <TransitionGroup name="msg" tag="div" class="stream-inner">
          <article v-for="(m, i) in mensagens" :key="i" class="msg" :class="m.role">
            <div class="who-avatar" :class="m.role">
              <span v-if="m.role === 'user'">{{ inicialUsuario }}</span>
              <img v-else class="ava-logo" src="/logoCafeIA.png" alt="" />
            </div>
            <div class="who-body">
              <span class="who-name">{{ m.role === 'user' ? nomeUsuario : 'Caf&eacute;IA' }}</span>
              <div class="bubble" v-html="formatarTexto(m.content)"></div>
            </div>
          </article>
        </TransitionGroup>

        <Transition name="msg">
          <article v-if="enviando" class="msg assistant">
            <div class="who-avatar assistant"><img class="ava-logo" src="/logoCafeIA.png" alt="" /></div>
            <div class="who-body">
              <span class="who-name">Caf&eacute;IA</span>
              <div class="bubble typing">
                <span class="dot-wave"><i></i><i></i><i></i></span>
                <span class="typing-note">{{ ferramentaAtual ? ROTULO_TOOL[ferramentaAtual] || 'consultando os backends' : 'consultando os backends' }}</span>
              </div>
            </div>
          </article>
        </Transition>
      </div>

      <form class="composer" @submit.prevent="enviar">
        <div class="composer-field">
          <Sparkles :size="16" class="composer-icon" />
          <input
            v-model="entrada"
            placeholder="Ex.: quais escolas tem mais chamados abertos?"
            :disabled="enviando"
          />
        </div>
        <button class="send" type="submit" :disabled="enviando || !entrada.trim()" title="Enviar">
          <Send :size="17" />
        </button>
      </form>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
const props = defineProps<{ compact?: boolean }>()
const compact = props.compact ?? false
import {
  CheckCircle2,
  Cpu,
  Loader2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
} from '@lucide/vue'
import { listarChamados } from '@/api/chamados'
import { chamadosApi } from '@/api/http'
import { listarUsuarios, listarEscolas } from '@/api/usuarios'
import { listarNotificacoes } from '@/api/notificacoes'
import { buscarLinkInternetPorEscola } from '@/utils/linksInternet'
import { LINKS_INTERNET } from '@/data/linksInternetData'
import { listarEquipamentosGlobal, listarEmprestimosAtivos } from '@/api/sce'
import { obterDvr } from '@/api/dvr'
import { listarPainelUnidades } from '@/api/escolas'
import { useAuthStore } from '@/stores/auth'
import { ACOES_TOOLS, executarAcao, WRITE_TOOLS } from '@/ia/acoes'
import { useContextoIA } from '@/composables/useContextoIA'

interface Msg { role: 'user' | 'assistant' | 'tool'; content: string; reasoning_content?: string }

const auth = useAuthStore()
const { resumo, carregando: carregandoDados, status, carregar, recarregar: recarregarBase } = useContextoIA()
const nomeUsuario = (auth.user?.nome || 'Usuario').split(' ')[0]
const inicialUsuario = nomeUsuario.charAt(0).toUpperCase()
const mensagens = ref<Msg[]>([])
const entrada = ref('')
const enviando = ref(false)
const chatBox = ref<HTMLElement | null>(null)
const historyOpen = ref(!compact)
const sugestoes = [
  'Quais escolas tem mais chamados abertos?',
  'Qual tecnico mais resolveu chamados?',
  'Escolas com mais equipamentos disponiveis',
  'Quantos chamados tem em aberto?',
  'Agende os tecnicos da lista na agenda',
]

interface Conv { id: string; title: string; mensagens: Msg[]; atualizado: number }

const conversas = ref<Conv[]>([])
const convId = ref<string>('')

function carregarHistorico() {
  try {
    const raw = localStorage.getItem('chat-conversas')
    if (raw) conversas.value = JSON.parse(raw) as Conv[]
  } catch { conversas.value = [] }
  if (!conversas.value.length) novaConversa()
  else {
    convId.value = conversas.value.slice().sort((a, b) => b.atualizado - a.atualizado)[0].id
    const c = conversas.value.find((x) => x.id === convId.value)
    if (c) mensagens.value = Array.isArray(c.mensagens) ? c.mensagens : []
  }
}
function salvarHistorico() {
  localStorage.setItem('chat-conversas', JSON.stringify(conversas.value))
}
function novaConversa() {
  const c: Conv = { id: String(Date.now()), title: 'Nova conversa', mensagens: [], atualizado: Date.now() }
  conversas.value.unshift(c)
  convId.value = c.id
  mensagens.value = []
  salvarHistorico()
}
function selecionarConv(id?: string) {
  if (id) convId.value = id
  const c = conversas.value.find((x) => x.id === convId.value)
  if (c) mensagens.value = Array.isArray(c.mensagens) ? [...c.mensagens] : []
}

watch(mensagens, (v) => {
  const c = conversas.value.find((x) => x.id === convId.value)
  if (!c) return
  c.mensagens = v
  c.atualizado = Date.now()
  if (c.title === 'Nova conversa' && v.length) c.title = v[0].content.slice(0, 30)
  salvarHistorico()
}, { deep: true })

function formatarTexto(txt: string) {
  const esc = txt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}
function rolarParaBaixo() {
  nextTick(() => {
    if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight
  })
}

function quando(ts: number) {
  const d = new Date(ts)
  const hoje = new Date()
  const mesmoDia = d.toDateString() === hoje.toDateString()
  return mesmoDia
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function perguntar(texto: string) {
  entrada.value = texto
  enviar()
}

function excluirConversa(id: string) {
  const i = conversas.value.findIndex((c) => c.id === id)
  if (i === -1) return
  conversas.value.splice(i, 1)
  if (!conversas.value.length) {
    novaConversa()
  } else if (convId.value === id) {
    const primeira = conversas.value.slice().sort((a, b) => b.atualizado - a.atualizado)[0]
    selecionarConv(primeira.id)
  }
  salvarHistorico()
}

const TOOLS_LEITURA: any[] = [
  {
    type: 'function',
    function: {
      name: 'listar_chamados',
      description: 'Lista chamados com filtro por status, unidade (escola) e responsavel (tecnico).',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Status do chamado (ex.: ABERTO, RESOLVIDO)' },
          unidade: { type: 'string', description: 'Nome (ou parte) da escola/unidade' },
          responsavel: { type: 'string', description: 'Nome do tecnico responsavel (ou parte)' },
          limite: { type: 'number', description: 'Quantidade (max 100)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_equipamentos',
      description: 'Lista equipamentos com filtro por status, unidade, busca, categoria, marca e modelo.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Status do equipamento' },
          unidade: { type: 'string', description: 'Nome (ou parte) da escola/unidade' },
          busca: { type: 'string', description: 'Busca livre (patrimonio, serie, modelo)' },
          categoria: { type: 'string', description: 'Categoria do equipamento' },
          marca: { type: 'string', description: 'Marca' },
          modelo: { type: 'string', description: 'Modelo' },
          limite: { type: 'number', description: 'Quantidade (max 500)' },
        },
        required: [],
      },
    },
  },
{
    type: 'function',
    function: {
      name: 'resumo_chamados',
      description:
        'Conta chamados agregando por tipo, status, unidade e responsavel (tecnico). ' +
        'Filtros opcionais por responsavel (tecnico), status e unidade. ' +
        'Os responsaveis ja vem normalizados (sem diferenca de caixa ou espaco), entao cada chave e uma pessoa so - ' +
        'NAO invente ressalva de grafia duplicada. ' +
        'Use SEMPRE para perguntas do tipo "quais tipos o tecnico X resolveu", "quantos chamados por tipo", "tipos mais comum".',
      parameters: {
        type: 'object',
        properties: {
          responsavel: { type: 'string', description: 'Nome do tecnico responsavel' },
          status: { type: 'string', description: 'Ex.: ABERTO, RESOLVIDO' },
          unidade: { type: 'string', description: 'Nome (ou parte) da escola' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resumo_equipamentos',
      description:
        'Conta equipamentos agregando por status, categoria, modelo e unidade. Filtros opcionais por status, unidade, categoria, marca e modelo.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Ex.: Disponivel, Quebrado, Em Manutencao' },
          unidade: { type: 'string', description: 'Nome (ou parte) da escola' },
          categoria: { type: 'string', description: 'Categoria' },
          marca: { type: 'string', description: 'Marca' },
          modelo: { type: 'string', description: 'Modelo' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_tecnicos',
      description: 'Lista técnicos cadastrados e as escolas (filial) que atendem.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_escolas',
      description: 'Lista escolas cadastradas (nomes).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_notificacoes',
      description: 'Lista notificacoes do usuario logado e quantas nao lidas.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_emprestimos_ativos',
      description: 'Lista emprestimos ativos de equipamentos (com atraso).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'obter_dvr',
      description: 'Resumo do monitor de DVRs: totais, online/offline e por escola.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_link_internet',
      description: 'Busca o link de internet de uma escola (provedor, velocidade, status).',
      parameters: {
        type: 'object',
        properties: { escola: { type: 'string', description: 'Nome da escola' } },
        required: ['escola'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_links_internet',
      description: 'Lista os links de internet de todas as unidades.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_painel_unidades',
      description: 'Painel de unidades: tecnico, inventario, chamados por predio.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
]
 
const tools: any[] = [...TOOLS_LEITURA, ...ACOES_TOOLS]
 
/**
 * Chave de agrupamento de pessoa: sem caixa e sem espaço sobrando.
 *
 * O `responsavel` chega do backend como o texto que alguém digitou no
 * atendimento: "JESSICA", "Jessica" e " Jessica " são a mesma pessoa e viravam
 * três linhas no ranking. Quem responde pelo chamado não é pessoa nenhuma
 * ("SEINTEC", "SEINTEC-LESTE3") e fica como está — mexer nisso é adivinhação.
 */
function normalizarNome(valor: unknown): string {
  return String(valor ?? '').trim().replace(/\s+/g, ' ').toUpperCase()
}

/** Roda `fn` para os índices 0..n-1, no máximo `concorrencia` por vez.
 *
 * As tools de resumo varrem a base INTEIRA (dezenas de páginas). Pages uma por
 * uma, uma pergunta levava minutos — e o composer fica travado esse tempo
 * todo, parecendo que a mensagem não saiu. Aqui a varredura encurta para
 * segundos sem trocar o número de registros lido.
 */
async function emLotes<T>(n: number, concorrencia: number, fn: (i: number) => Promise<T[]>): Promise<T[]> {
  const resultados: T[][] = []
  let proxima = 0
  const trabalhadores = Array.from({ length: Math.min(concorrencia, Math.max(n, 1)) }, async () => {
    while (proxima < n) {
      const i = proxima++
      resultados.push(await fn(i))
    }
  })
  await Promise.all(trabalhadores)
  return resultados.flat() as T[]
}

/** Cache de sessão: evita revarrer a base a cada pergunta. */
let cacheTodosChamados: { dados: any[]; ts: number } | null = null
/** Todos os chamados, paginados em paralelo. */
async function todosChamados(): Promise<any[]> {
  const TTL = 5 * 60 * 1000
  if (cacheTodosChamados && Date.now() - cacheTodosChamados.ts < TTL) return cacheTodosChamados.dados
  const LIMITE = 100
  const MAX_PAGINAS = 40
  const primeira: any = await listarChamados({ page: 1, limit: LIMITE })
  const base = primeira.data || []
  const total = Number(primeira.meta?.total ?? base.length)
  const paginas = Math.min(Math.ceil(total / LIMITE), MAX_PAGINAS) - 1
  if (paginas <= 0) {
    cacheTodosChamados = { dados: base, ts: Date.now() }
    return base
  }
  const resto = await emLotes(paginas, 5, async (i) => {
    const r: any = await listarChamados({ page: i + 2, limit: LIMITE })
    return r.data || []
  })
  const dados = [...base, ...resto]
  cacheTodosChamados = { dados, ts: Date.now() }
  return dados
}

let cacheTodosEquipamentos: { dados: any[]; ts: number } | null = null
/** Todos os equipamentos, paginados em paralelo. */
async function todosEquipamentos(): Promise<any[]> {
  const TTL = 5 * 60 * 1000
  if (cacheTodosEquipamentos && Date.now() - cacheTodosEquipamentos.ts < TTL) return cacheTodosEquipamentos.dados
  const LIMITE = 500
  const MAX_PAGINAS = 60
  const primeira: any = await listarEquipamentosGlobal({ limite: LIMITE, offset: 0 })
  const base = primeira.data || []
  const total = Number(primeira.total ?? base.length)
  const paginas = Math.min(Math.ceil(total / LIMITE), MAX_PAGINAS) - 1
  if (paginas <= 0) {
    cacheTodosEquipamentos = { dados: base, ts: Date.now() }
    return base
  }
  const resto = await emLotes(paginas, 5, async (i) => {
    const r: any = await listarEquipamentosGlobal({ limite: LIMITE, offset: (i + 1) * LIMITE })
    return r.data || []
  })
  const dados = [...base, ...resto]
  cacheTodosEquipamentos = { dados, ts: Date.now() }
  return dados
}

/**
 * Cache das tools durante UMA pergunta.
 *
 * O modelo repete a mesma chamada com os mesmos argumentos com frequência (a
 * descrição das tools manda contar por tipo E por status). Sem cache, cada
 * repetição varria a base de novo.
 */
const cacheTools = new Map<string, unknown>()

/** Nome da tool rodando agora, para o "consultando" dizer o que está fazendo. */
const ferramentaAtual = ref('')

const ROTULO_TOOL: Record<string, string> = {
  listar_chamados: 'lendo os chamados',
  listar_equipamentos: 'lendo os equipamentos',
  resumo_chamados: 'contando os chamados',
  resumo_equipamentos: 'contando os equipamentos',
  consultar_tecnicos: 'consultando os técnicos',
}

async function executarTool(nome: string, args: any) {
  const chave = `${nome}:${JSON.stringify(args ?? {})}`
  const ehEscrita = WRITE_TOOLS.has(nome)
  if (!ehEscrita && cacheTools.has(chave)) return cacheTools.get(chave)
  ferramentaAtual.value = nome
  const saida = await executarToolSemCache(nome, args)
  if (!ehEscrita) cacheTools.set(chave, saida)
  return saida
}

async function executarToolSemCache(nome: string, args: any) {
  const resultadoAcao = await executarAcao(nome, args)
  if (resultadoAcao !== null) return resultadoAcao
  if (nome === 'listar_chamados') {
    const r: any = await listarChamados({
      status: args.status,
      unidade: args.unidade,
      responsavel: args.responsavel,
      categoria: args.categoria,
      categoriaChave: args.categoriaChave,
      urgencia: args.urgencia,
      page: args.pagina || 1,
      limit: Math.min(args.limite || 50, 100),
    })
    const dados = (r.data || []).map((c: any) => ({ protocolo: c.protocolo, tipo: c.tipo, status: c.status, unidade: c.unidade, urgencia: c.urgencia, responsavel: c.responsavel, abertura: c.timestamp, descricao: c.descricao?.slice(0, 200) }))
    return { total: r.meta?.total ?? r.data?.length, dados }
  }
  if (nome === 'listar_equipamentos') {
    const r: any = await listarEquipamentosGlobal({
      status: args.status,
      unidade: args.unidade,
      busca: args.busca,
      categoria: args.categoria,
      marca: args.marca,
      modelo: args.modelo,
      limite: Math.min(args.limite || 100, 500),
      offset: 0,
    })
    const dadosEq = (r.data || []).map((e: any) => ({ id: e.id, categoria: e.categoria, marca: e.marca, modelo: e.modelo, status: e.status, unidade: e.unidade, patrimonio: e.patrimonio }))
    return { total: r.total, dados: dadosEq }
  }
  if (nome === 'consultar_tecnicos') {
    const primeira: any = await listarUsuarios({ page: 1, limit: 100 })
    const total = Number(primeira.meta?.total ?? (primeira.data || []).length)
    const paginas = Math.min(Math.ceil(total / 100), 39)
    const restantes = paginas > 1
      ? await emLotes(paginas - 1, 4, async (i) => {
          const r: any = await listarUsuarios({ page: i + 2, limit: 100 })
          return r.data || []
        })
      : []
    const lista: any[] = []
    for (const u of [...(primeira.data || []), ...restantes.flat()]) {
      if (u.nivel === 'TECNICO') lista.push({ nome: u.nome, escolas: u.filial })
    }
    return { tecnicos: lista }
  }
  if (nome === 'listar_escolas') {
    const escolas = await listarEscolas()
    return { total: escolas.length, escolas }
  }
  if (nome === 'listar_notificacoes') {
    const r: any = await listarNotificacoes()
    return { naoLidas: r?.naoLidas ?? 0, notificacoes: r?.data ?? [] }
  }
  if (nome === 'listar_emprestimos_ativos') {
    const r = await listarEmprestimosAtivos()
    return { total: r.length, emprestimos: r }
  }
  if (nome === 'obter_dvr') {
    const r = await obterDvr()
    return {
      total: r.total,
      online: r.online,
      offline: r.offline,
      desconhecido: r.desconhecido,
      percentualOnline: r.percentualOnline,
      caidosAgora: r.caidosAgora,
      porEscola: (r.porFaixa || []).map((e: any) => ({
        escola: e.rotulo,
        total: e.total,
        online: e.online,
        offline: e.offline,
        desconhecido: e.desconhecido,
      })),
    }
  }
  if (nome === 'buscar_link_internet') {
    const r = buscarLinkInternetPorEscola(String(args.escola || ''))
    if (!r) return { erro: 'Link nao encontrado para esta escola' }
    return {
      escola: r.escola,
      empresa: r.empresa,
      velocidadeMbps: r.velocidadeMbps,
      status: r.status,
      possuiSegundoLink: r.possuiSegundoLink,
      endereco: r.endereco,
      observacoes: r.observacoes,
    }
  }
  if (nome === 'listar_links_internet') {
    const dados = LINKS_INTERNET.map((r: any) => ({
      escola: r.escola,
      empresa: r.empresa,
      velocidadeMbps: r.velocidadeMbps,
      status: r.status,
      possuiSegundoLink: r.possuiSegundoLink,
    }))
    return { total: dados.length, links: dados }
  }
  if (nome === 'listar_painel_unidades') {
    const r = await listarPainelUnidades()
    return { total: r.length, unidades: r }
  }
  if (nome === 'resumo_chamados') {
    const porTipo: Record<string, number> = {}
    const porStatus: Record<string, number> = {}
    const porUnidade: Record<string, number> = {}
    const porTecnico: Record<string, number> = {}
    const filtroResp = args.responsavel ? normalizarNome(args.responsavel) : ''
    const filtroStatus = args.status ? String(args.status).toUpperCase() : ''
    const filtroUnidade = args.unidade ? String(args.unidade).toLowerCase() : ''
    let total = 0
    for (const c of await todosChamados()) {
      if (filtroResp && !normalizarNome(c.responsavel).includes(filtroResp)) continue
      if (filtroStatus && String(c.status || '').toUpperCase() !== filtroStatus) continue
      if (filtroUnidade && !String(c.unidade || '').toLowerCase().includes(filtroUnidade)) continue
      total++
      const tipo = c.tipo || 'sem tipo'
      const status = c.status || 'sem status'
      const unidade = c.unidade || 'sem unidade'
      porTipo[tipo] = (porTipo[tipo] || 0) + 1
      porStatus[status] = (porStatus[status] || 0) + 1
      porUnidade[unidade] = (porUnidade[unidade] || 0) + 1
      if (c.responsavel) {
        const nome = normalizarNome(c.responsavel)
        if (nome) porTecnico[nome] = (porTecnico[nome] || 0) + 1
      }
    }
    const ordenar = (o: Record<string, number>) =>
      Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]))
    return { total, porTipo: ordenar(porTipo), porStatus: ordenar(porStatus), porUnidade: ordenar(porUnidade), porTecnico: ordenar(porTecnico) }
  }

  if (nome === 'resumo_equipamentos') {
    const porStatus: Record<string, number> = {}
    const porCategoria: Record<string, number> = {}
    const porModelo: Record<string, number> = {}
    const porUnidade: Record<string, number> = {}
    const filtroStatus = args.status ? String(args.status).toLowerCase() : ''
    const filtroUnidade = args.unidade ? String(args.unidade).toLowerCase() : ''
    const filtroCategoria = args.categoria ? String(args.categoria).toLowerCase() : ''
    const filtroMarca = args.marca ? String(args.marca).toLowerCase() : ''
    const filtroModelo = args.modelo ? String(args.modelo).toLowerCase() : ''
    let total = 0
    for (const e of await todosEquipamentos()) {
      if (filtroStatus && !String(e.status || '').toLowerCase().includes(filtroStatus)) continue
      if (filtroUnidade && !String(e.unidade || '').toLowerCase().includes(filtroUnidade)) continue
      if (filtroCategoria && !String(e.categoria || '').toLowerCase().includes(filtroCategoria)) continue
      if (filtroMarca && !String(e.marca || '').toLowerCase().includes(filtroMarca)) continue
      if (filtroModelo && !String(e.modelo || '').toLowerCase().includes(filtroModelo)) continue
      total++
      const st = e.status || 'sem status'
      const cat = e.categoria || 'sem categoria'
      const mod = [e.marca, e.modelo].filter(Boolean).join(' ') || 'sem modelo'
      const uni = e.unidade || 'sem unidade'
      porStatus[st] = (porStatus[st] || 0) + 1
      porCategoria[cat] = (porCategoria[cat] || 0) + 1
      porModelo[mod] = (porModelo[mod] || 0) + 1
      porUnidade[uni] = (porUnidade[uni] || 0) + 1
    }
    const ordenar = (o: Record<string, number>) =>
      Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]))
    return { total, porStatus: ordenar(porStatus), porCategoria: ordenar(porCategoria), porModelo: ordenar(porModelo), porUnidade: ordenar(porUnidade) }
  }

  return { erro: 'tool desconhecida' }
}

async function enviar() {
  if (enviando.value) return
  if (!entrada.value.trim()) return
  if (!convId.value || !conversas.value.find((c) => c.id === convId.value)) {
    novaConversa()
  }
  const texto = entrada.value.trim()
  entrada.value = ''
  mensagens.value.push({ role: 'user', content: texto })
  enviando.value = true
  ferramentaAtual.value = ''
  cacheTools.clear()
  rolarParaBaixo()
  let ultimaReasoning = ''
const msgs: any[] = [
    {
      role: 'system',
      content:
        'Voce e um assistente do Portal URE Leste 3. Responda em portugues, de forma concisa e objetiva. ' +
        'Use as tools para TODO detalhe que nao esteja no resumo - elas consultam a base inteira dos dois backends. ' +
        'Para contar tipos/categorias/status use resumo_chamados e resumo_equipamentos; para ver registros use ' +
        'listar_chamados e listar_equipamentos. NUNCA diga que nao tem acesso a um dado antes de chamar a tool ' +
        'correspondente. Ao perguntar sobre uma pessoa/tecnico, use o nome exato e chame resumo_chamados/listar_chamados ' +
        'com responsavel; nao infira a partir de perguntas anteriores. ' +
        'Use os filtros disponiveis nas tools (status, unidade, categoria, marca, modelo, busca, responsavel) ' +
        'em vez de baixar tudo. ' +
        'Voce tambem pode EXECUTAR ACOES (agendar tecnico, encaminhar/atualizar/concluir/conferir chamados, ' +
        'gerenciar usuarios, equipamentos, regras de encaminhamento, notificacoes). Toda acao de escrita exige ' +
        'confirmacao explicita: primeiro apresente um resumo claro do que sera feito e peca "Confirma?"; ' +
        'so chame a tool com confirmar=true depois de um "sim" explicito. Se a tool retornar ' +
        'confirmacao_necessaria, faca isso. Nunca execute acao destrutiva sem confirmacao. ' +
        'Resumo:\n' + resumo.value,
    },
    ...mensagens.value.slice(-6).map((m) => ({ role: m.role, content: m.content, ...(m.reasoning_content ? { reasoning_content: m.reasoning_content } : {}) })),
  ]

  // A chamada sai para o backend, nunca para o provedor: e o que tira a chave
  // do bundle e destrava a NVIDIA, que nao libera CORS para o navegador. O
  // backend devolve no mesmo formato da OpenAI, entao o loop de tools abaixo e
  // identico ao de antes - so muda o destino da requisição.
  //
  // `passo` limita o vaivem de tools. Antes parava em 6 e mostrava "consultou
  // demais vezes"; agora damos muito mais espaço e, ao chegar no limite, fazemos
  // uma chamada FINAL sem tools para forcar a resposta (em vez de desistir).
  const MAX_PASSOS_TOOLS = 24
  async function perguntarAoBackend(passo = 0): Promise<string> {
    if (passo > MAX_PASSOS_TOOLS + 1) throw new Error('Modelo excedeu o limite de consultas')
    const forcarResposta = passo >= MAX_PASSOS_TOOLS
    // 120 s: o default do client (30 s) e curto demais para uma pergunta com
    // tools — `resumo_chamados` pagina a base inteira antes de responder.
    const payload: any = {
      messages: msgs,
      temperature: 0.2,
      max_tokens: 4000,
      modelo: modeloIa.value,
    }
    if (forcarResposta) {
      payload.tool_choice = 'none'
    } else {
      payload.tools = tools
      payload.tool_choice = 'auto'
    }
    const { data: res } = await chamadosApi.post<any>('/ia/chat', payload, { timeout: 120000 })

    const choice = res?.choices?.[0]
    const message = choice?.message
    if (!message) throw new Error('Resposta sem message')

    if (!forcarResposta && choice.finish_reason === 'tool_calls' && message.tool_calls?.length) {
      msgs.push(message)
      for (const tc of message.tool_calls) {
        let args: any = {}
        try {
          args = JSON.parse(tc.function.arguments || '{}')
        } catch {
          args = {}
        }
        const result = await executarTool(tc.function.name, args)
        msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
      }
      return perguntarAoBackend(passo + 1)
    }

    // `reasoning_content` e `reasoning` sao o rascunho interno do modelo. Nunca
    // vao para a tela: vazam o system prompt e leem como lixo.
    const conteudo = message.content || ''
    ultimaReasoning = (message.reasoning_content || message.reasoning || '').trim()
    if (!conteudo.trim()) throw new Error('Resposta vazia')
    return conteudo
  }

  let resposta = 'Sem resposta.'
  let erroFinal = ''
  try {
    resposta = await perguntarAoBackend()
  } catch (e: any) {
    const data = e?.response?.data
    let detalhe = ''
    if (data) {
      if (typeof data === 'string') detalhe = data
      else detalhe = data.message || data.error || (data.details ? JSON.stringify(data.details) : '') || JSON.stringify(data)
    }
    erroFinal = detalhe || String(e?.message || e)
    console.error('[CafeIA] falhou', e)
  }
  if (erroFinal) {
    const msg = erroFinal
    let texto = 'Não foi possível obter resposta. Tente novamente.'
    if (msg.includes('429')) texto = 'Limite de requisições da IA atingido. Aguarde alguns segundos e envie novamente.'
    else if (msg.includes('413')) texto = 'A pergunta gerou muitos dados. Tente ser mais específico.'
    else if (msg.includes('404')) texto = 'Modelo da IA indisponível. Escolha outro modelo no botão "Modelos NIM".'
    else if (msg.includes('limite de consultas')) texto = 'A pergunta gerou muitas consultas. Tente ser mais específico.'
    mensagens.value.push({ role: 'assistant', content: texto })
  } else {
    mensagens.value.push({ role: 'assistant', content: resposta, ...(ultimaReasoning ? { reasoning_content: ultimaReasoning } : {}) })
  }
  rolarParaBaixo()
  enviando.value = false
}

function recarregar() {
  cacheTools.clear()
  cacheTodosChamados = null
  cacheTodosEquipamentos = null
  carregarHistorico()
  recarregarBase()
}

/**
 * Modelo padrão do painel.
 *
 * O GLM 5.3 flash é o primeiro da lista da NIM e foi o default historicamente,
 * mas na API hospedada ele responde VAZIO depois de ~100 s de raciocínio: a
 * tela ficava travada com "consultando os backends" e o balão saía em branco.
 * O Nemotron 3 Super responde a mesma tool em ~5 s. Trocar de modelo pelo
 * painel continua possível — este é só o ponto de partida.
 */
const MODELO_PADRAO = 'Beam-1.0-501B-A23B'

const modeloIa = ref(MODELO_PADRAO)
const modelosNvidia = ref<string[]>([])
const carregandoModelos = ref(false)
const painelModelos = ref(false)
const buscaModelo = ref('')

const modelosFiltrados = computed(() => {
  const alvo = buscaModelo.value.trim().toLowerCase()
  if (!alvo) return modelosNvidia.value
  return modelosNvidia.value.filter((m) => m.toLowerCase().includes(alvo))
})

async function carregarModelosNvidia() {
  carregandoModelos.value = true
  try {
    const { data } = await chamadosApi.get('/ia/modelos')
    modelosNvidia.value = Array.isArray(data?.modelos) ? data.modelos : []
    if (modelosNvidia.value.length && !modelosNvidia.value.includes(modeloIa.value)) {
      modeloIa.value = modelosNvidia.value.includes(MODELO_PADRAO)
        ? MODELO_PADRAO
        : modelosNvidia.value[0]
    }
  } catch {
    // mantém valor padrão
  } finally {
    carregandoModelos.value = false
  }
}

function toggleModelos() {
  painelModelos.value = !painelModelos.value
  if (painelModelos.value && !modelosNvidia.value.length) void carregarModelosNvidia()
}

function escolherModelo(m: string) {
  modeloIa.value = m
  painelModelos.value = false
  buscaModelo.value = ''
}

carregarHistorico()
carregar()
void carregarModelosNvidia()

</script>

<style scoped>
:root {
  --cafe-900: #1c1410;
  --cafe-800: #2a1d16;
  --cafe-700: #3b2a20;
  --cafe-500: #a9714b;
  --cafe-400: #c98a5e;
  --creme: #f6efe8;
  --papel: #fbf8f4;
  --tinta: #241a14;
  --tinta-suave: #6f5c50;
  --borda: #e6dbd0;
}

.chat-shell {
  display: grid;
  grid-template-columns: 272px 1fr;
  height: calc(100vh - 92px);
  border-radius: 18px;
  overflow: hidden;
  background: var(--papel);
  border: 1px solid var(--borda);
  box-shadow: 0 24px 60px -32px rgba(44, 30, 22, .45);
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: var(--tinta);
  transition: grid-template-columns .32s cubic-bezier(.4, 0, .2, 1);
}
.chat-shell.collapsed {
  grid-template-columns: 52px 1fr;
}

/* ---------- Rail / historico ---------- */
.rail {
  background:
    radial-gradient(120% 70% at 50% 0%, rgba(201, 138, 94, .38), transparent 62%),
    radial-gradient(90% 60% at 100% 100%, rgba(107, 68, 44, .5), transparent 60%),
    linear-gradient(165deg, #6b4429 0%, #54341f 45%, #3d2617 100%);
  color: #f0e2d6;
  display: flex;
  position: relative;
  border-right: 1px solid rgba(255, 255, 255, .07);
}
.collapsed .rail { justify-content: flex-start; }
.rail-toggle {
  position: absolute;
  top: 16px;
  right: -13px;
  z-index: 3;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, .3);
  background: #fdf6ef;
  color: #54341f;
  display: grid;
  place-items: center;
  cursor: pointer;
  opacity: 0;
  transform: scale(.85);
  transition: opacity .2s, transform .2s, background .15s;
}
.chat-shell:hover .rail-toggle { opacity: 1; transform: scale(1); }
.rail-toggle:hover { background: var(--cafe-500); }
.rail-body {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  padding: 16px 14px;
  gap: 14px;
}
.rail-head { display: flex; flex-direction: column; gap: 12px; padding-right: 6px; }
.brand { display: flex; align-items: center; gap: 10px; }
.brand-logo {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  object-fit: contain;
  background: #fdf6ef;
  padding: 3px;
  box-shadow: 0 6px 16px -6px rgba(0, 0, 0, .8), 0 0 0 1px rgba(255, 255, 255, .16);
  animation: float 5.5s ease-in-out infinite;
}
.brand-text { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
.brand strong { display: block; font-size: 15px; color: #fdf6ef; letter-spacing: .01em; }
.brand small { display: block; font-size: 11px; color: #e2c8b2; }
.new-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 10px;
  border: 1px dashed rgba(255, 255, 255, .3);
  border-radius: 10px;
  background: rgba(255, 255, 255, .06);
  color: #f4e7dc;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: background .16s, border-color .16s, transform .1s;
}
.new-btn:hover { background: rgba(255, 255, 255, .12); border-color: rgba(255, 255, 255, .35); }
.new-btn:active { transform: scale(.98); }
.rail-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; padding-right: 4px; }
.rail-empty { font-size: 12px; color: #dcc0a8; text-align: center; padding: 20px 8px; }
.conv {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #f2e4d8;
  cursor: pointer;
  text-align: left;
  position: relative;
  transition: background .15s;
}
.conv:hover { background: rgba(255, 255, 255, .12); }
.conv.active {
  background: linear-gradient(90deg, rgba(224, 168, 118, .38), rgba(201, 138, 94, .12));
  box-shadow: inset 0 0 0 1px rgba(201, 138, 94, .45);
}
.conv.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 3px;
  height: 0;
  border-radius: 0 3px 3px 0;
  background: linear-gradient(180deg, var(--cafe-400), #e0a876);
  transform: translateY(-50%);
  animation: bar-in .35s cubic-bezier(.2, .8, .3, 1) forwards;
}
@keyframes bar-in { to { height: 60%; } }
.conv-icon { opacity: .6; flex-shrink: 0; }
.conv.active .conv-icon { opacity: 1; color: var(--cafe-400); }
.conv-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.conv-title { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.conv-meta { font-size: 10.5px; color: #dcc0a8; }
.conv-del {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  opacity: 0;
  color: #d7b6a4;
  transition: opacity .15s, background .15s, color .15s;
}
.conv:hover .conv-del { opacity: 1; }
.conv-del:hover { background: rgba(220, 80, 60, .22); color: #ffb4a2; }
.rail-foot { padding-top: 4px; border-top: 1px solid rgba(255, 255, 255, .08); }
.refresh-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, .1);
  background: rgba(255, 255, 255, .05);
  color: #ddc7b8;
  font-size: 12.5px;
  cursor: pointer;
  transition: background .15s;
}
.refresh-btn:hover:not(:disabled) { background: rgba(255, 255, 255, .16); }
.refresh-btn:disabled { opacity: .55; cursor: progress; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ---------- Stage ---------- */
.stage {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  position: relative;
  isolation: isolate;
  background:
    radial-gradient(90% 60% at 100% 0%, rgba(201, 138, 94, .16), transparent 60%),
    radial-gradient(70% 50% at 0% 100%, rgba(169, 113, 75, .14), transparent 62%),
    linear-gradient(180deg, #fffdfb, var(--papel));
}
.stage::before,
.stage::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  filter: blur(58px);
  opacity: .5;
  z-index: -1;
  pointer-events: none;
}
.stage::before {
  width: 340px;
  height: 340px;
  top: -120px;
  right: -80px;
  background: radial-gradient(circle, rgba(224, 168, 118, .55), transparent 68%);
  animation: drift-a 22s ease-in-out infinite;
}
.stage::after {
  width: 300px;
  height: 300px;
  bottom: -130px;
  left: -70px;
  background: radial-gradient(circle, rgba(169, 113, 75, .45), transparent 68%);
  animation: drift-b 26s ease-in-out infinite;
}
@keyframes drift-a {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-60px, 50px) scale(1.15); }
  66% { transform: translate(30px, -40px) scale(.92); }
}
@keyframes drift-b {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(70px, -60px) scale(1.2); }
}

/* grão sutil sobre o papel */
.stage-head::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .5;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='.05'/%3E%3C/svg%3E");
}
.stage-head { position: relative; }
.stage-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 26px;
  background: linear-gradient(180deg, #fff, rgba(255, 255, 255, 0));
  border-bottom: 1px solid var(--borda);
}
.stage-title h1 {
  margin: 0;
  font-size: 19px;
  letter-spacing: -.01em;
  color: var(--cafe-900);
}
.stage-title p { margin: 2px 0 0; font-size: 11.5px; color: var(--tinta-suave); }
.stage-status {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 26px;
  font-size: 11.5px;
  color: var(--tinta-suave);
  background: #e8ddd0;
  border-bottom: 1px solid var(--borda);
}

.stream {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 22px 26px 8px;
  scroll-behavior: smooth;
}
.stream-inner { display: flex; flex-direction: column; gap: 18px; }

.welcome {
  max-width: 560px;
  margin: auto;
  padding: 30px 0;
  text-align: center;
  animation: rise .6s cubic-bezier(.2, .7, .3, 1) both;
}
.stream:has(.welcome) { display: flex; flex-direction: column; }
.welcome-cup {
  width: 66px;
  height: 66px;
  margin: 0 auto 16px;
  padding: 5px;
  border-radius: 20px;
  background: #fff;
  border: 1px solid var(--borda);
  box-shadow: 0 18px 30px -18px rgba(44, 30, 22, .8);
  animation: float 4.5s ease-in-out infinite;
}
.cup-logo { width: 100%; height: 100%; object-fit: contain; }
.welcome h2 { margin: 0 0 6px; font-size: 21px; color: var(--cafe-900); }
.welcome p { margin: 0 auto 22px; font-size: 13.5px; line-height: 1.6; color: var(--tinta-suave); max-width: 400px; }
.welcome p.brewing {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  flex-wrap: wrap;
  color: var(--cafe-700);
  font-weight: 600;
  font-size: 14.5px;
  margin-bottom: 22px;
}
.welcome p.brewing .dot-wave i { background: var(--cafe-500); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.chip {
  position: relative;
  overflow: hidden;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--borda);
  background: #fff;
  color: var(--cafe-800);
  font-size: 12.5px;
  cursor: pointer;
  transition: transform .14s, box-shadow .18s, border-color .18s, color .18s;
}
.chip::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 30%, rgba(224, 168, 118, .55), transparent 70%);
  transform: translateX(-120%);
  transition: transform .55s ease;
}
.chip:hover { transform: translateY(-3px); border-color: var(--cafe-400); color: var(--cafe-900); box-shadow: 0 14px 22px -14px rgba(44, 30, 22, .7); }
.chip:hover::after { transform: translateX(120%); }
.chip:nth-child(1) { animation-delay: .05s; }
.chip:nth-child(2) { animation-delay: .12s; }
.chip:nth-child(3) { animation-delay: .19s; }
.chip:nth-child(4) { animation-delay: .26s; }
.chips .chip { animation: rise .5s cubic-bezier(.2, .7, .3, 1) both; }

.msg { display: flex; gap: 12px; max-width: 82%; }
.msg.user { align-self: flex-end; flex-direction: row-reverse; }
.msg.assistant { align-self: flex-start; }
.who-avatar {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 700;
  margin-top: 18px;
}
.who-avatar.user { background: var(--cafe-800); color: #f6ece4; }
.who-avatar.assistant {
  position: relative;
  padding: 3px;
  background: #fff;
  border: 1px solid var(--borda);
  box-shadow: 0 8px 18px -10px rgba(169, 113, 75, .9);
}
.ava-logo { width: 100%; height: 100%; object-fit: contain; }
.who-avatar.assistant::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 14px;
  background: conic-gradient(from 0deg, transparent, rgba(224, 168, 118, .85), transparent 55%);
  z-index: -1;
  animation: spin-mark 3.6s linear infinite;
}
.who-body { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.msg.user .who-body { align-items: flex-end; }
.who-name { font-size: 11px; font-weight: 700; color: #5b463a; letter-spacing: .03em; text-transform: uppercase; }
.msg.user .who-name { color: #7a5c48; }
.bubble {
  padding: 12px 15px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.6;
  background: linear-gradient(160deg, #ffffff, #fdf6f0);
  border: 1px solid var(--borda);
  box-shadow: 0 10px 24px -20px rgba(44, 30, 22, .6);
  transition: box-shadow .2s, transform .2s, border-color .2s;
}
.msg.assistant:hover .bubble {
  transform: translateY(-2px);
  border-color: var(--cafe-400);
  box-shadow: 0 18px 32px -22px rgba(44, 30, 22, .75);
}
.msg.assistant .bubble { border-top-left-radius: 5px; }
.msg.user .bubble {
  background: linear-gradient(140deg, #4a2f1e, #35210f);
  color: #ffffff;
  border: 1px solid #2a1a0e;
  border-top-right-radius: 5px;
}
.msg.user .bubble .text { color: #ffffff; }
.bubble :deep(strong) { font-weight: 700; color: var(--cafe-700); }
.msg.user .bubble :deep(strong) { color: #ffd9b0; }
.msg.user .bubble :deep(strong) { color: #ffe3c4; }

.typing { display: flex; align-items: center; gap: 10px; }
.dot-wave { display: inline-flex; gap: 4px; }
.dot-wave i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--cafe-500);
  animation: bounce 1.1s infinite;
}
.dot-wave i:nth-child(2) { animation-delay: .15s; }
.dot-wave i:nth-child(3) { animation-delay: .3s; }
@keyframes bounce {
  0%, 70%, 100% { transform: translateY(0); opacity: .45; }
  35% { transform: translateY(-5px); opacity: 1; }
}
.typing-note { font-size: 12px; color: var(--tinta-suave); font-style: italic; }
.bubble.typing {
  animation: typing-pulse 1.6s ease-in-out infinite;
}
@keyframes typing-pulse {
  0%, 100% { box-shadow: 0 10px 24px -20px rgba(44, 30, 22, .6); }
  50% { box-shadow: 0 14px 30px -18px rgba(169, 113, 75, .55); }
}
.who-avatar.assistant img.ava-logo { animation: float 3.2s ease-in-out infinite; }

.composer {
  display: flex;
  gap: 10px;
  padding: 14px 26px 18px;
  background: linear-gradient(0deg, var(--papel) 60%, rgba(251, 248, 244, 0));
}
.composer-field {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  background: #fff;
  border: 1px solid var(--borda);
  border-radius: 14px;
  transition: border-color .16s, box-shadow .16s;
}
.composer-field:focus-within {
  border-color: var(--cafe-400);
  box-shadow: 0 0 0 4px rgba(201, 138, 94, .15);
}
.composer-icon { color: var(--cafe-400); flex-shrink: 0; }
.composer-field input {
  flex: 1;
  border: 0;
  outline: none;
  padding: 13px 0;
  font-size: 14px;
  background: transparent;
  color: var(--tinta);
}
.composer-field input::placeholder { color: #b6a396; }
.send {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  border: 0;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: #fbf3ec;
  background: linear-gradient(140deg, var(--cafe-500), var(--cafe-800));
  box-shadow: 0 14px 26px -16px rgba(44, 30, 22, .9);
  transition: transform .12s, box-shadow .16s, opacity .16s;
}
.send { position: relative; overflow: hidden; }
.send::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, .45), transparent 65%);
  transform: translateX(-130%);
  animation: sheen 3.4s ease-in-out infinite;
}
@keyframes sheen {
  0%, 55% { transform: translateX(-130%); }
  85%, 100% { transform: translateX(130%); }
}
.send:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 20px 30px -18px rgba(44, 30, 22, .95); }
.send:active:not(:disabled) { transform: translateY(0); }
.send:disabled { opacity: .4; cursor: not-allowed; box-shadow: none; }

.stage-actions { display: flex; align-items: center; gap: 10px; }
.model-atual { font-size: 11px; color: var(--tinta-suave); max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.model-btn { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--borda); background: #fff; color: var(--cafe-800); font-size: 12.5px; cursor: pointer; }
.model-btn:hover:not(:disabled) { border-color: var(--cafe-400); color: var(--cafe-900); }
.model-btn:disabled { opacity: .5; }
.model-panel { position: absolute; top: 70px; right: 26px; z-index: 5; width: 360px; max-height: 360px; overflow: auto; background: #fff; border: 1px solid var(--borda); border-radius: 14px; box-shadow: 0 18px 40px -20px rgba(44,30,22,.6); padding: 12px; }
.model-panel header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.model-search { width: 100%; box-sizing: border-box; padding: 8px 10px; margin-bottom: 8px; border: 1px solid var(--borda); border-radius: 8px; font-size: 12px; outline: none; color: var(--tinta); }
.model-search:focus { border-color: var(--cafe-400); }
.model-list { display: flex; flex-direction: column; gap: 4px; }
.model-item { text-align: left; padding: 8px 10px; border-radius: 8px; border: 1px solid transparent; background: transparent; color: var(--tinta); cursor: pointer; font-size: 12px; }
.model-item:hover { background: var(--creme); }
.model-item.active { background: var(--creme); border-color: var(--cafe-400); }

/* ---------- Motion ---------- */
@keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-9px); }
}

/* scrollbar quente */
.rail-list::-webkit-scrollbar,
.stream::-webkit-scrollbar { width: 9px; }
.rail-list::-webkit-scrollbar-track,
.stream::-webkit-scrollbar-track { background: transparent; }
.rail-list::-webkit-scrollbar-thumb,
.stream::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, var(--cafe-400), var(--cafe-500));
  border-radius: 99px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.stream::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #dcb896, var(--cafe-400)); }
.fade-slide-enter-active, .fade-slide-leave-active { transition: opacity .22s, transform .22s; }
.fade-slide-enter-from, .fade-slide-leave-to { opacity: 0; transform: translateX(-10px); }
.msg-enter-active { transition: opacity .34s cubic-bezier(.2, .7, .3, 1), transform .34s cubic-bezier(.2, .7, .3, 1); }
.msg-enter-from { opacity: 0; transform: translateY(16px) scale(.985); }
.msg-enter-to { opacity: 1; transform: none; }

@media (max-width: 900px) {
  .chat-shell { grid-template-columns: 52px 1fr; }
  .rail-body { display: none; }
  }

/* ---------- Modo compacto (widget flutuante) ---------- */
.chat-shell.compact {
  height: 100%;
  border-radius: 0;
  border: 0;
  box-shadow: none;
}
.chat-shell.compact .stage-head { padding: 16px 18px; }
.chat-shell.compact .stage-head h1 { font-size: 17px; }
.chat-shell.compact .stage-status { padding: 7px 18px; }
.chat-shell.compact .stream { padding: 22px 18px 8px; }
.chat-shell.compact .composer { padding: 12px 16px 16px; }
.chat-shell.compact .msg { max-width: 88%; }
</style>




















