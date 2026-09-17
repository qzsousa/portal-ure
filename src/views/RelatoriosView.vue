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
import { apiError } from '@/utils/apiError'
import { formatDate } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { Chamado, StatusChamado } from '@/types'

const auth = useAuthStore()
const ui = useUiStore()

const gerando = ref<string | null>(null)

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

function csvDeChamados(chamados: Chamado[]): string {
  return montarCsv(
    ['protocolo', 'data', 'unidade', 'tipo', 'descricao', 'urgencia', 'status', 'responsavel'],
    chamados.map((c) => [
      c.protocolo,
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

async function gerarChamadosAbertos() {
  const chamados = await listarTodosChamados(['ABERTO', 'ANDAMENTO'])
  baixarCsv(`chamados-abertos-atendimento-${Date.now()}.csv`, csvDeChamados(chamados))
}

async function gerarChamadosConcluidos() {
  const chamados = await listarTodosChamados(['RESOLVIDO'])
  baixarCsv(`chamados-concluidos-${Date.now()}.csv`, csvDeChamados(chamados))
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
    titulo: 'Chamados Abertos e em Atendimento',
    descricao: 'Listagem de todos os chamados com status "Aberto" ou "Em atendimento".',
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
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
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
