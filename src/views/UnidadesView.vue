<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { AlertTriangle, Download, Package, PackageX, School, Search } from '@lucide/vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import { listarPainelUnidades, ROTULO_INVENTARIO, type UnidadePainel } from '@/api/escolas'
import { listarUnidadesResumo, type UnidadeResumo } from '@/api/sce'
import { casarNomeEscola } from '@/utils/escola'

const PAGE_SIZE = 10

interface UnidadeLinha extends UnidadePainel {
  equip: { total: number; disponiveis: number; manutencao: number; quebrados: number; extraviados: number }
}

const estado = reactive({
  loading: true,
  erro: '',
  items: [] as UnidadeLinha[],
  page: 1,
})

const busca = ref('')
const filtroEquip = ref<'' | 'com' | 'sem'>('')
const filtroTecnico = ref('')
const filtroInventario = ref('')

/**
 * Mescla o resumo do SCE (nomes legados das unidades) com o catálogo oficial:
 * a contagem de equipamentos é do GRUPO — escolas irmãs dividem o mesmo painel.
 */
function mesclarEquipamentos(unidades: UnidadePainel[], resumo: UnidadeResumo[]): UnidadeLinha[] {
  const porNome = new Map<string, UnidadePainel[]>()
  for (const u of unidades) {
    for (const chave of [u.nome, u.grupo]) {
      const arr = porNome.get(chave) || []
      arr.push(u)
      porNome.set(chave, arr)
    }
  }

  // equipamentos atribuídos a cada unidade individual (nome = chave do catálogo casada)
  const totais = new Map<string, UnidadeLinha['equip']>()
  const zero = () => ({ total: 0, disponiveis: 0, manutencao: 0, quebrados: 0, extraviados: 0 })
  for (const r of resumo) {
    const casado = casarNomeEscola(r.nome, [...porNome.keys()])
    const alvos = casado ? porNome.get(casado) : undefined
    if (!alvos) continue
    for (const u of alvos) {
      const t = totais.get(u.nome) || zero()
      t.total += r.total
      t.disponiveis += r.disponiveis
      t.manutencao += r.manutencao
      t.quebrados += r.quebrados
      t.extraviados += r.extraviados
      totais.set(u.nome, t)
    }
  }

  return unidades.map((u) => ({ ...u, equip: totais.get(u.nome) || zero() }))
}

/** Normaliza para busca sem distinção de maiúsculas/acentos. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') /* combining diacritics U+0300–U+036F */
}

const tecnicosOpcoes = computed(() =>
  [...new Set(estado.items.map((u) => u.tecnico).filter(Boolean))].sort(),
)

const filtradas = computed(() => {
  const b = norm(busca.value.trim())
  return estado.items.filter((u) => {
    if (b && !norm(`${u.nome} ${u.grupo} ${u.irma || ''}`).includes(b)) return false
    if (filtroEquip.value === 'com' && u.equip.total === 0) return false
    if (filtroEquip.value === 'sem' && u.equip.total > 0) return false
    if (filtroTecnico.value && u.tecnico !== filtroTecnico.value) return false
    if (filtroInventario.value && u.inventarioStatus !== filtroInventario.value) return false
    return true
  })
})

const paginaAtual = computed(() => {
  const ini = (estado.page - 1) * PAGE_SIZE
  return filtradas.value.slice(ini, ini + PAGE_SIZE)
})

const totais = computed(() => ({
  unidades: estado.items.length,
  comEquip: estado.items.filter((u) => u.equip.total > 0).length,
  equipamentos: estado.items.reduce((acc, u) => acc + u.equip.total, 0),
  chamadosAbertos: estado.items.reduce((acc, u) => acc + u.chamadosAbertos, 0),
}))

watch([busca, filtroEquip, filtroTecnico, filtroInventario], () => {
  estado.page = 1
})

function fmt(v: number): string | number {
  if (estado.erro) return '—'
  return v
}

/** Código sequencial (001...) em relação à lista filtrada completa. */
function codigo(idxLocal: number): string {
  return String((estado.page - 1) * PAGE_SIZE + idxLocal + 1).padStart(3, '0')
}

function rotuloInventario(status: string): string {
  return ROTULO_INVENTARIO[status] || status
}

/** Exporta o recorte filtrado em CSV (separador ";" — abre direto no Excel pt-BR). */
function exportarCsv() {
  const cabecalho = [
    'Unidade Escolar', 'Grupo oficial', 'Escola irmã', 'Técnico', 'Inventário',
    'Cadastrou equipamentos', 'Total equip.', 'Disponíveis', 'Manutenção', 'Quebrados', 'Extraviados',
    'Usuários ativos', 'Chamados (total)', 'Chamados abertos',
  ]
  const linhas = filtradas.value.map((u) => [
    u.nome, u.grupo, u.irma || '', u.tecnico, rotuloInventario(u.inventarioStatus),
    u.equip.total > 0 ? 'Sim' : 'Não',
    u.equip.total, u.equip.disponiveis, u.equip.manutencao, u.equip.quebrados, u.equip.extraviados,
    u.usuariosAtivos, u.chamadosTotal, u.chamadosAbertos,
  ])
  const csv = [cabecalho, ...linhas]
    .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `unidades-escolares-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function carregar() {
  estado.loading = true
  estado.erro = ''
  try {
    const [painel, resumo] = await Promise.all([
      listarPainelUnidades(),
      listarUnidadesResumo().catch(() => [] as UnidadeResumo[]),
    ])
    estado.items = mesclarEquipamentos(painel, resumo)
  } catch {
    estado.items = []
    estado.erro =
      'Não foi possível carregar as unidades escolares. O serviço pode estar indisponível no momento — tente novamente mais tarde.'
  } finally {
    estado.loading = false
  }
}

onMounted(() => {
  void carregar()
})
</script>

<template>
  <div class="unidades-page">
    <!-- KPIs -->
    <div class="stats-grid">
      <StatCard label="Total de unidades" :value="estado.loading ? '…' : fmt(totais.unidades)" tone="blue">
        <School :size="22" />
      </StatCard>
      <StatCard
        label="Com equipamentos"
        :value="estado.loading ? '…' : `${fmt(totais.comEquip)} de ${fmt(totais.unidades)}`"
        tone="green"
      >
        <Package :size="22" />
      </StatCard>
      <StatCard label="Sem equipamentos" :value="estado.loading ? '…' : fmt(totais.unidades - totais.comEquip)" tone="yellow">
        <PackageX :size="22" />
      </StatCard>
      <StatCard label="Chamados abertos" :value="estado.loading ? '…' : fmt(totais.chamadosAbertos)" tone="red">
        <AlertTriangle :size="22" />
      </StatCard>
    </div>

    <!-- Busca + filtros -->
    <div class="toolbar card">
      <div class="search-box">
        <Search :size="16" />
        <input v-model="busca" placeholder="Buscar unidade escolar..." />
      </div>
      <select v-model="filtroEquip" class="select-input filtro">
        <option value="">Equipamentos: todos</option>
        <option value="com">Com equipamentos</option>
        <option value="sem">Sem equipamentos</option>
      </select>
      <select v-model="filtroTecnico" class="select-input filtro">
        <option value="">Técnico: todos</option>
        <option v-for="t in tecnicosOpcoes" :key="t" :value="t">{{ t }}</option>
      </select>
      <select v-model="filtroInventario" class="select-input filtro">
        <option value="">Inventário: todos</option>
        <option v-for="(rotulo, valor) in ROTULO_INVENTARIO" :key="valor" :value="valor">{{ rotulo }}</option>
      </select>
      <button class="btn btn-outline" type="button" :disabled="estado.loading || filtradas.length === 0" @click="exportarCsv">
        <Download :size="15" /> Exportar CSV
      </button>
    </div>

    <p v-if="estado.erro" class="erro card">{{ estado.erro }}</p>

    <!-- Tabela -->
    <div class="card table-card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Unidade Escolar</th>
              <th>Técnico</th>
              <th>Inventário</th>
              <th>Cadastrou equip.?</th>
              <th class="th-num">Total Equip.</th>
              <th class="th-num">Disponíveis</th>
              <th class="th-num">Manutenção</th>
              <th class="th-num">Quebrados</th>
              <th class="th-num">Extraviados</th>
              <th class="th-num">Chamados</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="estado.loading">
              <td colspan="11" class="td-center">Carregando...</td>
            </tr>
            <tr v-else-if="paginaAtual.length === 0">
              <td colspan="11" class="td-center">
                {{ estado.erro ? 'Sem dados para exibir.' : 'Nenhuma unidade encontrada.' }}
              </td>
            </tr>
            <tr v-for="(u, i) in paginaAtual" :key="u.nome">
              <td class="nowrap"><strong>{{ codigo(i) }}</strong></td>
              <td>
                {{ u.nome }}
                <div v-if="u.irma" class="unidade-irma">divide o prédio com {{ u.irma }}</div>
              </td>
              <td>{{ u.tecnico || '—' }}</td>
              <td><StatusPill :status="rotuloInventario(u.inventarioStatus)" /></td>
              <td>
                <StatusPill :status="u.equip.total > 0 ? 'Sim' : 'Não'" />
              </td>
              <td class="td-num"><strong>{{ u.equip.total }}</strong></td>
              <td class="td-num"><span class="num green">{{ u.equip.disponiveis }}</span></td>
              <td class="td-num"><span class="num yellow">{{ u.equip.manutencao }}</span></td>
              <td class="td-num"><span class="num red">{{ u.equip.quebrados }}</span></td>
              <td class="td-num"><span class="num slate">{{ u.equip.extraviados }}</span></td>
              <td class="td-num">
                <span class="num blue">{{ u.chamadosAbertos }}</span>
                <span class="chamados-total"> / {{ u.chamadosTotal }}</span>
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
  </div>
</template>

<style scoped>
.unidades-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr));
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

.filtro {
  max-width: 200px;
}

.table-card {
  overflow: visible;
}

.nowrap {
  white-space: nowrap;
}

.td-center {
  text-align: center;
  color: var(--text-muted);
  padding: 28px !important;
}

.th-num,
.td-num {
  text-align: right;
  white-space: nowrap;
}

.num {
  font-weight: 700;
}

.num.green {
  color: var(--green);
}

.num.yellow {
  color: var(--yellow);
}

.num.red {
  color: var(--red);
}

.num.slate {
  color: var(--slate);
}

.num.blue {
  color: var(--blue);
}

.unidade-irma {
  font-size: 11.5px;
  color: var(--text-muted);
}

.chamados-total {
  font-size: 11.5px;
  color: var(--text-muted);
}

.erro {
  padding: 14px 18px;
  color: var(--red);
  font-weight: 500;
}
</style>
