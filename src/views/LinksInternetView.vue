<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { AlertTriangle, CheckCircle2, Download, Globe, Pencil, Plus, Search, Trash2, Wifi, XCircle, ExternalLink } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import { LINKS_INTERNET, type LinkInternetUnidade } from '@/data/linksInternetData'

const PAGE_SIZE = 12
const STORAGE_KEY = 'portal:links-internet:v1'

type Linha = LinkInternetUnidade

interface FormState {
  escola: string
  endereco: string
  ure: string
  possuiSegundoLink: boolean
  empresa: string
  velocidadeMbps: number | null
  status: string
  dataPrevistaInstalacao: string
  responsavel: string
  observacoes: string
  ultimaAtualizacao: string
  cie: string
}

const registros = ref<Linha[]>([])
const modalAberto = ref(false)
const editandoIndex = ref<number | null>(null)

const form = reactive<FormState>({
  escola: '',
  endereco: '',
  ure: 'Leste 3',
  possuiSegundoLink: true,
  empresa: '',
  velocidadeMbps: null,
  status: 'Não iniciado',
  dataPrevistaInstalacao: '',
  responsavel: '',
  observacoes: '',
  ultimaAtualizacao: '',
  cie: '',
})

function carregar() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Linha[]
      if (Array.isArray(parsed)) {
        registros.value = parsed
        return
      }
    }
  } catch {
    // ignora cache inválido
  }
  registros.value = LINKS_INTERNET.map((r) => ({ ...r }))
}

function persistir() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registros.value))
  } catch {
    // ignora falhas de storage
  }
}

carregar()

const busca = ref('')
const filtroStatus = ref('')
const filtroEmpresa = ref('')
const filtroPossui = ref<'' | 'sim' | 'nao'>('')

const statusOpcoes = computed(() =>
  [...new Set(registros.value.map((u) => u.status).filter(Boolean))].sort(),
)

const empresaOpcoes = computed(() =>
  [...new Set(registros.value.map((u) => u.empresa).filter(Boolean) as string[])].sort(),
)

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const temFiltros = computed(() => Boolean(busca.value || filtroStatus.value || filtroEmpresa.value || filtroPossui.value))

const filtradas = computed(() => {
  const b = norm(busca.value.trim())
  return registros.value.filter((u) => {
    if (b && !norm(`${u.escola} ${u.endereco} ${u.empresa || ''} ${u.responsavel || ''} ${u.observacoes || ''}`).includes(b)) {
      return false
    }
    if (filtroStatus.value && u.status !== filtroStatus.value) return false
    if (filtroEmpresa.value && u.empresa !== filtroEmpresa.value) return false
    if (filtroPossui.value === 'sim' && !u.possuiSegundoLink) return false
    if (filtroPossui.value === 'nao' && u.possuiSegundoLink) return false
    return true
  })
})

const paginaAtual = computed(() => {
  const ini = (estado.page - 1) * PAGE_SIZE
  return filtradas.value.slice(ini, ini + PAGE_SIZE)
})

const estado = reactive({ page: 1 })

const metricas = computed(() => {
  const items = registros.value
  const comLink = items.filter((u) => u.possuiSegundoLink).length
  const instalados = items.filter((u) => u.status.toLowerCase().includes('instalad')).length
  const semLink = items.length - comLink
  const naoInstalados = items.filter((u) => !u.status.toLowerCase().includes('instalad')).length
  const empresas = new Set(items.map((u) => u.empresa).filter(Boolean)).size
  const velocidades = items.map((u) => u.velocidadeMbps).filter((v): v is number => typeof v === 'number')
  const velocidadeMedia = velocidades.length ? Math.round(velocidades.reduce((a, b) => a + b, 0) / velocidades.length) : 0
  const comObs = items.filter((u) => u.observacoes).length
  return { total: items.length, comLink, semLink, instalados, naoInstalados, empresas, velocidadeMedia, comObs }
})

const distribuicaoEmpresa = computed(() => {
  const mapa = new Map<string, number>()
  for (const u of registros.value) {
    if (!u.empresa) continue
    mapa.set(u.empresa, (mapa.get(u.empresa) || 0) + 1)
  }
  return [...mapa.entries()].sort((a, b) => b[1] - a[1])
})

const maxEmpresa = computed(() => (distribuicaoEmpresa.value.length ? distribuicaoEmpresa.value[0][1] : 1))

watch([busca, filtroStatus, filtroEmpresa, filtroPossui], () => {
  estado.page = 1
})

watch(estado, () => {}, { deep: true })

function formatDate(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('pt-BR')
}

function formatStatus(u: Linha): string {
  return u.status || 'Não informado'
}

function fmt(v: number): string {
  return v.toLocaleString('pt-BR')
}

function firewallUrl(cie: string | null): string | null {
  const code = (cie || '').trim()
  return code ? `https://fw-${code}/login` : null
}

function abrirAcessarFirewall(u: Linha) {
  const url = firewallUrl(u.cie)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

function abrirNovo() {
  editandoIndex.value = null
  Object.assign(form, {
    escola: '',
    endereco: '',
    ure: 'Leste 3',
    possuiSegundoLink: true,
    empresa: '',
    velocidadeMbps: null,
    status: 'Não iniciado',
    dataPrevistaInstalacao: '',
    responsavel: '',
    observacoes: '',
    ultimaAtualizacao: new Date().toISOString(),
    cie: '',
  })
  modalAberto.value = true
}

function abrirEdicao(idxInFiltradas: number) {
  const u = paginaAtual.value[idxInFiltradas]
  const idxReal = registros.value.indexOf(u)
  editandoIndex.value = idxReal >= 0 ? idxReal : null
  Object.assign(form, {
    escola: u.escola,
    endereco: u.endereco,
    ure: u.ure,
    possuiSegundoLink: u.possuiSegundoLink,
    empresa: u.empresa || '',
    velocidadeMbps: u.velocidadeMbps,
    status: u.status,
    dataPrevistaInstalacao: u.dataPrevistaInstalacao || '',
    responsavel: u.responsavel || '',
    observacoes: u.observacoes || '',
    ultimaAtualizacao: u.ultimaAtualizacao || new Date().toISOString(),
    cie: u.cie || '',
  })
  modalAberto.value = true
}

function fecharModal() {
  modalAberto.value = false
}

function salvarForm() {
  const escola = form.escola.trim()
  if (!escola) return
  const payload: Linha = {
    id: null,
    escola,
    endereco: form.endereco.trim(),
    ure: form.ure.trim() || 'Leste 3',
    possuiSegundoLink: form.possuiSegundoLink,
    possuiLabel: form.possuiSegundoLink ? 'Sim' : 'Não',
    empresa: form.empresa.trim() || null,
    velocidadeMbps: form.velocidadeMbps,
    status: form.status.trim() || 'Não informado',
    dataPrevistaInstalacao: form.dataPrevistaInstalacao.trim() || null,
    responsavel: form.responsavel.trim() || null,
    observacoes: form.observacoes.trim() || null,
    ultimaAtualizacao: form.ultimaAtualizacao.trim() || new Date().toISOString(),
    cie: form.cie.trim() || null,
  }
  if (editandoIndex.value !== null && editandoIndex.value >= 0) {
    registros.value[editandoIndex.value] = payload
  } else {
    registros.value.unshift(payload)
  }
  persistir()
  modalAberto.value = false
}

function remover(idxInFiltradas: number) {
  const u = paginaAtual.value[idxInFiltradas]
  if (!u || !window.confirm(`Remover a escola "${u.escola}" desta lista?`)) return
  const idxReal = registros.value.indexOf(u)
  if (idxReal >= 0) {
    registros.value.splice(idxReal, 1)
    persistir()
  }
}

function limparFiltros() {
  busca.value = ''
  filtroStatus.value = ''
  filtroEmpresa.value = ''
  filtroPossui.value = ''
  estado.page = 1
}

function exportarCsv() {
  const cabecalho = [
    'Escola', 'Endereço', 'URE', 'Possui 2º link', 'Empresa', 'Velocidade (Mbps)',
    'Status', 'Data prevista/instalação', 'Responsável', 'Observações', 'Última atualização', 'CIE',
  ]
  const linhas = filtradas.value.map((u) => [
    u.escola, u.endereco, u.ure, u.possuiLabel, u.empresa || '', u.velocidadeMbps ?? '',
    u.status, u.dataPrevistaInstalacao || '', u.responsavel || '', u.observacoes || '', u.ultimaAtualizacao || '', u.cie || '',
  ])
  const csv = [cabecalho, ...linhas]
    .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `links-internet-unidades-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

</script>

<template>
  <div class="links-page">
    <!-- KPIs -->
    <div class="stats-grid">
      <StatCard label="Total de unidades" :value="fmt(metricas.total)" tone="blue">
        <Globe :size="22" />
      </StatCard>
      <StatCard label="Com 2º link" :value="fmt(metricas.comLink)" tone="green" :detail="`${Math.round((metricas.comLink / metricas.total) * 100)}% do total`">
        <CheckCircle2 :size="22" />
      </StatCard>
      <StatCard label="Sem 2º link" :value="fmt(metricas.semLink)" tone="red">
        <XCircle :size="22" />
      </StatCard>
      <StatCard label="Links instalados" :value="fmt(metricas.instalados)" tone="green" :detail="`${Math.round((metricas.instalados / metricas.total) * 100)}% do total`">
        <Wifi :size="22" />
      </StatCard>
      <StatCard label="Não instalados" :value="fmt(metricas.naoInstalados)" tone="yellow">
        <AlertTriangle :size="22" />
      </StatCard>
      <StatCard label="Empresas contratadas" :value="fmt(metricas.empresas)" tone="purple" :detail="`Vel. média ${fmt(metricas.velocidadeMedia)} Mbps`">
        <Globe :size="22" />
      </StatCard>
    </div>

    <div class="main-grid">
      <div class="card dist-card">
        <h3 class="card-title">Empresas contratadas</h3>
        <div v-if="distribuicaoEmpresa.length === 0" class="empty">Sem dados.</div>
        <div v-for="[empresa, qtd] in distribuicaoEmpresa" :key="empresa" class="bar-row">
          <span class="bar-label">{{ empresa }}</span>
          <div class="bar-track">
            <div class="bar-fill" :style="{ width: `${(qtd / maxEmpresa) * 100}%` }" />
          </div>
          <span class="bar-value">{{ qtd }}</span>
        </div>
      </div>

      <div class="card obs-card">
        <h3 class="card-title">Observações registradas</h3>
        <p class="obs-numero">{{ fmt(metricas.comObs) }} unidade(s) com observação</p>
        <p class="obs-hint">Use a busca para localizar termos nas observações.</p>
        <button class="btn btn-primary" type="button" @click="abrirNovo">
          <Plus :size="15" /> Adicionar link
        </button>
      </div>
    </div>

    <div class="toolbar card">
      <div class="search-box">
        <Search :size="16" />
        <input v-model="busca" placeholder="Buscar escola, endereço, empresa, responsável ou observação..." />
      </div>
      <select v-model="filtroStatus" class="select-input filtro">
        <option value="">Status: todos</option>
        <option v-for="s in statusOpcoes" :key="s" :value="s">{{ s }}</option>
      </select>
      <select v-model="filtroEmpresa" class="select-input filtro">
        <option value="">Empresa: todas</option>
        <option v-for="e in empresaOpcoes" :key="e" :value="e">{{ e }}</option>
      </select>
      <select v-model="filtroPossui" class="select-input filtro">
        <option value="">2º link: todos</option>
        <option value="sim">Com 2º link</option>
        <option value="nao">Sem 2º link</option>
      </select>
      <button class="btn btn-outline" type="button" :disabled="filtradas.length === 0" @click="exportarCsv">
        <Download :size="15" /> Exportar CSV
      </button>
      <button v-if="temFiltros" class="btn btn-outline" type="button" @click="limparFiltros">
        Limpar filtros
      </button>
    </div>

    <p class="info-linha card">
      Exibindo {{ filtradas.length }} de {{ registros.length }} unidades
    </p>

    <div class="card table-card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th scope="col">Escola</th>
              <th scope="col">Endereço</th>
              <th scope="col">2º link</th>
              <th scope="col">Empresa</th>
              <th scope="col">Vel. (Mbps)</th>
              <th scope="col">Status</th>
              <th scope="col">Data prev./inst.</th>
              <th scope="col">Responsável</th>
              <th scope="col">Observações</th>
              <th scope="col">CIE / Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="paginaAtual.length === 0">
              <td colspan="10" class="td-center">
                <div class="empty-state">
                  <p>{{ temFiltros ? 'Nenhuma unidade corresponde aos filtros.' : 'Nenhuma unidade cadastrada.' }}</p>
                  <button v-if="temFiltros" class="btn btn-outline btn-mini" type="button" @click="limparFiltros">Limpar filtros</button>
                </div>
              </td>
            </tr>
            <tr v-for="(u, i) in paginaAtual" :key="u.escola + i">
              <td class="escola-cell">
                <strong>{{ u.escola }}</strong>
                <span class="ure">{{ u.ure }}</span>
              </td>
              <td>{{ u.endereco || '—' }}</td>
              <td>
                <span class="pill-mini" :class="u.possuiSegundoLink ? 'pill-sim' : 'pill-nao'">
                  {{ u.possuiLabel || (u.possuiSegundoLink ? 'Sim' : 'Não') }}
                </span>
              </td>
              <td>{{ u.empresa || '—' }}</td>
              <td class="td-num">{{ u.velocidadeMbps ?? '—' }}</td>
              <td><StatusPill :status="formatStatus(u)" /></td>
              <td class="nowrap">{{ formatDate(u.dataPrevistaInstalacao) }}</td>
              <td>{{ u.responsavel || '—' }}</td>
              <td class="obs-cell">
                <span v-if="u.observacoes" class="obs-text">{{ u.observacoes }}</span>
                <span v-else class="muted">—</span>
              </td>
              <td class="acoes-cell nowrap">
                <span class="cie-code">{{ u.cie || '—' }}</span>
                <div class="acoes-btns">
                  <button
                    v-if="firewallUrl(u.cie)"
                    class="btn btn-mini"
                    type="button"
                    @click="abrirAcessarFirewall(u)"
                    title="Acessar Firewall"
                  >
                    <ExternalLink :size="13" /> Acessar Firewall
                  </button>
                  <button class="btn btn-mini btn-outline" type="button" @click="abrirEdicao(i)" title="Editar">
                    <Pencil :size="13" /> Editar
                  </button>
                  <button class="btn btn-mini btn-danger" type="button" @click="remover(i)" title="Remover">
                    <Trash2 :size="13" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <PaginationBar
        :page="estado.page"
        :page-size="PAGE_SIZE"
        :total="filtradas.length"
        @change="(p) => { estado.page = p }"
      />
    </div>

    <!-- Modal de edição / adição -->
    <BaseModal :titulo="editandoIndex !== null ? 'Editar link da escola' : 'Adicionar link à escola'" :aberto="modalAberto" @fechar="fecharModal">
      <div class="form-grid">
        <label class="form-field span-2">
          <span>Escola *</span>
          <input v-model="form.escola" type="text" placeholder="Nome da escola" />
        </label>
        <label class="form-field span-2">
          <span>Endereço</span>
          <input v-model="form.endereco" type="text" placeholder="Endereço" />
        </label>
        <label class="form-field">
          <span>URE</span>
          <input v-model="form.ure" type="text" />
        </label>
        <label class="form-field">
          <span>CIE (para firewall)</span>
          <input v-model="form.cie" type="text" placeholder="Ex.: 003244" />
        </label>
        <label class="form-field">
          <span>Possui 2º link?</span>
          <select v-model="form.possuiSegundoLink">
            <option :value="true">Sim</option>
            <option :value="false">Não</option>
          </select>
        </label>
        <label class="form-field">
          <span>Empresa contratada</span>
          <input v-model="form.empresa" type="text" placeholder="AVIV, GIGA+..." />
        </label>
        <label class="form-field">
          <span>Velocidade (Mbps)</span>
          <input v-model.number="form.velocidadeMbps" type="number" min="0" step="1" />
        </label>
        <label class="form-field">
          <span>Status</span>
          <select v-model="form.status">
            <option>Instalado</option>
            <option>Não iniciado</option>
            <option>Em fase de contratação</option>
            <option>Cancelado</option>
          </select>
        </label>
        <label class="form-field">
          <span>Data prevista/instalação</span>
          <input v-model="form.dataPrevistaInstalacao" type="date" />
        </label>
        <label class="form-field span-2">
          <span>Responsável pelo registro</span>
          <input v-model="form.responsavel" type="text" />
        </label>
        <label class="form-field span-2">
          <span>Observações</span>
          <textarea v-model="form.observacoes" rows="3" />
        </label>
      </div>
      <template #footer>
        <button class="btn btn-outline" type="button" @click="fecharModal">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="!form.escola.trim()" @click="salvarForm">
          Salvar
        </button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.links-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
  gap: 14px;
}

.main-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}

@media (max-width: 900px) {
  .main-grid {
    grid-template-columns: 1fr;
  }
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md, 12px);
  padding: 16px;
}

.card-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.dist-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bar-row {
  display: grid;
  grid-template-columns: minmax(90px, 1fr) 2fr 32px;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
}

.bar-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-secondary);
}

.bar-track {
  height: 8px;
  background: var(--surface-muted);
  border-radius: 999px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: var(--blue);
  border-radius: 999px;
  transition: width 0.25s ease;
}

.bar-value {
  text-align: right;
  font-weight: 700;
  color: var(--text-primary);
}

.obs-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}

.obs-numero {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
}

.obs-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0 0 8px;
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
  border-radius: var(--radius-sm, 8px);
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

.filtro {
  max-width: 200px;
}

.table-card {
  overflow: visible;
}

.table-wrap {
  overflow: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table th,
.table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

.table th {
  text-align: left;
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 700;
  white-space: nowrap;
}

.td-num {
  text-align: right;
  white-space: nowrap;
}

.td-center {
  text-align: center;
  color: var(--text-muted);
  padding: 28px !important;
}

.nowrap {
  white-space: nowrap;
}

.escola-cell strong {
  display: block;
  color: var(--text-primary);
}

.escola-cell .ure {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
}

.pill-mini {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
}

.pill-sim {
  background: var(--green-soft);
  color: var(--green);
}

.pill-nao {
  background: var(--red-soft);
  color: var(--red);
}

.obs-cell {
  max-width: 260px;
}

.obs-text {
  white-space: pre-line;
  color: var(--text-secondary);
  font-size: 12px;
}

.muted {
  color: var(--text-muted);
}

.info-linha {
  padding: 8px 16px;
  font-size: 12.5px;
  color: var(--text-muted);
  margin: 0;
}

.empty {
  color: var(--text-muted);
  font-size: 13px;
}

.acoes-cell {
  min-width: 200px;
}

.cie-code {
  display: block;
  font-size: 11.5px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.acoes-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: var(--radius-sm, 8px);
  font-size: 13px;
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
}

.btn-mini {
  padding: 4px 8px;
  font-size: 11.5px;
}

.btn-primary {
  background: var(--blue);
  color: #fff;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-outline {
  background: transparent;
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.btn-danger {
  background: var(--red-soft);
  color: var(--red);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}

.span-2 {
  grid-column: span 2;
}

@media (max-width: 640px) {
  .span-2 {
    grid-column: span 1;
  }
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12.5px;
  color: var(--text-secondary);
  font-weight: 600;
}

.form-field input,
.form-field select,
.form-field textarea {
  padding: 9px 10px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm, 8px);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 400;
}

.form-field textarea {
  resize: vertical;
}
/* Respeita preferencia de movimento reduzido */
@media (prefers-reduced-motion: reduce) {
  .bar-fill,
  .btn,
  .modal,
  .modal-backdrop {
    transition: none !important;
    animation: none !important;
  }
}

</style>
