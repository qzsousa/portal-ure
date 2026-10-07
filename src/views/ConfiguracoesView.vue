<script setup lang="ts">
/**
 * Configurações do portal (somente Administrador).
 * Abas: Catálogo (categoria/marca/modelo), Status do parque, Formulário de
 * chamados, Encaminhamento automático, Logs do sistema, Integrações.
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CheckCircle2, Eye, Loader2, Plus, ShieldCheck, Trash2, Users, Wrench, XCircle, Zap } from '@lucide/vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import FormularioAdmin from '@/components/config/FormularioAdmin.vue'
import {
  alternarRegraEncaminhamento,
  aplicarEncaminhamentoPendente,
  listarRegrasEncaminhamento,
  removerRegraEncaminhamento,
  salvarRegraEncaminhamento,
  type CategoriaRegra,
  type RegraEncaminhamento,
} from '@/api/encaminhamentos'
import type { TecnicoDestino } from '@/api/chamados'
import {
  adicionarItemCatalogo,
  listarAuditoria,
  listarCatalogo,
  listarEquipamentosGlobal,
  listarUnidadesResumo,
  removerItemCatalogo,
  type AuditoriaItem,
  type ItemLista,
} from '@/api/sce'
import { chamadosApi } from '@/api/http'
import { verificarHealthMonitor } from '@/api/monitor'
import { apiError } from '@/utils/apiError'
import { formatDateTime } from '@/utils/format'
import { ordenarTecnicos } from '@/utils/tecnicos'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useErrorLogStore } from '@/stores/errorLog'
import type { Nivel } from '@/types'

type Aba = 'catalogo' | 'status' | 'formulario' | 'encaminhamento' | 'logs' | 'integracoes' | 'acesso'

const ui = useUiStore()
const auth = useAuthStore()
const router = useRouter()
const aba = ref<Aba>('catalogo')

const ABAS_BASE: Array<{ id: Aba; rotulo: string }> = [
  { id: 'catalogo', rotulo: 'Catálogo de equipamentos' },
  { id: 'status', rotulo: 'Status do parque' },
  { id: 'formulario', rotulo: 'Formulário de chamados' },
  { id: 'encaminhamento', rotulo: 'Encaminhamento' },
  { id: 'logs', rotulo: 'Logs do sistema' },
  { id: 'integracoes', rotulo: 'Integrações' },
]

/**
 * "Testes de acesso" só existe em desenvolvimento.
 *
 * O simulador troca o `nivel` apenas na memória — o servidor continua
 * autorizando pelo perfil real. Em produção ele levava o usuário a crer que
 * a troca de perfil era uma função de autorização de verdade, e escondia
 * bugs de menu/guard (o item sumia para o perfil errado sem o backend
 * recusar a requisição).
 */
const ABAS: Array<{ id: Aba; rotulo: string }> = auth.simulacaoAtivavel
  ? [...ABAS_BASE, { id: 'acesso' as Aba, rotulo: 'Testes de acesso' }]
  : ABAS_BASE

/* ---------------- Catálogo ---------------- */
const catalogo = reactive({ loading: true, items: [] as ItemLista[], page: 1, busca: '' })
const novo = reactive({ categoria: '', marca: '', modelo: '' })
const salvandoCatalogo = ref(false)

const catalogoFiltrado = computed(() => {
  const b = catalogo.busca.trim().toLowerCase()
  if (!b) return catalogo.items
  return catalogo.items.filter((i) =>
    `${i.categoria} ${i.marca} ${i.modelo}`.toLowerCase().includes(b),
  )
})
const PAGE_SIZE_CAT = 8
const catalogoPagina = computed(() =>
  catalogoFiltrado.value.slice((catalogo.page - 1) * PAGE_SIZE_CAT, catalogo.page * PAGE_SIZE_CAT),
)

async function carregarCatalogo() {
  catalogo.loading = true
  try {
    catalogo.items = await listarCatalogo()
  } catch {
    ui.error('Não foi possível carregar o catálogo.')
  } finally {
    catalogo.loading = false
  }
}

async function adicionarAoCatalogo() {
  if (!novo.categoria.trim() || !novo.marca.trim() || !novo.modelo.trim()) {
    ui.error('Preencha categoria, marca e modelo.')
    return
  }
  salvandoCatalogo.value = true
  try {
    await adicionarItemCatalogo(novo.categoria.trim(), novo.marca.trim(), novo.modelo.trim())
    ui.success('Item adicionado ao catálogo.')
    novo.categoria = ''
    novo.marca = ''
    novo.modelo = ''
    await carregarCatalogo()
  } catch (e) {
    ui.error(apiError(e, 'Falha ao adicionar ao catálogo.'))
  } finally {
    salvandoCatalogo.value = false
  }
}

async function removerDoCatalogo(item: ItemLista) {
  if (!item.id) return
  if (!window.confirm(`Remover "${item.categoria} / ${item.marca} / ${item.modelo}" do catálogo?`)) return
  try {
    await removerItemCatalogo(item.id)
    ui.success('Item removido.')
    await carregarCatalogo()
  } catch (e) {
    ui.error(apiError(e, 'Falha ao remover do catálogo.'))
  }
}

/* ---------------- Status do parque ---------------- */
const statusParque = reactive({ loading: true, porStatus: {} as Record<string, number>, total: 0 })

async function carregarStatus() {
  statusParque.loading = true
  try {
    const res = await listarEquipamentosGlobal({ limite: 1 })
    statusParque.porStatus = res.stats.porStatus
    statusParque.total = res.total
  } catch {
    ui.error('Não foi possível carregar os status do parque.')
  } finally {
    statusParque.loading = false
  }
}

const statusOrdenados = computed(() =>
  Object.entries(statusParque.porStatus).sort((a, b) => b[1] - a[1]),
)

/* ---------------- Encaminhamento automático ---------------- */
const enc = reactive({
  loading: true,
  salvandoChave: '',
  aplicando: false,
  categorias: [] as CategoriaRegra[],
  tecnicos: [] as TecnicoDestino[],
  regras: {} as Record<string, RegraEncaminhamento>,
  /** Select de destino por categoria: 'UNIDADE' ou 'TEC:<id>'. */
  destino: {} as Record<string, string>,
})

async function carregarRegras() {
  enc.loading = true
  try {
    const res = await listarRegrasEncaminhamento()
    enc.categorias = res.categorias
    enc.tecnicos = res.tecnicos
    enc.regras = {}
    enc.destino = {}
    for (const r of res.data) {
      enc.regras[r.categoriaChave] = r
      enc.destino[r.categoriaChave] = r.modo === 'TECNICO' && r.tecnicoId ? `TEC:${r.tecnicoId}` : 'UNIDADE'
    }
    for (const c of res.categorias) {
      if (!enc.destino[c.chave]) enc.destino[c.chave] = 'UNIDADE'
    }
  } catch (e) {
    ui.error(apiError(e, 'Não foi possível carregar as regras de encaminhamento.'))
  } finally {
    enc.loading = false
  }
}

/**
 * Opções do select de destino da categoria: só a equipe de atendimento, na
 * ordem da escala. O técnico já salvo na regra nunca some da lista — sem isso
 * uma regra antiga apontaria para uma opção invisível e o select abriria vazio.
 */
function tecnicosDaCategoria(chave: string): TecnicoDestino[] {
  const atual = enc.destino[chave] || ''
  return ordenarTecnicos(enc.tecnicos, {
    categoriaChave: chave,
    extrasIds: atual.startsWith('TEC:') ? [atual.slice(4)] : [],
  })
}

/** Cria/atualiza a regra da categoria com o destino escolhido no select. */
async function salvarRegra(categoria: CategoriaRegra) {
  const escolha = enc.destino[categoria.chave] || 'UNIDADE'
  if (escolha.startsWith('TEC:') && escolha.length <= 4) {
    ui.error('Escolha o técnico de destino.')
    return
  }
  const atual = enc.regras[categoria.chave]
  enc.salvandoChave = categoria.chave
  try {
    await salvarRegraEncaminhamento({
      categoriaChave: categoria.chave,
      modo: escolha === 'UNIDADE' ? 'UNIDADE' : 'TECNICO',
      tecnicoId: escolha === 'UNIDADE' ? undefined : escolha.slice(4),
      ativa: atual?.ativa ?? true,
    })
    ui.success(`Regra de "${categoria.nome}" salva.`)
    await carregarRegras()
  } catch (e) {
    ui.error(apiError(e, 'Falha ao salvar a regra.'))
  } finally {
    enc.salvandoChave = ''
  }
}

/** Liga/desliga a regra; sem regra ainda, a primeira ativação cria uma. */
async function alternarRegra(categoria: CategoriaRegra) {
  const atual = enc.regras[categoria.chave]
  const nova = !(atual?.ativa ?? false)
  enc.salvandoChave = categoria.chave
  try {
    if (!atual) {
      await salvarRegraEncaminhamento({
        categoriaChave: categoria.chave,
        modo: (enc.destino[categoria.chave] || 'UNIDADE') === 'UNIDADE' ? 'UNIDADE' : 'TECNICO',
        tecnicoId: (enc.destino[categoria.chave] || '').startsWith('TEC:')
          ? enc.destino[categoria.chave].slice(4)
          : undefined,
        ativa: true,
      })
    } else {
      await alternarRegraEncaminhamento(atual.id, nova)
    }
    ui.success(nova ? `Encaminhamento automático ativado para "${categoria.nome}".` : `Encaminhamento automático desativado para "${categoria.nome}".`)
    await carregarRegras()
  } catch (e) {
    ui.error(apiError(e, 'Falha ao alterar a regra.'))
  } finally {
    enc.salvandoChave = ''
  }
}

async function removerRegra(categoria: CategoriaRegra) {
  const atual = enc.regras[categoria.chave]
  if (!atual) return
  if (!window.confirm(`Remover a regra de encaminhamento de "${categoria.nome}"?`)) return
  enc.salvandoChave = categoria.chave
  try {
    await removerRegraEncaminhamento(atual.id)
    ui.success('Regra removida.')
    await carregarRegras()
  } catch (e) {
    ui.error(apiError(e, 'Falha ao remover a regra.'))
  } finally {
    enc.salvandoChave = ''
  }
}

/** Aplica as regras ativas nos chamados abertos que ainda não têm responsável. */
async function aplicarPendentes() {
  if (enc.aplicando) return
  const ativas = Object.values(enc.regras).filter((r) => r.ativa).length
  if (!ativas) {
    ui.error('Ative ao menos uma regra antes de aplicar.')
    return
  }
  if (!window.confirm('Encaminhar agora os chamados abertos das categorias com regra ativa?\nSó os que ainda estão sem responsável são afetados.')) return
  enc.aplicando = true
  try {
    const r = await aplicarEncaminhamentoPendente()
    const extra = r.semTecnico ? ` ${r.semTecnico} ficaram sem técnico cadastrado.` : ''
    ui.success(`${r.encaminhados} de ${r.total} chamados abertos encaminhados.${extra}`)
  } catch (e) {
    ui.error(apiError(e, 'Falha ao aplicar as regras.'))
  } finally {
    enc.aplicando = false
  }
}

/* ---------------- Logs ---------------- */
const logs = reactive({ loading: true, items: [] as AuditoriaItem[] })

/** Células "Detalhes"/"Mensagem" expandidas ao toque (chave: `${tabela}:${id}`). */
const detalhesExpandidos = ref<Set<string>>(new Set())

function alternarDetalhe(chave: string) {
  const novo = new Set(detalhesExpandidos.value)
  if (novo.has(chave)) novo.delete(chave)
  else novo.add(chave)
  detalhesExpandidos.value = novo
}

/** Erros de backend registrados localmente pelos interceptors de axios. */
const errorLog = useErrorLogStore()

function limparErrosBackend() {
  if (!errorLog.total) return
  if (!window.confirm('Limpar o histórico de erros dos backends?')) return
  errorLog.limpar()
}

async function carregarLogs() {
  logs.loading = true
  try {
    logs.items = await listarAuditoria(80)
  } catch {
    ui.error('Não foi possível carregar os logs.')
  } finally {
    logs.loading = false
  }
}

/* ---------------- Integrações ---------------- */
const integracoes = reactive({
  chamados: { testado: false, ok: false, msg: '' },
  sce: { testado: false, ok: false, msg: '' },
  monitor: { testado: false, ok: false, msg: '' },
  sso: { testado: false, ok: false, msg: '' },
  carregando: false,
})

async function testarIntegracoes() {
  integracoes.carregando = true
  // 1) Backend chamados
  try {
    await chamadosApi.get('/dashboard/stats')
    integracoes.chamados = { testado: true, ok: true, msg: 'API de chamados respondendo' }
  } catch {
    integracoes.chamados = { testado: true, ok: false, msg: 'API de chamados indisponível' }
  }
  // 2) Backend SCE
  try {
    await listarUnidadesResumo()
    integracoes.sce = { testado: true, ok: true, msg: 'API do SCE respondendo' }
  } catch {
    integracoes.sce = { testado: true, ok: false, msg: 'API do SCE indisponível' }
  }
  // 3) Monitor de DVRs — roda NA MÁQUINA DA REDE, não na nuvem.
  //
  // Testa /health (público) e não /api/hosts: o que interessa aqui é "a máquina
  // está no ar ereachable", que é a falha de infraestrutura comum. A aba
  // Câmeras DVR faz o teste autenticado sozinha.
  try {
    const saude = await verificarHealthMonitor()
    integracoes.monitor = saude.ssoConfigurado
      ? {
          testado: true,
          ok: true,
          msg: `${saude.monitorados} câmeras em ${saude.escolas} unidades`,
        }
      : {
          testado: true,
          ok: false,
          msg: 'No ar, mas sem SSO_SECRET — a aba Câmeras DVR não vai abrir',
        }
  } catch {
    integracoes.monitor = {
      testado: true,
      ok: false,
      msg: 'Serviço de monitoramento inacessível (túnel ou máquina fora do ar)',
    }
  }
  // 4) SSO — o mesmo token é aceito nos TRÊS serviços?
  //
  // Só é "ok" quando os três responderam: com o monitor fora do ar, dizer
  // "login único ativo" seria afirmação que a tela não consegue provar.
  integracoes.sso =
    integracoes.chamados.ok && integracoes.sce.ok && integracoes.monitor.ok
      ? { testado: true, ok: true, msg: 'Login único ativo (JWT aceito nos três serviços)' }
      : { testado: true, ok: false, msg: 'SSO indisponível para algum dos serviços' }
  integracoes.carregando = false
}

/* ---------------- Testes de acesso (simular perfil) ---------------- */
interface PerfilTeste {
  nivel: Nivel
  rotulo: string
  resumo: string
  icone: unknown
}

const PERFIS_TESTE: PerfilTeste[] = [
  {
    nivel: 'GESTOR',
    rotulo: 'Gestor',
    resumo: 'Painel da unidade, chamados, equipamentos e usuários da escola.',
    icone: Users,
  },
  {
    nivel: 'TECNICO',
    rotulo: 'Técnico',
    resumo: 'Chamados com ações técnicas, equipamentos e manutenção.',
    icone: Wrench,
  },
  {
    nivel: 'VISUALIZADOR',
    rotulo: 'Visualizador',
    resumo: 'Somente leitura — acompanha dados sem menus administrativos.',
    icone: Eye,
  },
]

/** Abre o portal simulando o perfil (menus/guards passam a usar o nível simulado). */
function simular(nivel: Nivel, rotulo: string) {
  auth.simularComo(nivel)
  ui.success(`Simulando perfil "${rotulo}". Use o banner do topo para encerrar.`)
  void router.push({ name: 'painel' })
}

onMounted(() => {
  void carregarCatalogo()
  void carregarStatus()
  void carregarLogs()
  void carregarRegras()
})
</script>

<template>
  <div class="conf-page">
    <div class="conf-grid">
      <!-- Navegação interna -->
      <nav class="conf-nav card">
        <button
          v-for="a in ABAS"
          :key="a.id"
          type="button"
          class="conf-nav-item"
          :class="{ ativa: aba === a.id }"
          @click="aba = a.id"
        >
          <span>{{ a.rotulo }}</span>
          <span v-if="a.id === 'logs' && errorLog.total" class="badge-erro">{{ errorLog.total }}</span>
        </button>
      </nav>

      <div class="conf-conteudo">
        <!-- ============ CATÁLOGO ============ -->
        <section v-if="aba === 'catalogo'" class="card conf-card">
          <h3>Adicionar ao catálogo</h3>
          <p class="conf-desc">
            Os itens abaixo alimentam a cascata Categoria → Marca → Modelo no cadastro de equipamentos.
          </p>
          <div class="novo-item">
            <input v-model="novo.categoria" class="input" placeholder="Categoria (ex.: Impressora)" />
            <input v-model="novo.marca" class="input" placeholder="Marca (ex.: Epson)" />
            <input v-model="novo.modelo" class="input" placeholder="Modelo (ex.: L3250)" />
            <button class="btn btn-primary" type="button" :disabled="salvandoCatalogo" @click="adicionarAoCatalogo">
              <Loader2 v-if="salvandoCatalogo" class="spin" :size="15" />
              <Plus v-else :size="15" />
              Adicionar
            </button>
          </div>

          <div class="catalogo-header">
            <h3>Itens cadastrados ({{ catalogo.items.length }})</h3>
            <input v-model="catalogo.busca" class="input busca" placeholder="Filtrar..." />
          </div>

          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th class="th-acoes"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="catalogo.loading">
                  <td colspan="4" class="td-center">Carregando...</td>
                </tr>
                <tr v-else-if="catalogoPagina.length === 0">
                  <td colspan="4" class="td-center">Nenhum item no catálogo.</td>
                </tr>
                <tr v-for="i in catalogoPagina" :key="i.id ?? `${i.categoria}|${i.marca}|${i.modelo}`">
                  <td>{{ i.categoria }}</td>
                  <td>{{ i.marca }}</td>
                  <td>{{ i.modelo }}</td>
                  <td class="td-acoes">
                    <button v-if="i.id" class="btn-del" type="button" title="Remover" @click="removerDoCatalogo(i)">
                      <Trash2 :size="15" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <PaginationBar
            :page="catalogo.page"
            :page-size="PAGE_SIZE_CAT"
            :total="catalogoFiltrado.length"
            @change="(p) => (catalogo.page = p)"
          />
        </section>

        <!-- ============ STATUS DO PARQUE ============ -->
        <section v-else-if="aba === 'status'" class="card conf-card">
          <h3>Status dos equipamentos (visão geral do parque)</h3>
          <p class="conf-desc">Distribuição atual do inventário por situação.</p>
          <p v-if="statusParque.loading" class="td-center">Carregando...</p>
          <div v-else class="status-lista">
            <div v-for="[s, qtd] in statusOrdenados" :key="s" class="status-linha">
              <span class="status-nome">{{ s }}</span>
              <div class="status-barra">
                <div
                  class="status-fill"
                  :style="{ width: statusParque.total ? `${(qtd / statusParque.total) * 100}%` : '0%' }"
                />
              </div>
              <span class="status-qtd">{{ qtd }}</span>
            </div>
          </div>
        </section>

        <!-- ============ FORMULÁRIO DE CHAMADOS ============ -->
        <section v-else-if="aba === 'formulario'" class="card conf-card">
          <FormularioAdmin />
        </section>

        <!-- ============ ENCAMINHAMENTO AUTOMÁTICO ============ -->
        <section v-else-if="aba === 'encaminhamento'" class="card conf-card">
          <div class="enc-header">
            <h3>Encaminhamento automático para técnicos</h3>
            <button
              class="btn btn-outline"
              type="button"
              :disabled="enc.aplicando || enc.loading"
              @click="aplicarPendentes"
            >
              <Loader2 v-if="enc.aplicando" class="spin" :size="15" />
              <Zap v-else :size="15" />
              Aplicar agora aos abertos
            </button>
          </div>
          <p class="conf-desc">
            Escolha a categoria do formulário público que deve chegar sozinha ao técnico. O chamado
            nasce com o responsável preenchido, o registro no histórico e um aviso no sino do técnico.
            Para os chamados que já estão abertos sem responsável, use
            <strong>Aplicar agora</strong> ou o botão <strong>Encaminhar</strong> no detalhe do chamado.
          </p>

          <p v-if="enc.loading" class="td-center">Carregando...</p>
          <div v-else class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Destino</th>
                  <th>Automático</th>
                  <th class="th-acoes"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="enc.categorias.length === 0">
                  <td colspan="4" class="td-center">
                    Nenhuma categoria de formulário cadastrada.
                  </td>
                </tr>
                <tr v-for="c in enc.categorias" :key="c.chave">
                  <td>
                    <span class="enc-cat">
                      <span class="enc-cor" :style="{ background: c.cor || 'var(--blue)' }" />
                      <strong>{{ c.nome }}</strong>
                      <code class="enc-chave">{{ c.chave }}</code>
                    </span>
                  </td>
                  <td>
                    <div class="enc-destino">
                      <select v-model="enc.destino[c.chave]" class="select-input slim" :disabled="enc.salvandoChave === c.chave">
                        <option value="UNIDADE">Técnico da unidade</option>
                        <option v-for="t in tecnicosDaCategoria(c.chave)" :key="t.id" :value="`TEC:${t.id}`">
                          {{ t.nome }} (fixo)
                        </option>
                      </select>
                      <button
                        class="btn btn-outline btn-mini"
                        type="button"
                        :disabled="enc.salvandoChave === c.chave"
                        @click="salvarRegra(c)"
                      >
                        Salvar
                      </button>
                    </div>
                    <small v-if="enc.regras[c.chave]?.tecnicoNome" class="enc-nota">
                      Técnico fixo: {{ enc.regras[c.chave]?.tecnicoNome }}
                    </small>
                  </td>
                  <td>
                    <button
                      class="switch"
                      :class="{ on: enc.regras[c.chave]?.ativa }"
                      type="button"
                      role="switch"
                      :aria-checked="!!enc.regras[c.chave]?.ativa"
                      :disabled="enc.salvandoChave === c.chave"
                      @click="alternarRegra(c)"
                    >
                      <span class="switch-bola" />
                      {{ enc.regras[c.chave]?.ativa ? 'Ativo' : 'Inativo' }}
                    </button>
                  </td>
                  <td class="td-acoes">
                    <button
                      v-if="enc.regras[c.chave]"
                      class="btn-del"
                      type="button"
                      title="Remover regra"
                      :disabled="enc.salvandoChave === c.chave"
                      @click="removerRegra(c)"
                    >
                      <Trash2 :size="15" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- ============ LOGS ============ -->
        <section v-else-if="aba === 'logs'" class="card conf-card">
          <div class="logs-header">
            <h3>Erros dos backends</h3>
            <button
              v-if="errorLog.total"
              class="btn-limpar"
              type="button"
              title="Limpar histórico de erros"
              @click="limparErrosBackend"
            >
              <Trash2 :size="14" />
              Limpar
            </button>
          </div>
          <p class="conf-desc">
            Falhas capturadas pelo portal ao chamar os backends (HTTP 5xx ou backend fora do ar).
            Erros novos também disparam uma notificação de erro na tela.
          </p>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Backend</th>
                  <th>Requisição</th>
                  <th>Status</th>
                  <th>Mensagem</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="errorLog.erros.length === 0">
                  <td colspan="5" class="td-center">Nenhum erro de backend registrado.</td>
                </tr>
                <tr v-for="e in errorLog.erros" :key="e.id">
                  <td class="nowrap">{{ formatDateTime(e.data) }}</td>
                  <td class="nowrap">{{ e.backend }}</td>
                  <td class="req">
                    <code class="acao">{{ e.metodo }}</code> {{ e.rota }}
                  </td>
                  <td class="nowrap">
                    <span class="status-erro" :class="{ off: e.status === null }">
                      {{ e.status ?? 'sem resposta' }}
                    </span>
                  </td>
                  <td
                    class="detalhes"
                    :class="{ expandido: detalhesExpandidos.has(`erro:${e.id}`) }"
                    :title="e.mensagem"
                    @click="alternarDetalhe(`erro:${e.id}`)"
                  >
                    {{ e.mensagem }}
                    <span v-if="e.repeticoes > 1" class="rep" :title="`${e.repeticoes} ocorrências seguidas`">
                      ×{{ e.repeticoes }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 class="logs-sub">Logs do sistema (auditoria do SCE)</h3>
          <p class="conf-desc">Últimas ações administrativas registradas.</p>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Usuário</th>
                  <th>Ação</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="logs.loading">
                  <td colspan="4" class="td-center">Carregando...</td>
                </tr>
                <tr v-else-if="logs.items.length === 0">
                  <td colspan="4" class="td-center">Nenhum log registrado.</td>
                </tr>
                <tr v-for="l in logs.items" :key="l.id">
                  <td class="nowrap">{{ formatDateTime(l.data) }}</td>
                  <td>{{ l.usuario }}</td>
                  <td><code class="acao">{{ l.acao }}</code></td>
                  <td
                    class="detalhes"
                    :class="{ expandido: detalhesExpandidos.has(`log:${l.id}`) }"
                    @click="alternarDetalhe(`log:${l.id}`)"
                  >{{ JSON.stringify(l.detalhes || {}) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- ============ INTEGRAÇÕES ============ -->
        <section v-else-if="aba === 'integracoes'" class="card conf-card">
          <h3>Integrações do portal</h3>
          <p class="conf-desc">
            Verifica se o portal está conversando com os três serviços e se o login único (SSO)
            está ativo em todos. O monitoramento das câmeras DVR roda numa máquina dentro da
            rede privada das escolas — se ele estiver fora, apenas a aba Câmeras DVR é afetada.
          </p>
          <div class="integracoes">
            <div class="int-card" :class="{ ok: integracoes.chamados.ok, off: integracoes.chamados.testado && !integracoes.chamados.ok }">
              <ShieldCheck :size="20" />
              <div>
                <strong>Backend — Chamados</strong>
                <span>{{ integracoes.chamados.msg || 'Não testado ainda' }}</span>
              </div>
              <CheckCircle2 v-if="integracoes.chamados.ok" :size="18" class="ok-ic" />
              <XCircle v-else-if="integracoes.chamados.testado" :size="18" class="off-ic" />
            </div>
            <div class="int-card" :class="{ ok: integracoes.sce.ok, off: integracoes.sce.testado && !integracoes.sce.ok }">
              <ShieldCheck :size="20" />
              <div>
                <strong>Backend — Equipamentos (SCE)</strong>
                <span>{{ integracoes.sce.msg || 'Não testado ainda' }}</span>
              </div>
              <CheckCircle2 v-if="integracoes.sce.ok" :size="18" class="ok-ic" />
              <XCircle v-else-if="integracoes.sce.testado" :size="18" class="off-ic" />
            </div>
            <div class="int-card" :class="{ ok: integracoes.monitor.ok, off: integracoes.monitor.testado && !integracoes.monitor.ok }">
              <ShieldCheck :size="20" />
              <div>
                <strong>Monitoramento de DVRs</strong>
                <span>{{ integracoes.monitor.msg || 'Não testado ainda' }}</span>
              </div>
              <CheckCircle2 v-if="integracoes.monitor.ok" :size="18" class="ok-ic" />
              <XCircle v-else-if="integracoes.monitor.testado" :size="18" class="off-ic" />
            </div>
            <div class="int-card" :class="{ ok: integracoes.sso.ok, off: integracoes.sso.testado && !integracoes.sso.ok }">
              <ShieldCheck :size="20" />
              <div>
                <strong>Login único (SSO)</strong>
                <span>{{ integracoes.sso.msg || 'Não testado ainda' }}</span>
              </div>
              <CheckCircle2 v-if="integracoes.sso.ok" :size="18" class="ok-ic" />
              <XCircle v-else-if="integracoes.sso.testado" :size="18" class="off-ic" />
            </div>
          </div>
          <button class="btn btn-primary" type="button" :disabled="integracoes.carregando" @click="testarIntegracoes">
            <Loader2 v-if="integracoes.carregando" class="spin" :size="15" />
            {{ integracoes.carregando ? 'Testando...' : 'Testar agora' }}
          </button>
        </section>

        <!-- ============ TESTES DE ACESSO (simular perfil) ============ -->
        <section v-else-if="aba === 'acesso'" class="card conf-card">
          <h3>Simular perfil de acesso</h3>
          <p class="conf-desc">
            Abra o portal como outro perfil — menus, botões e páginas passam a seguir as
            permissões daquele perfil. A simulação muda apenas a interface (suas credenciais
            continuam as mesmas), some ao recarregar a página e pode ser encerrada no banner
            do topo a qualquer momento.
          </p>
          <div class="perfil-grid">
            <button
              v-for="p in PERFIS_TESTE"
              :key="p.nivel"
              type="button"
              class="perfil-btn"
              @click="simular(p.nivel, p.rotulo)"
            >
              <component :is="p.icone" :size="22" />
              <strong>{{ p.rotulo }}</strong>
              <span>{{ p.resumo }}</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ---------- Testes de acesso ---------- */
.perfil-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: 12px;
  margin-top: 14px;
}

.perfil-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 7px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.12s ease,
    background 0.12s ease;
}

.perfil-btn:hover {
  border-color: var(--blue);
  background: var(--blue-soft);
}

.perfil-btn strong {
  font-size: 14px;
  color: var(--text-primary);
}

.perfil-btn span {
  font-size: 12px;
  line-height: 1.45;
}

.conf-grid {
  display: grid;
  grid-template-columns: 230px 1fr;
  gap: 18px;
  align-items: start;
}

.conf-nav {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: sticky;
  top: calc(var(--topbar-height) + 20px);
}

.conf-nav-item {
  padding: 11px 14px;
  border-radius: var(--radius-sm);
  text-align: left;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.badge-erro {
  background: var(--red);
  color: #fff;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  min-width: 19px;
  padding: 3px 6px;
  text-align: center;
}

.conf-nav-item:hover {
  background: var(--surface-muted);
}

.conf-nav-item.ativa {
  background: var(--sidebar-bg);
  color: #fff;
}

.conf-card {
  padding: 22px;
}

.conf-card h3 {
  font-size: 15px;
  margin-bottom: 4px;
}

.conf-desc {
  margin: 0 0 18px;
  font-size: 13px;
  color: var(--text-muted);
}

.novo-item {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: 10px;
  margin-bottom: 20px;
}

.catalogo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.catalogo-header .busca {
  max-width: 240px;
}

.th-acoes,
.td-acoes {
  width: 56px;
  text-align: right;
}

.btn-del {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--red);
  background: transparent;
}

.btn-del:hover {
  background: var(--red-soft);
}

.td-center {
  text-align: center;
  color: var(--text-muted);
  padding: 26px !important;
}

/* ---------- Encaminhamento automático ---------- */
.enc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.enc-cat {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.enc-cor {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.enc-chave {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--surface-muted);
  padding: 2px 6px;
  border-radius: 4px;
}

.enc-destino {
  display: flex;
  align-items: center;
  gap: 8px;
}

.enc-destino .select-input {
  min-width: 220px;
}

.enc-nota {
  display: block;
  margin-top: 4px;
  font-size: 11.5px;
  color: var(--text-muted);
}

.btn-mini {
  padding: 6px 12px;
  font-size: 12.5px;
  white-space: nowrap;
}

/* Interruptor Ativo/Inativo */
.switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: var(--surface-muted);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-muted);
}

.switch-bola {
  width: 30px;
  height: 17px;
  border-radius: 999px;
  background: var(--border-strong);
  position: relative;
  transition: background 0.15s ease;
}

.switch-bola::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s ease;
}

.switch.on {
  color: var(--text-primary);
  border-color: transparent;
}

.switch.on .switch-bola {
  background: #16a34a;
}

.switch.on .switch-bola::after {
  transform: translateX(13px);
}

.switch:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status-lista {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-linha {
  display: grid;
  grid-template-columns: 160px 1fr 60px;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.status-nome {
  font-weight: 600;
  color: var(--text-primary);
}

.status-barra {
  height: 10px;
  background: var(--surface-muted);
  border-radius: 999px;
  overflow: hidden;
}

.status-fill {
  height: 100%;
  background: var(--sidebar-bg);
  border-radius: 999px;
}

.status-qtd {
  text-align: right;
  font-weight: 700;
}

.acao {
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 2px 7px;
  font-size: 12px;
}

.detalhes {
  max-width: 340px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Courier New', monospace;
  font-size: 11.5px;
  color: var(--text-muted);
  cursor: pointer;
}

.detalhes.expandido {
  max-width: none;
  overflow: visible;
  text-overflow: clip;
  white-space: pre-wrap;
  word-break: break-all;
}

.logs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.logs-header h3 {
  margin-bottom: 0;
}

.btn-limpar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--red);
  border: 1px solid var(--border);
  background: transparent;
}

.btn-limpar:hover {
  background: var(--red-soft);
}

.logs-sub {
  margin-top: 28px;
}

.req {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
}

.status-erro {
  display: inline-block;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
  background: #fef2f2;
  border: 1px solid #fca5a5;
  color: #b91c1c;
}

.status-erro.off {
  background: var(--surface-muted);
  border-color: var(--border);
  color: var(--text-secondary);
}

.rep {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--red-soft);
  color: var(--red);
  font-size: 10.5px;
  font-weight: 700;
}

.integracoes {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 18px;
}

.int-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
}

.int-card.ok {
  border-color: #86efac;
  background: #f0fdf4;
}

.int-card.off {
  border-color: #fca5a5;
  background: #fef2f2;
}

.int-card strong {
  display: block;
  font-size: 13.5px;
  color: var(--text-primary);
}

.int-card span {
  font-size: 12.5px;
}

.ok-ic {
  margin-left: auto;
  color: var(--green);
}

.off-ic {
  margin-left: auto;
  color: var(--red);
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .conf-grid {
    grid-template-columns: 1fr;
  }
  /* Empilhada acima do conteúdo, sticky não faz sentido */
  .conf-nav {
    position: static;
  }
  .novo-item {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .status-linha {
    grid-template-columns: 110px 1fr 48px;
    font-size: 12.5px;
  }
}
</style>
