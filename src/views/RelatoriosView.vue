<script setup lang="ts">
import { ref, type Component } from 'vue'
import type { AxiosError } from 'axios'
import {
  CheckCircle2,
  ClipboardList,
  Download,
  Info,
  Loader2,
  Monitor,
  PieChart,
  School,
  Wrench,
} from '@lucide/vue'
import {
  exportarCsv,
  exportarPdf,
  listarEquipamentosDaFilial,
  listarUnidadesResumo,
} from '@/api/sce'
import { listarChamados, rotuloStatusChamado } from '@/api/chamados'
import { listarCategoriasFormulario } from '@/api/formulario'
import { apiError } from '@/utils/apiError'
import { formatDate } from '@/utils/format'
import { listarRelatorioTecnicos, type RelatorioTecnico } from '@/api/sce'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { STATUS_EM_ABERTO, type Chamado, type StatusChamado } from '@/types'

const auth = useAuthStore()
const ui = useUiStore()

const gerando = ref<string | null>(null)
const tecnicos = ref<RelatorioTecnico[]>([])
const carregandoTecnicos = ref(false)

async function carregarTecnicos() {
  carregandoTecnicos.value = true
  try {
    tecnicos.value = await listarRelatorioTecnicos()
  } catch {
    tecnicos.value = []
  } finally {
    carregandoTecnicos.value = false
  }
}
void carregarTecnicos()

/* ---------------------------------------------------------------
 * Geração de CSV no cliente (mesmo padrão de download de api/sce.ts)
 * --------------------------------------------------------------- */

function csvCelula(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Monta CSV com ';' (padrão Excel pt-BR) e BOM para acentos. */
function montarCsv(cabecalho: string[], linhas: (string | number | null | undefined)[][]): string {
  const corpo = [cabecalho, ...linhas].map((cols) => cols.map(csvCelula).join(';')).join('\r\n')
  return '﻿' + corpo
}

function baixarCsv(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

/* ---------------------------------------------------------------
 * Fontes de dados
 * --------------------------------------------------------------- */

/** Busca TODAS as páginas de chamados (100 por vez) e filtra localmente. */
async function listarTodosChamados(statuses: StatusChamado[]): Promise<Chamado[]> {
  const limit = 100
  let page = 1
  let total = Infinity
  const todos: Chamado[] = []
  while (todos.length < total) {
    const res = await listarChamados({ page, limit })
    todos.push(...res.data)
    total = res.meta.total
    if (res.data.length === 0) break
    page++
  }
  return todos.filter((c) => statuses.includes(c.status))
}

/** Busca TODOS os chamados (sem filtro de status), paginando 100 por vez. */
async function listarTodosChamadosGeral(): Promise<Chamado[]> {
  const limit = 100
  let page = 1
  let total = Infinity
  const todos: Chamado[] = []
  while (todos.length < total) {
    const res = await listarChamados({ page, limit })
    todos.push(...res.data)
    total = res.meta.total
    if (res.data.length === 0) break
    page++
  }
  return todos
}
function csvDeChamados(chamados: Chamado[]): string {
  return montarCsv(
    ['protocolo', 'data', 'unidade', 'tipo', 'descricao', 'urgencia', 'status', 'responsavel'],
    chamados.map((c) => [
      formatDate(c.timestamp),
      c.unidade,
      c.tipo,
      c.descricao,
      c.urgencia,
      rotuloStatusChamado(c.status),
      c.responsavel || '',
    ]),
  )
}

/**
 * Tudo que ainda não foi encerrado. Lista explícita em vez de "todos menos os
 * concluídos": o backend rejeita lista vazia e um status novo errado aqui
 * sumiria chamado do relatório em silêncio.
 */
async function gerarChamadosAbertos() {
  const chamados = await listarTodosChamados(STATUS_EM_ABERTO)
  baixarCsv(`chamados-abertos-atendimento-${Date.now()}.csv`, csvDeChamados(chamados))
}

async function gerarChamadosConcluidos() {
  const chamados = await listarTodosChamados(['RESOLVIDO'])
  baixarCsv(`chamados-concluidos-${Date.now()}.csv`, csvDeChamados(chamados))
}

const TECNICOS_RELATORIO: string[] = [
  'JESSICA', 'MATHEUS', 'PABLO', 'FABIO', 'FERNANDA', 'GUILHERME',
  'JOAO', 'CHARLES', 'HEBERT', 'JOSEMIR', 'VALDEIR', 'CAROL',
  'ANA - ASURE', 'ANDREW ISAC',
]

async function gerarChamadosResolvidosPorTecnico() {
  const todos = await listarTodosChamadosGeral()
  const normalizar = (s: string | null | undefined) => (s || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const permitidos = new Set(TECNICOS_RELATORIO.map((n) => normalizar(n)))
  const porTecnico = new Map<string, { total: number; resolvidos: number; abertos: number; andamento: number; conferencia: number; comunicado: number }>()
  for (const nome of TECNICOS_RELATORIO) {
    porTecnico.set(nome, { total: 0, resolvidos: 0, abertos: 0, andamento: 0, conferencia: 0, comunicado: 0 })
  }
  for (const c of todos) {
    const chave = normalizar(c.responsavel)
    if (!permitidos.has(chave)) continue
    const nome = TECNICOS_RELATORIO.find((n) => normalizar(n) === chave)!
    const g = porTecnico.get(nome)!
    g.total++
    if (c.status === 'RESOLVIDO') g.resolvidos++
    else if (c.status === 'ABERTO') g.abertos++
    else if (c.status === 'ANDAMENTO') g.andamento++
    else if (c.status === 'AGUARDANDO_CONFERENCIA') g.conferencia++
    else if (c.status === 'COMUNICADO') g.comunicado++
  }
  const linhas = TECNICOS_RELATORIO.map((nome) => {
    const g = porTecnico.get(nome)!
    const taxa = g.total > 0 ? Math.round((g.resolvidos / g.total) * 100) : 0
    return [nome, g.total, g.resolvidos, g.abertos, g.andamento, g.conferencia, g.comunicado, `${taxa}%`]
  })
  const totalGeral = linhas.reduce((acc, l) => acc + (l[1] as number), 0)
  const resolvidosGeral = linhas.reduce((acc, l) => acc + (l[2] as number), 0)
  linhas.push(['TOTAL', totalGeral, resolvidosGeral, '', '', '', '', totalGeral > 0 ? `${Math.round((resolvidosGeral / totalGeral) * 100)}%` : '0%'])
  baixarCsv(
    `chamados-resolvidos-por-tecnico-${Date.now()}.csv`,
    montarCsv(
      ['Tecnico', 'Total chamados', 'Resolvidos', 'Abertos', 'Em andamento', 'Aguardando conferencia', 'Aguardando resposta', 'Taxa de conclusao'],
      linhas,
    ),
  )
}

async function gerarInventarioPorUnidade() {
  const unidades = await listarUnidadesResumo()
  baixarCsv(
    `inventario-por-unidade-${Date.now()}.csv`,
    montarCsv(
      [
        'codigo',
        'unidade_escolar',
        'diretoria',
        'total_equipamentos',
        'disponiveis',
        'manutencao',
        'quebrados',
        'extraviados',
      ],
      unidades.map((u, i) => [
        String(i + 1).padStart(3, '0'),
        u.nome,
        '',
        u.total,
        u.disponiveis,
        u.manutencao,
        u.quebrados,
        u.extraviados,
      ]),
    ),
  )
}

async function gerarManutencoes() {
  const equipamentos = await listarEquipamentosDaFilial()
  const emManutencao = equipamentos.filter((e) => !!e.statusManutencao)
  baixarCsv(
    `manutencoes-${Date.now()}.csv`,
    montarCsv(
      ['modelo', 'patrimonio', 'unidade', 'status_manutencao', 'data_ultima_atualizacao'],
      emManutencao.map((e) => [
        e.modelo,
        e.patrimonio || '',
        e.unidade,
        e.statusManutencao || '',
        formatDate(e.dataUltimaAtualizacao),
      ]),
    ),
  )
}

async function gerarJustificativaResponsaveis() {
  const [todos, categorias] = await Promise.all([listarTodosChamadosGeral(), listarCategoriasFormulario()])
  const catMap = new Map(categorias.map((c) => [c.chave, c.nome]))
  const derivarCategoria = (c: Chamado) => {
    const chave = (c.categoriaChave || '').trim()
    if (chave && catMap.has(chave)) return catMap.get(chave) as string
    const tipo = (c.tipo || '').trim()
    const idx = tipo.indexOf(' - ')
    return idx < 0 ? tipo : tipo.slice(0, idx).trim()
  }
  const derivarSubcategoria = (c: Chamado) => {
    const tipo = (c.tipo || '').trim()
    const idx = tipo.indexOf(' - ')
    return idx < 0 ? '' : tipo.slice(idx + 3).trim()
  }
  const linhas = todos
    .slice()
    .sort((a, b) => (a.protocolo || '').localeCompare(b.protocolo || ''))
    .map((c) => {
      const historico = c.historico || ''
      const matches = historico.match(/por ([A-Za-zÀ-ÿ \-]+?)(?:\n|\(|$)/g) || []
      const last = matches.length ? matches[matches.length - 1].replace(/^por /, '').trim() : ''
      const lastNorm = last.toLowerCase()
      let proposto = ''
      let criterio = ''
      let justificativa = ''
      if (lastNorm === 'jessica' || lastNorm === 'ana - asure' || lastNorm === 'matheus') {
        proposto = lastNorm === 'jessica' ? 'Jessica' : lastNorm === 'ana - asure' ? 'Ana - ASURE' : 'Matheus'
        criterio = 'HISTORICO'
        justificativa = `Responsável pelo histórico: ${proposto}`
      } else if (lastNorm === 'seintec' || lastNorm === 'setec') {
        proposto = 'SEINTEC'
        criterio = 'LEGADO'
        justificativa = 'Chamado legado/importado: fechado por SEINTEC/SETEC'
      } else if (c.tecnicoResolucao) {
        proposto = c.tecnicoResolucao
        criterio = 'TECNICO_RESOLUCAO'
        justificativa = `Técnico ${proposto} registrou a resolução`
      } else if (c.responsavel) {
        proposto = c.responsavel
        criterio = 'RESPONSAVEL_ATUAL'
        justificativa = `Responsável atual: ${proposto}`
      } else {
        proposto = ''
        criterio = 'SEM_RESPONSAVEL'
        justificativa = 'Sem responsável (não encaminhado)'
      }
      const atual = c.responsavel || ''
      const divergente = atual.trim().toLowerCase() === proposto.trim().toLowerCase() ? 'NAO' : 'SIM'
      return [
        c.protocolo,
        c.unidade,
        c.tipo,
        derivarCategoria(c),
        derivarSubcategoria(c),
        rotuloStatusChamado(c.status),
        formatDate(c.timestamp),
        atual,
        proposto,
        criterio,
        justificativa,
        divergente,
      ]
    })
  baixarCsv(
    `justificativa-chamados-${Date.now()}.csv`,
    montarCsv(
      ['protocolo', 'unidade', 'tipo', 'categoria', 'subcategoria', 'status', 'data', 'responsavel_atual', 'responsavel_proposto', 'criterio', 'justificativa', 'divergente'],
      linhas,
    ),
  )
}

/* ---------------------------------------------------------------
 * Catálogo de relatórios
 * --------------------------------------------------------------- */

interface Relatorio {
  id: string
  titulo: string
  descricao: string
  formato: 'CSV' | 'PDF'
  tone: 'blue' | 'green' | 'yellow' | 'red' | 'slate' | 'purple'
  icone: Component
  executar: () => Promise<void>
}

const relatorios: Relatorio[] = [
  {
    id: 'inventario',
    titulo: 'Inventário de Equipamentos',
    descricao: 'Planilha completa do inventário de equipamentos do seu escopo, exportada pelo SCE.',
    formato: 'CSV',
    tone: 'blue',
    icone: Monitor,
    executar: () => exportarCsv(),
  },
  {
    id: 'status-pdf',
    titulo: 'Equipamentos por Status',
    descricao: 'Documento em PDF com a distribuição dos equipamentos por status.',
    formato: 'PDF',
    tone: 'purple',
    icone: PieChart,
    executar: () => exportarPdf(),
  },
  {
    id: 'chamados-abertos',
    titulo: 'Chamados em Aberto',
    descricao: 'Listagem de todos os chamados ainda não concluídos pela conferência da escola.',
    formato: 'CSV',
    tone: 'yellow',
    icone: ClipboardList,
    executar: gerarChamadosAbertos,
  },
{
    id: 'chamados-concluidos',
    titulo: 'Chamados Concluídos',
    descricao: 'Listagem de todos os chamados já concluídos, com data e responsável.',
    formato: 'CSV',
    tone: 'green',
    icone: CheckCircle2,
    executar: gerarChamadosConcluidos,
  },
  {
    id: 'justificativa-responsaveis',
    titulo: 'Justificativa de Responsáveis',
    descricao: 'Lista todos os chamados com responsável atual, proposto, critério e justificativa (histórico, resolução, encaminhamento). Inclui tipo, categoria e subcategoria.',
    formato: 'CSV',
    tone: 'blue',
    icone: ClipboardList,
    executar: gerarJustificativaResponsaveis,
  },
  {
    id: 'chamados-resolvidos-tecnico',
    titulo: 'Chamados Resolvidos por Técnico',
    descricao: 'Resumo por técnico (JESSICA, MATHEUS, PABLO, FABIO, FERNANDA, GUILHERME, JOAO, CHARLES, HEBERT, JOSEMIR, VALDEIR, CAROL): total, resolvidos, abertos, em andamento, aguardando conferência e taxa de conclusão.',
    formato: 'CSV',
    tone: 'green',
    icone: CheckCircle2,
    executar: gerarChamadosResolvidosPorTecnico,
  },
  {
    id: 'inventario-unidade',
    titulo: 'Inventário por Unidade',
    descricao: 'Resumo de equipamentos por unidade escolar (totais, disponíveis, manutenção...).',
    formato: 'CSV',
    tone: 'blue',
    icone: School,
    executar: gerarInventarioPorUnidade,
  },
  {
    id: 'manutencoes',
    titulo: 'Manutenções',
    descricao: 'Equipamentos com status de manutenção registrado, com última atualização.',
    formato: 'CSV',
    tone: 'red',
    icone: Wrench,
    executar: gerarManutencoes,
  },
]

/* ---------------------------------------------------------------
 * Execução com feedback
 * --------------------------------------------------------------- */

function mensagemErro(e: unknown): string {
  const status = (e as AxiosError)?.response?.status
  if (status === 401 || status === 403) {
    return 'Seu perfil não tem permissão para gerar este relatório (disponível apenas para ADMIN).'
  }
  return apiError(e, 'Não foi possível gerar o relatório. Tente novamente.')
}

async function gerar(r: Relatorio) {
  if (gerando.value) return
  gerando.value = r.id
  try {
    await r.executar()
    ui.success(`Relatório "${r.titulo}" gerado com sucesso.`)
  } catch (e) {
    ui.error(mensagemErro(e))
  } finally {
    gerando.value = null
  }
}
</script>

<template>
  <div class="relatorios-page">
    <p v-if="!auth.isAdmin" class="aviso card">
      <Info :size="16" />
      <span>
        Alguns relatórios de equipamentos exigem perfil de Administrador. Se aparecer um erro de
        permissão, fale com um administrador.
      </span>
    </p>

    <div class="cards-grid">
      <div v-for="r in relatorios" :key="r.id" class="card rel-card">
        <div class="rel-head">
          <div class="icon-chip" :class="`tone-${r.tone}`">
            <component :is="r.icone" :size="22" />
          </div>
          <span class="badge">{{ r.formato }}</span>
        </div>
        <div class="rel-body">
          <h3>{{ r.titulo }}</h3>
          <p>{{ r.descricao }}</p>
        </div>
        <button
          class="btn btn-outline"
          type="button"
          :disabled="gerando !== null"
          @click="gerar(r)"
        >
          <Loader2 v-if="gerando === r.id" :size="15" class="spin" />
          <Download v-else :size="15" />
          {{ gerando === r.id ? 'Gerando...' : 'Gerar' }}
        </button>
      </div>
    </div>

    <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px;">
      <span style="font-size:15px;font-weight:600;color:#0F172A;">Tecnicos x equipamentos arrumados</span>
      <div v-if="carregandoTecnicos" style="font-size:13px;color:#64748B;">Carregando...</div>
      <table v-else class="table" style="width:100%;">
        <thead>
          <tr>
            <th>Tecnico</th>
            <th>Arrumados</th>
            <th>Ultima manutencao</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in tecnicos" :key="t.email">
            <td>{{ t.nome }}</td>
            <td>{{ t.total }}</td>
            <td>{{ t.ultima }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.relatorios-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.aviso {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  color: var(--text-secondary);
  font-size: 13px;
  border-left: 3px solid var(--brand-gold);
}

.aviso svg {
  flex-shrink: 0;
  color: var(--yellow);
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 16px;
}

.rel-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
}

.rel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.icon-chip {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: grid;
  place-items: center;
}

.icon-chip.tone-blue { background: var(--blue-soft); color: var(--blue); }
.icon-chip.tone-green { background: var(--green-soft); color: var(--green); }
.icon-chip.tone-yellow { background: var(--yellow-soft); color: var(--yellow); }
.icon-chip.tone-red { background: var(--red-soft); color: var(--red); }
.icon-chip.tone-purple { background: var(--purple-soft); color: var(--purple); }
.icon-chip.tone-slate { background: var(--slate-soft); color: var(--slate); }

.badge {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  color: var(--text-muted);
}

.rel-body h3 {
  font-size: 15px;
  margin: 0 0 6px;
}

.rel-body p {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  flex: 1;
}

.rel-body {
  flex: 1;
}

.rel-card .btn {
  align-self: flex-start;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
