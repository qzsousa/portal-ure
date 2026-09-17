<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { apiError } from '@/utils/apiError'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  MoreVertical,
  School,
  Search,
} from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import {
  atualizarStatusChamado,
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

const podeEditar = computed(() => ['ADMIN', 'TECNICO', 'GESTOR'].includes(auth.user?.nivel || ''))

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
    </div>

    <p v-if="estado.erro" class="erro card">{{ estado.erro }}</p>

    <!-- Tabela -->
    <div class="card table-card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
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
              <td colspan="7" class="td-center">Carregando...</td>
            </tr>
            <tr v-else-if="estado.items.length === 0">
              <td colspan="7" class="td-center">Nenhum chamado encontrado.</td>
            </tr>
            <tr v-for="c in estado.items" :key="c.id">
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
          <pre class="historico">{{ detalhe.historico }}</pre>
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

.historico {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px;
  max-height: 220px;
  overflow-y: auto;
  font-family: inherit;
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
