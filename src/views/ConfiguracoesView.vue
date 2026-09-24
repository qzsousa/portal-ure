<script setup lang="ts">
/**
 * Configurações do portal (somente Administrador).
 * Abas: Catálogo (categoria/marca/modelo), Status do parque, Formulário de chamados, Logs do sistema, Integrações.
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { CheckCircle2, Loader2, Plus, ShieldCheck, Trash2, XCircle } from '@lucide/vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
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
import { apiError } from '@/utils/apiError'
import { formatDateTime } from '@/utils/format'
import { useUiStore } from '@/stores/ui'
import { useErrorLogStore } from '@/stores/errorLog'
import FormularioAdmin from '@/components/config/FormularioAdmin.vue'

type Aba = 'catalogo' | 'status' | 'formulario' | 'logs' | 'integracoes'

const ui = useUiStore()
const aba = ref<Aba>('catalogo')

const ABAS: Array<{ id: Aba; rotulo: string }> = [
  { id: 'catalogo', rotulo: 'Catálogo de equipamentos' },
  { id: 'status', rotulo: 'Status do parque' },
  { id: 'formulario', rotulo: 'Formulário de chamados' },
  { id: 'logs', rotulo: 'Logs do sistema' },
  { id: 'integracoes', rotulo: 'Integrações' },
]

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
  // 3) SSO (o mesmo token funciona nos dois?)
  integracoes.sso =
    integracoes.chamados.ok && integracoes.sce.ok
      ? { testado: true, ok: true, msg: 'Login único ativo (JWT aceito nos dois backends)' }
      : { testado: true, ok: false, msg: 'SSO indisponível para algum dos backends' }
  integracoes.carregando = false
}

onMounted(() => {
  void carregarCatalogo()
  void carregarStatus()
  void carregarLogs()
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
        <section v-else class="card conf-card">
          <h3>Integrações do portal</h3>
          <p class="conf-desc">
            Verifica se o portal está conversando com os dois backends e se o login único (SSO) está ativo.
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
      </div>
    </div>
  </div>
</template>

<style scoped>
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
