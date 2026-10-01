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
  naoAtribuidos: [] as NaoAtribuido[],
  page: 1,
})

const totalNaoAtribuido = computed(() =>
  estado.naoAtribuidos.reduce((acc, n) => acc + n.total, 0),
)

const busca = ref('')
const filtroEquip = ref<'' | 'com' | 'sem'>('')
const filtroTecnico = ref('')
const filtroInventario = ref('')

/**
 * Mescla o resumo do SCE (nomes legados das unidades) com o catálogo oficial.
 *
 * Cada linha é um PRÉDIO: quando o SCE cadastra o equipamento no nome do grupo
 * ("E.E. A / B") ou no nome de qualquer das duas escolas, ele cai na mesma
 * linha. Como o catálogo já devolve só a mãe, cada equipamento é contado uma
 * única vez.
 *
 * DEFESA: o que NÃO casa com o catálogo NÃO é mais descartado em silêncio.
 * Antes um `continue` sumia com o equipamento e a escola aparecia como "Sem
 * equipamentos" sem nenhuma pista do motivo — foi assim que "E.E. ISAAC
 * SCHRAIBER" (239 equipamentos) sumiu quando o catálogo ficou com a grafia
 * "E.E. ISAAC SCHIRAIBER". Agora volta como `naoAtribuidos` e a tela avisa.
 */
interface NaoAtribuido {
  nome: string
  total: number
}

function mesclarEquipamentos(
  unidades: UnidadePainel[],
  resumo: UnidadeResumo[],
): { linhas: UnidadeLinha[]; naoAtribuidos: NaoAtribuido[] } {
  const porNome = new Map<string, UnidadePainel[]>()
  for (const u of unidades) {
    // `new Set` é obrigatório: escola que NÃO divide prédio tem `nome === grupo`,
    // e sem isso a mesma linha entrava duas vezes no mesmo chave — o `for` lá de
    // baixo somava o equipamento duas vezes. Só as escolas com irmã escapavam,
    // porque nelas `nome !== grupo`. Efeito medido: a soma da tela dava 8459
    // contra 5090 do SCE (+66%), e "E.E. HAYDEÉ HIDALGO" aparecia com 122 em vez
    // de 61. A contagem de LINHAS com equipamento não era afetada — por isso
    // passava despercebido.
    for (const chave of new Set([u.nome, u.grupo])) {
      const arr = porNome.get(chave) || []
      arr.push(u)
      porNome.set(chave, arr)
    }
  }

  // equipamentos atribuídos a cada unidade individual (nome = chave do catálogo casada)
  const totais = new Map<string, UnidadeLinha['equip']>()
  const naoAtribuidos: NaoAtribuido[] = []
  const zero = () => ({ total: 0, disponiveis: 0, manutencao: 0, quebrados: 0, extraviados: 0 })
  for (const r of resumo) {
    const casado = casarNomeEscola(r.nome, [...porNome.keys()])
    const alvos = casado ? porNome.get(casado) : undefined
    if (!alvos) {
      naoAtribuidos.push({ nome: r.nome, total: r.total })
      continue
    }
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

  const linhas = unidades.map((u) => ({ ...u, equip: totais.get(u.nome) || zero() }))
  naoAtribuidos.sort((a, b) => b.total - a.total)
  return { linhas, naoAtribuidos }
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
    const { linhas, naoAtribuidos } = mesclarEquipamentos(painel, resumo)
    estado.items = linhas
    estado.naoAtribuidos = naoAtribuidos
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

    <!--
      DEFESA: equipamento que existe no SCE mas não casa com nenhuma linha do
      catálogo. Não some em silêncio — a Matriz precisa saber o nome para
      corrigir o cadastro, senão a escola aparece como "Sem equipamentos".
    -->
    <div v-if="totalNaoAtribuido > 0" class="aviso card">
      <strong>
        {{ totalNaoAtribuido }} equipamento(s) não foram atribuídos a nenhuma unidade
      </strong>
      <p>
        O nome da unidade no SCE não corresponde a nenhuma escola do catálogo. As
        unidades abaixo aparecem como “Sem equipamentos” mesmo tendo parque
        cadastrado. Cadastre/ corrija o nome da unidade no SCE:
      </p>
      <ul>
        <li v-for="n in estado.naoAtribuidos" :key="n.nome">
          <strong>{{ n.total }}</strong> eq — “{{ n.nome }}”
        </li>
      </ul>
    </div>

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

.aviso {
  padding: 14px 18px;
  border-left: 4px solid var(--yellow);
  background: #fffbeb;
}

.aviso strong {
  color: #92400e;
}

.aviso p {
  margin: 6px 0;
  color: #78350f;
  font-size: 13.5px;
}

.aviso ul {
  margin: 8px 0 0;
  padding-left: 20px;
  color: #78350f;
  font-size: 13px;
}
</style>
