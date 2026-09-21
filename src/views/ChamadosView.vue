<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiError } from '@/utils/apiError'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Layers,
  MoreVertical,
  School,
  Search,
} from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import {
  atualizarChamadosEmLote,
  atualizarStatusChamado,
  getChamado,
  listarChamados,
  responderChamado,
  rotuloStatusChamado,
  type FiltrosChamado,
} from '@/api/chamados'
import { chamadosApi } from '@/api/http'
import { formatDate } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { Chamado, StatusChamado } from '@/types'

const auth = useAuthStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()

const stats = ref<{ total: number; abertos: number; andamento: number; comunicado: number; resolvidos: number } | null>(null)

const estado = reactive({
  loading: true,
  erro: '',
  items: [] as Chamado[],
  total: 0,
  page: 1,
})
const PAGE_SIZE = 10

const filtros = reactive<FiltrosChamado>({ status: '', unidade: '', urgencia: '' })

const podeEditar = computed(() => ['ADMIN', 'TECNICO', 'GESTOR', 'VISUALIZADOR'].includes(auth.user?.nivel || ''))
const podeLote = computed(() => ['ADMIN', 'TECNICO'].includes(auth.user?.nivel || ''))

/* ---------- Seleção múltipla (batch) ---------- */
const selecionados = ref<Set<string>>(new Set())
const loteStatus = ref<StatusChamado | ''>('')

const todosMarcados = computed(
  () => estado.items.length > 0 && estado.items.every((c) => selecionados.value.has(c.id)),
)

function alternarTodos() {
  const novo = new Set(selecionados.value)
  if (todosMarcados.value) estado.items.forEach((c) => novo.delete(c.id))
  else estado.items.forEach((c) => novo.add(c.id))
  selecionados.value = novo
}

function alternar(id: string) {
  const novo = new Set(selecionados.value)
  if (novo.has(id)) novo.delete(id)
  else novo.add(id)
  selecionados.value = novo
}

async function aplicarEmLote() {
  if (!loteStatus.value || selecionados.value.size === 0) return
  try {
    const r = await atualizarChamadosEmLote([...selecionados.value], { status: loteStatus.value })
    ui.success(`${r.atualizados} chamado(s) atualizados para "${rotuloStatusChamado(loteStatus.value)}".`)
    selecionados.value = new Set()
    loteStatus.value = ''
    await Promise.all([carregar(), carregarStats()])
  } catch (e) {
    ui.error(apiError(e, 'Falha na atualização em lote.'))
  }
}

async function carregar() {
  estado.loading = true
  estado.erro = ''
  try {
    const res = await listarChamados({ ...filtros, page: estado.page, limit: PAGE_SIZE })
    estado.items = res.data
    estado.total = res.meta.total
  } catch {
    estado.erro = 'Não foi possível carregar os chamados.'
  } finally {
    estado.loading = false
  }
}

async function carregarStats() {
  try {
    const { data } = await chamadosApi.get('/dashboard/stats')
    stats.value = data
  } catch {
    stats.value = null
  }
}

function aplicarFiltros() {
  estado.page = 1
  void carregar()
}

/* ------- Chips de filtro rápido ------- */
const STATUS_CHIPS: Array<{ rotulo: string; valor: StatusChamado | '' }> = [
  { rotulo: 'Todos', valor: '' },
  { rotulo: 'Abertos', valor: 'ABERTO' },
  { rotulo: 'Em atendimento', valor: 'ANDAMENTO' },
  { rotulo: 'Aguardando escola', valor: 'COMUNICADO' },
  { rotulo: 'Concluídos', valor: 'RESOLVIDO' },
]

function chipStatus(valor: StatusChamado | '') {
  filtros.status = valor
  aplicarFiltros()
}

function alternarUrgentes() {
  filtros.urgencia = filtros.urgencia === 'Alta' ? '' : 'Alta'
  aplicarFiltros()
}

function alternarPortalNet() {
  filtros.categoria = filtros.categoria === 'PortalNet' ? '' : 'PortalNet'
  aplicarFiltros()
}

/* ------- Detalhe ------- */
const menuAberto = ref<string | null>(null)
const detalheAberto = ref(false)
const detalhe = ref<Chamado | null>(null)
const salvando = ref(false)
const novoStatus = ref<StatusChamado>('ANDAMENTO')
const descricaoResolucao = ref('')
const textoResposta = ref('')

function abrirDetalhe(c: Chamado) {
  menuAberto.value = null
  detalhe.value = c
  novoStatus.value = c.status
  descricaoResolucao.value = c.descricaoResolucao || ''
  textoResposta.value = ''
  detalheAberto.value = true
}

/* ------- Deep-link: abre o chamado direto via ?chamado=<id> (ex.: clique em notificação) ------- */
watch(
  () => route.query.chamado,
  async (id) => {
    if (typeof id !== 'string' || !id) return
    try {
      abrirDetalhe(await getChamado(id))
    } catch (e) {
      ui.error(apiError(e, 'Chamado não encontrado.'))
    }
  },
  { immediate: true },
)

/* Ao fechar o modal, limpa o parâmetro da URL */
watch(detalheAberto, (aberto) => {
  if (!aberto && route.query.chamado) {
    const { chamado: _chamado, ...resto } = route.query
    void router.replace({ query: resto })
  }
})

/* ------- Histórico como linha do tempo ------- */
type TomTimeline = 'green' | 'blue' | 'purple' | 'slate'

interface EntradaHistorico {
  horario: string | null
  texto: string
  tom: TomTimeline
}

function tomDaEntrada(texto: string): TomTimeline {
  const t = texto.toLowerCase()
  if (t.includes('resolvido') || t.includes('concluído') || t.includes('concluido')) return 'green'
  if (t.includes('status alterado')) return 'blue'
  if (t.includes('respond') || t.includes('comunicado')) return 'purple'
  return 'slate'
}

const historicoEntradas = computed<EntradaHistorico[]>(() => {
  const bruto = detalhe.value?.historico || ''
  return bruto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((linha) => {
      if (linha.startsWith('[')) {
        const fecha = linha.indexOf(']')
        if (fecha > 1) {
          return {
            horario: linha.slice(1, fecha),
            texto: linha.slice(fecha + 1).trim(),
            tom: tomDaEntrada(linha),
          }
        }
      }
      // Parse tolerante: linha fora do padrão vira texto simples
      return { horario: null, texto: linha, tom: tomDaEntrada(linha) }
    })
})

const timelineRef = ref<HTMLElement | null>(null)

/* Auto-scroll para a entrada mais recente ao abrir o modal ou ao histórico mudar */
watch([detalheAberto, () => detalhe.value?.historico], async ([aberto]) => {
  if (!aberto) return
  await nextTick()
  const el = timelineRef.value
  if (el) el.scrollTop = el.scrollHeight
})

async function salvarStatus() {
  if (!detalhe.value) return
  salvando.value = true
  try {
    const atualizado = await atualizarStatusChamado(detalhe.value.id, {
      status: novoStatus.value,
      descricaoResolucao: descricaoResolucao.value || undefined,
    })
    detalhe.value = atualizado
    ui.success(`Chamado ${atualizado.protocolo} atualizado para "${rotuloStatusChamado(atualizado.status)}".`)
    await Promise.all([carregar(), carregarStats()])
  } catch (e) {
    ui.error(apiError(e, 'Falha ao atualizar o status.'))
  } finally {
    salvando.value = false
  }
}

async function enviarResposta() {
  if (!detalhe.value || !textoResposta.value.trim()) return
  salvando.value = true
  try {
    const atualizado = await responderChamado(detalhe.value.id, textoResposta.value.trim())
    detalhe.value = atualizado
    textoResposta.value = ''
    ui.success('Resposta registrada no histórico.')
  } catch (e) {
    ui.error(apiError(e, 'Falha ao registrar resposta.'))
  } finally {
    salvando.value = false
  }
}

function fecharMenu(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('.acoes-wrap')) menuAberto.value = null
}

onMounted(() => {
  void carregar()
  void carregarStats()
  document.addEventListener('click', fecharMenu)
})
</script>

<template>
  <div class="chamados-page">
    <!-- KPIs -->
    <div class="stats-grid">
      <StatCard label="Total de chamados" :value="stats?.total ?? '…'" tone="blue"><ClipboardList :size="22" /></StatCard>
      <StatCard label="Abertos" :value="stats?.abertos ?? '…'" tone="red"><AlertTriangle :size="22" /></StatCard>
      <StatCard label="Em atendimento" :value="stats?.andamento ?? '…'" tone="yellow"><Clock :size="22" /></StatCard>
      <StatCard
        label="Aguardando escola"
        :value="stats?.comunicado ?? '…'"
        detail="respondidos, aguardam retorno da unidade"
        tone="purple"
      ><School :size="22" /></StatCard>
      <StatCard label="Concluídos" :value="stats?.resolvidos ?? '…'" tone="green"><CheckCircle2 :size="22" /></StatCard>
    </div>

    <!-- Chips de filtro rápido -->
    <div class="chips">
      <div class="chips-grupo">
        <button
          v-for="chip in STATUS_CHIPS"
          :key="chip.rotulo"
          class="chip"
          :class="{ ativo: filtros.status === chip.valor }"
          type="button"
          @click="chipStatus(chip.valor)"
        >
          {{ chip.rotulo }}
        </button>
      </div>
      <span class="chips-divisor" />
      <div class="chips-grupo">
        <button
          class="chip"
          :class="{ ativo: filtros.urgencia === 'Alta' }"
          type="button"
          @click="alternarUrgentes"
        >
          Só urgentes
        </button>
        <button
          class="chip"
          :class="{ ativo: filtros.categoria === 'PortalNet' }"
          type="button"
          @click="alternarPortalNet"
        >
          PortalNet
        </button>
      </div>
    </div>

    <!-- Filtros -->
    <div class="toolbar card">
      <div class="search-box">
        <Search :size="16" />
        <input
          v-model="filtros.unidade"
          placeholder="Filtrar por unidade escolar..."
          @keyup.enter="aplicarFiltros"
        />
      </div>
      <select v-model="filtros.status" class="select-input slim" @change="aplicarFiltros">
        <option value="">Status: Todos</option>
        <option value="ABERTO">Aberto</option>
        <option value="ANDAMENTO">Em atendimento</option>
        <option value="COMUNICADO">Aguardando escola</option>
        <option value="RESOLVIDO">Concluído</option>
      </select>
      <select v-model="filtros.urgencia" class="select-input slim" @change="aplicarFiltros">
        <option value="">Urgência: Todas</option>
        <option value="Alta">Alta</option>
        <option value="Média">Média</option>
        <option value="Baixa">Baixa</option>
      </select>
      <button class="btn btn-primary" type="button" @click="aplicarFiltros">Filtrar</button>
      <a class="btn btn-gold" href="/chamado/novo" target="_blank" rel="noopener">
        Abrir chamado
      </a>
    </div>

    <!-- Barra de ação em lote (só ADMIN/TECNICO) -->
    <div v-if="podeLote" class="lote card" :class="{ ativa: selecionados.size > 0 }">
      <span>{{ selecionados.size ? `${selecionados.size} chamado(s) selecionado(s)` : 'Marque os chamados para agir em lote' }}</span>
      <div class="lote-acoes">
        <select v-model="loteStatus" class="select-input slim" :disabled="selecionados.size === 0">
          <option value="" disabled>Alterar status para...</option>
          <option value="ABERTO">Aberto</option>
          <option value="ANDAMENTO">Em atendimento</option>
          <option value="COMUNICADO">Aguardando escola</option>
          <option value="RESOLVIDO">Concluído</option>
        </select>
        <button
          class="btn btn-primary"
          type="button"
          :disabled="selecionados.size === 0 || !loteStatus"
          @click="aplicarEmLote"
        >
          <Layers :size="15" />
          Aplicar em lote
        </button>
      </div>
    </div>

    <p v-if="estado.erro" class="erro card">{{ estado.erro }}</p>

    <!-- Tabela -->
    <div class="card table-card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th v-if="podeLote" class="th-check">
                <input type="checkbox" :checked="todosMarcados" @change="alternarTodos" />
              </th>
              <th>Protocolo</th>
              <th>Data</th>
              <th>Unidade Escolar</th>
              <th>Equipamento / Tipo</th>
              <th>Descrição</th>
              <th>Status</th>
              <th class="th-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="estado.loading">
              <td :colspan="podeLote ? 8 : 7" class="td-center">Carregando...</td>
            </tr>
            <tr v-else-if="estado.items.length === 0">
              <td :colspan="podeLote ? 8 : 7" class="td-center">Nenhum chamado encontrado.</td>
            </tr>
            <tr v-for="c in estado.items" :key="c.id" :class="{ selecionado: selecionados.has(c.id) }">
              <td v-if="podeLote" class="td-check">
                <input type="checkbox" :checked="selecionados.has(c.id)" @change="alternar(c.id)" />
              </td>
              <td class="nowrap"><strong>#{{ c.protocolo }}</strong></td>
              <td class="nowrap">{{ formatDate(c.timestamp) }}</td>
              <td>{{ c.unidade }}</td>
              <td>{{ c.tipo }}</td>
              <td class="desc-cell" :title="c.descricao">{{ c.descricao }}</td>
              <td><StatusPill :status="rotuloStatusChamado(c.status)" /></td>
              <td class="td-acoes">
                <div class="acoes-wrap">
                  <button
                    class="acoes-btn"
                    type="button"
                    @click.stop="menuAberto = menuAberto === c.id ? null : c.id"
                  >
                    <MoreVertical :size="17" />
                  </button>
                  <div v-if="menuAberto === c.id" class="acoes-menu">
                    <button type="button" @click="abrirDetalhe(c)">Ver detalhes</button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <PaginationBar
        :page="estado.page"
        :page-size="PAGE_SIZE"
        :total="estado.total"
        @change="(p) => { estado.page = p; void carregar() }"
      />
    </div>

    <!-- Modal detalhe -->
    <BaseModal
      :aberto="detalheAberto"
      :titulo="detalhe ? `Chamado #${detalhe.protocolo}` : 'Chamado'"
      @fechar="detalheAberto = false"
    >
      <div v-if="detalhe" class="detalhe">
        <dl class="detalhe-grid">
          <div><dt>Unidade</dt><dd>{{ detalhe.unidade }}</dd></div>
          <div><dt>Solicitante</dt><dd>{{ detalhe.solicitante }}</dd></div>
          <div><dt>Tipo</dt><dd>{{ detalhe.tipo }}</dd></div>
          <div><dt>Urgência</dt><dd>{{ detalhe.urgencia }}</dd></div>
          <div><dt>Responsável</dt><dd>{{ detalhe.responsavel || '—' }}</dd></div>
          <div><dt>Status atual</dt><dd><StatusPill :status="rotuloStatusChamado(detalhe.status)" /></dd></div>
        </dl>

        <div class="descricao-box">
          <h4>Descrição</h4>
          <p>{{ detalhe.descricao }}</p>
        </div>

        <div v-if="detalhe.historico" class="descricao-box">
          <h4>Histórico</h4>
          <div ref="timelineRef" class="timeline">
            <div v-for="(entrada, i) in historicoEntradas" :key="i" class="timeline-item">
              <span class="timeline-dot" :class="`dot-${entrada.tom}`" />
              <span v-if="entrada.horario" class="timeline-hora">{{ entrada.horario }}</span>
              <p class="timeline-texto">{{ entrada.texto }}</p>
            </div>
          </div>
        </div>

        <template v-if="podeEditar">
          <div class="acao-box">
            <h4>Alterar status</h4>
            <div class="acao-linha">
              <select v-model="novoStatus" class="select-input">
                <option value="ABERTO">Aberto</option>
                <option value="ANDAMENTO">Em atendimento</option>
                <option value="COMUNICADO">Aguardando escola</option>
                <option value="RESOLVIDO">Concluído</option>
              </select>
              <button class="btn btn-primary" type="button" :disabled="salvando" @click="salvarStatus">
                Salvar
              </button>
            </div>
            <textarea
              v-if="novoStatus === 'RESOLVIDO'"
              v-model="descricaoResolucao"
              class="input textarea"
              placeholder="Descreva a resolução (obrigatório informar o que foi feito)"
            />
          </div>

          <div class="acao-box">
            <h4>Adicionar resposta ao histórico</h4>
            <div class="acao-linha">
              <input v-model="textoResposta" class="input" placeholder="Escreva uma atualização..." />
              <button class="btn btn-outline" type="button" :disabled="salvando || !textoResposta.trim()" @click="enviarResposta">
                Registrar
              </button>
            </div>
          </div>
        </template>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.chamados-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 14px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 220px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  padding: 0 12px;
  color: var(--text-muted);
}

.search-box input {
  flex: 1;
  border: none;
  outline: none;
  padding: 10px 0;
  background: transparent;
  color: var(--text-primary);
}

.select-input.slim {
  width: auto;
  min-width: 160px;
}

.erro {
  padding: 14px 18px;
  color: var(--red);
  font-weight: 500;
}

.nowrap {
  white-space: nowrap;
}

.th-check,
.td-check {
  width: 36px;
  text-align: center;
}

.td-check input,
.th-check input {
  width: 15px;
  height: 15px;
  accent-color: var(--sidebar-bg);
  cursor: pointer;
}

tr.selecionado td {
  background: var(--blue-soft);
}

.lote {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  color: var(--text-muted);
  font-size: 13px;
  flex-wrap: wrap;
}

.lote.ativa {
  border-color: var(--blue);
  color: var(--text-primary);
}

.lote-acoes {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lote-acoes .select-input {
  width: auto;
}

.desc-cell {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-center {
  text-align: center;
  color: var(--text-muted);
  padding: 28px !important;
}

.th-acoes,
.td-acoes {
  width: 60px;
  text-align: center;
}

.acoes-wrap {
  position: relative;
  display: inline-block;
}

.acoes-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--text-secondary);
}

.acoes-btn:hover {
  background: var(--surface-muted);
}

.acoes-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  z-index: 60;
  min-width: 180px;
  padding: 6px;
}

.acoes-menu button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 9px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.acoes-menu button:hover {
  background: var(--surface-muted);
}

.detalhe {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.detalhe-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 20px;
  margin: 0;
}

.detalhe-grid dt {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.detalhe-grid dd {
  margin: 0;
  font-size: 13.5px;
  color: var(--text-primary);
}

.descricao-box h4,
.acao-box h4 {
  font-size: 13px;
  margin: 0 0 8px;
}

.descricao-box p {
  margin: 0;
  font-size: 13.5px;
  color: var(--text-secondary);
  white-space: pre-wrap;
}

/* ---------- Chips de filtro rápido ---------- */
.chips {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.chips-grupo {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.chips-divisor {
  width: 1px;
  height: 22px;
  background: var(--border-strong);
}

.chip {
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 600;
  background: var(--slate-soft);
  color: var(--text-secondary);
  transition:
    background 0.12s ease,
    color 0.12s ease;
}

.chip:hover {
  background: var(--border-strong);
}

.chip.ativo {
  background: var(--sidebar-bg);
  color: #fff;
}

/* ---------- Histórico como linha do tempo ---------- */
.timeline {
  max-height: 260px;
  overflow-y: auto;
  padding: 4px 2px;
}

.timeline-item {
  position: relative;
  margin-left: 6px;
  padding: 0 0 16px 24px;
  border-left: 2px solid var(--border);
}

.timeline-item:last-child {
  padding-bottom: 4px;
  border-left-color: transparent;
}

.timeline-dot {
  position: absolute;
  left: -6px;
  top: 3px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-green {
  background: var(--green);
  box-shadow: 0 0 0 3px var(--green-soft);
}

.dot-blue {
  background: var(--blue);
  box-shadow: 0 0 0 3px var(--blue-soft);
}

.dot-purple {
  background: var(--purple);
  box-shadow: 0 0 0 3px var(--purple-soft);
}

.dot-slate {
  background: var(--slate);
  box-shadow: 0 0 0 3px var(--slate-soft);
}

.timeline-hora {
  display: block;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-primary);
}

.timeline-texto {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
  white-space: pre-wrap;
}

.acao-linha {
  display: flex;
  gap: 10px;
}

.acao-linha .select-input {
  max-width: 220px;
}

.textarea {
  margin-top: 10px;
  min-height: 80px;
  resize: vertical;
}
</style>
