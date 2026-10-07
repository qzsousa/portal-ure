<script setup lang="ts">
/**
 * Câmeras DVR — videovigilância das escolas, agrupada por unidade.
 *
 * Os dados vêm do serviço de monitoramento, que roda NA MÁQUINA DA REDE e faz
 * o ping de verdade: o navegador não envia ICMP, então quem sonda é a máquina.
 * A tela não calcula nada de rede — ela organiza o que o serviço já mediu.
 *
 * A leitura da tela responde, de cima para baixo: alguma câmera caiu? → em
 * qual escola? → há quanto tempo? O histórico por DVR existe para distinguir
 * "caiu agora" de "está oscilando há semanas", que são defeitos de rede e de
 * equipamento respectivamente.
 */
import { computed, onMounted, ref } from 'vue'
import {
  AlertTriangle,
  Camera,
  CircleDot,
  Loader2,
  RefreshCw,
  Search,
  Video,
  VideoOff,
} from '@lucide/vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import {
  forcarVarredura,
  obterMonitoramento,
  verificarHealthMonitor,
  type DvrHost,
  type DvrStatus,
  type DvrTipo,
  type EscolaResumo,
  type MonitorSnapshot,
} from '@/api/monitor'
import { AUTO_REFRESH_MS, useAutoRefresh } from '@/composables/useAutoRefresh'
import { apiError } from '@/utils/apiError'
import { useUiStore } from '@/stores/ui'

const PAGE_SIZE = 25

const ui = useUiStore()

const carregando = ref(true)
const erro = ref('')
const snap = ref<MonitorSnapshot | null>(null)
const page = ref(1)

const busca = ref('')
const filtroStatus = ref<'' | DvrStatus>('')
const filtroTipo = ref<'' | DvrTipo>('')
const filtroEscola = ref('')

/** Relógio local: os carimbos "offline há 12 min" envelheceriam sem isso. */
const agora = ref(Date.now())

/* ---------------- carga de dados ---------------- */

/**
 * `silencioso`: atualização automática.
 *
 * Mantém os dados anteriores se a recarga falhar — um túnel instável não pode
 * trocar um painel inteiro por "não foi possível carregar" a cada 30 s. A tela
 * avisa que o dado é velho em vez de apagar a informação.
 */
async function carregar(silencioso = false) {
  if (!silencioso) carregando.value = true
  try {
    snap.value = await obterMonitoramento()
    erro.value = ''
  } catch (e) {
    if (!silencioso) erro.value = apiError(e, 'Não foi possível falar com o serviço de monitoramento.')
  } finally {
    carregando.value = false
  }
}

async function varrerAgora() {
  try {
    await forcarVarredura()
    ui.info('Varredura solicitada. Os dados atualizam em instantes.')
  } catch (e) {
    // 429 é o esperado: o serviço recusa repetição para não inundar a rede de
    // ping. Não é falha — é o serviço se protegendo.
    const mensagem = apiError(e, '')
    if (/há pouco|15 s/i.test(mensagem)) ui.info('Varredura pedida há pouco — o ciclo automático já cobre.')
    else ui.error(mensagem || 'Não foi possível pedir uma nova varredura.')
    return
  }
  setTimeout(() => void carregar(true), 1500)
}

onMounted(() => {
  agora.value = Date.now()
  void carregar()
  // Health check público: distingue "o serviço caiu" de "o painel está velho".
  void verificarHealthMonitor().catch(() => {
    /* o banner vermelho já cobre a falha quando a carga principal falha */
  })
})

// Acompanha o ciclo do serviço (30 s). `agora` entra no mesmo tick para os
// carimbos não ficarem congelados entre uma leitura e outra.
useAutoRefresh(() => {
  agora.value = Date.now()
  void carregar(true)
}, AUTO_REFRESH_MS.monitor)

/* ---------------- apresentação ---------------- */

const ROTULO_STATUS: Record<DvrStatus, string> = {
  online: 'Ligada',
  offline: 'Desligada',
  desconhecido: 'Sem resposta',
}

function duracao(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return h % 60 === 0 ? `${h}h` : `${h}h${m % 60}`
  const d = Math.floor(h / 24)
  return d === 1 ? '1 dia' : `${d} dias`
}

/**
 * Quanto tempo a câmera está no estado atual.
 *
 * `onlineDesde`/`offlineDesde` podem ser `null` mesmo com estado definido —
 * acontece quando o serviço sobe e o primeiro resultado já vem "offline", sem
 * transição para contar. Sem o fallback, a subtração daria `NaN` na tela.
 */
function tempoNoEstado(h: DvrHost): string {
  if (h.status === 'online') {
    return h.onlineDesde ? `ligada há ${duracao(agora.value - h.onlineDesde)}` : 'ligada nesta leitura'
  }
  if (h.status === 'offline') {
    return h.offlineDesde ? `desligada há ${duracao(agora.value - h.offlineDesde)}` : 'sem resposta ainda'
  }
  return 'aguardando a 1ª varredura'
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') /* combining diacritics U+0300–U+036F */
}

/** "E.E. JARDIM WILMA FLOR" → "JARDIM WILMA FLOR": o prefixo ocupa espaço à toa. */
function nomeCurto(rotulo: string): string {
  return rotulo.replace(/^E\.E\.\s*/, '')
}

/* ---------------- KPIs e listas ---------------- */

const escolas = computed<EscolaResumo[]>(() => snap.value?.porFaixa ?? [])

const escolasComFalha = computed(() =>
  escolas.value.filter((e) => e.offline > 0).sort((a, b) => b.offline - a.offline),
)

/**
 * Comparações com `>` ficam em função, não no template.
 *
 * O `>` dentro de um atributo do template é lido pelo parser HTML como início
 * de tag e o `vue-tsc` acusa erro de sintaxe sem apontar a linha. Dentro do
 * `<script>` não há ambiguidade.
 */
function foraDoAr(e: EscolaResumo): boolean {
  return e.offline > 0
}

function percentual(e: EscolaResumo): number {
  return e.total > 0 ? Math.round((e.online / e.total) * 100) : 0
}

/**
 * Os DVRs de uma rede (ADM ou PED) daquela escola, para desenhar um quadradinho
 * por câmera no cartão da unidade.
 *
 * Ordena por `hostname` (VIDEO-DVR1, 2, 3) e não pelo `id` do snapshot: os ids
 * são numéricos e não seguem a ordem do manifesto, então ordenar por eles
 * misturaria as posições das câmeras entre uma atualização e outra.
 */
function dvrPorRede(e: EscolaResumo, tipo: DvrTipo): DvrHost[] {
  return (snap.value?.hosts ?? [])
    .filter((h) => h.faixa === e.id && h.tipo === tipo)
    .sort((a, b) => a.hostname.localeCompare(b.hostname))
}

const percentualRede = computed(() => snap.value?.percentualOnline ?? 0)
const latenciaMedia = computed(() => {
  const v = snap.value?.latenciaMediaMs
  return v === null || v === undefined ? '—' : `${String(v).replace('.', ',')} ms`
})

/**
 * Câmeras fora do ar da rede ADM — as que Usually caem primeiro, porque a rede
 * administrativa é a que concentra os roteadores e o enlace principal.
 */
const camerasForaDoArAdm = computed(() =>
  (snap.value?.hosts ?? [])
    .filter((h) => h.status === 'offline' && h.tipo === 'ADM')
    .sort((a, b) => (b.offlineDesde ?? 0) - (a.offlineDesde ?? 0)),
)

/* ---------------- filtros ---------------- */

const filtrados = computed(() => {
  const termo = normalizar(busca.value.trim())
  return (snap.value?.hosts ?? []).filter((h) => {
    if (filtroStatus.value && h.status !== filtroStatus.value) return false
    if (filtroTipo.value && h.tipo !== filtroTipo.value) return false
    if (filtroEscola.value && h.faixa !== filtroEscola.value) return false
    if (termo && !normalizar(`${h.escola} ${h.hostname} ${h.ip}`).includes(termo)) return false
    return true
  })
})

/**
 * Fora do ar primeiro, dentro de cada grupo por rede (ADM antes de PED) e, por
 * fim, por DVR — quem abre a tela procurando a câmera caída não deveria
 * precisar ordenar por coluna.
 */
const ordenados = computed(() =>
  [...filtrados.value].sort((a, b) => {
    const peso = (h: DvrHost) => (h.status === 'offline' ? 0 : h.status === 'desconhecido' ? 1 : 2)
    const d = peso(a) - peso(b)
    if (d !== 0) return d
    if (a.tipo !== b.tipo) return a.tipo === 'ADM' ? -1 : 1
    return a.hostname.localeCompare(b.hostname) || a.ip.localeCompare(b.ip)
  }),
)

const pagina = computed(() => ordenados.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
</script>

<template>
  <div class="dvrs-page">
    <!-- Escola com DVR fora do ar -->
    <div v-if="erro" class="banner-erro card">
      <AlertTriangle :size="18" />
      <div>
        <strong>Não foi possível consultar as câmeras</strong>
        <span>{{ erro }}</span>
        <small>
          O monitoramento depende de uma máquina rodando dentro da rede das escolas.
          Se o túnel ou a máquina estiverem fora do ar, esta tela não tem como funcionar.
        </small>
      </div>
    </div>

    <div v-else-if="escolasComFalha.length > 0" class="banner-alerta card">
      <VideoOff :size="18" />
      <div>
        <strong>{{ escolasComFalha.length }} unidades com DVR desligado</strong>
        <span>
          {{
            escolasComFalha
              .slice(0, 4)
              .map((e) => `${nomeCurto(e.rotulo)} (${e.offline})`)
              .join(' · ')
          }}
        </span>
        <small v-if="camerasForaDoArAdm.length > 0">
          {{ camerasForaDoArAdm.length }} na rede administrativa — confira o enlace antes de sair para a escola.
        </small>
      </div>
    </div>

    <!-- KPIs -->
    <div class="stats-grid">
      <StatCard label="Câmeras monitoradas" :value="carregando && !snap ? '…' : (snap?.total ?? 0)" tone="blue" :detail="`${escolas.length} unidades`">
        <Camera :size="22" />
      </StatCard>
      <StatCard label="Ligadas" :value="carregando && !snap ? '…' : (snap?.online ?? 0)" tone="green" :detail="`${percentualRede}% do parque`">
        <Video :size="22" />
      </StatCard>
      <StatCard
        label="Desligadas"
        :value="carregando && !snap ? '…' : (snap?.offline ?? 0)"
        tone="red"
        :detail="snap?.caidosAgora ? `${snap.caidosAgora} caíram agora` : 'sem queda recente'"
      >
        <VideoOff :size="22" />
      </StatCard>
      <StatCard label="Latência média" :value="latenciaMedia" tone="slate" :detail="`ciclo de ${snap?.intervaloSegundos ?? 30}s`">
        <CircleDot :size="22" />
      </StatCard>
    </div>

    <!-- Estado da varredura -->
    <div class="status-bar card">
      <div class="status-linha">
        <span v-if="snap?.emAndamento" class="badge azul">
          <Loader2 :size="13" class="spin" /> Verificando…
        </span>
        <span v-else-if="snap?.ultimaVarreduraEm" class="badge">
          Verificado {{ duracao(agora - snap.ultimaVarreduraEm) }} atrás
        </span>
        <span v-else class="badge">Aguardando a primeira verificação…</span>

        <span v-if="snap?.duracaoVarreduraMs !== null && snap?.duracaoVarreduraMs !== undefined" class="meta">
          {{ (snap.duracaoVarreduraMs / 1000).toFixed(1).replace('.', ',') }} s
        </span>
        <span v-if="snap?.concorrencia" class="meta">
          {{ snap.concorrencia }} verificações em paralelo
        </span>

        <button class="btn btn-outline btn-mini" type="button" @click="varrerAgora">
          <RefreshCw :size="15" /> Verificar agora
        </button>
      </div>
    </div>

    <!-- Visão por unidade -->
    <div class="card painel-escolas">
      <h3>Por unidade escolar</h3>
      <div class="escolas-grid">
        <div
          v-for="e in escolas"
          :key="e.id"
          class="escola-card"
          :class="{ falha: foraDoAr(e) }"
          @click="filtroEscola = filtroEscola === e.id ? '' : e.id"
        >
          <div class="escola-topo">
            <strong>{{ nomeCurto(e.rotulo) }}</strong>
            <span class="escola-fracao">{{ e.online }}/{{ e.total }}</span>
          </div>
          <div class="barra">
            <span :style="{ width: `${percentual(e)}%` }" />
          </div>
          <div class="escola-linhas">
            <div class="linha-rede">
              <span class="tag adm">ADM</span>
              <span class="barra-rede">
                <i
                  v-for="n in dvrPorRede(e, 'ADM')"
                  :key="`adm-${n.hostname}`"
                  :class="n.status"
                />
              </span>
              <span class="detalhe">{{ e.adm.online }}/{{ e.adm.online + e.adm.offline }}</span>
            </div>
            <div class="linha-rede">
              <span class="tag ped">PED</span>
              <span class="barra-rede">
                <i
                  v-for="n in dvrPorRede(e, 'PED')"
                  :key="`ped-${n.hostname}`"
                  :class="n.status"
                />
              </span>
              <span class="detalhe">{{ e.ped.online }}/{{ e.ped.online + e.ped.offline }}</span>
            </div>
          </div>
          <small v-if="e.offline > 0" class="faixa-falha">{{ e.offline }} desligada(s)</small>
          <small v-else-if="e.desconhecido > 0" class="faixa-espera">{{ e.desconhecido }} sem resposta</small>
          <small v-else class="faixa-ok">todas ligadas</small>
        </div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="filtro-bar card">
      <div class="campo-busca">
        <Search :size="16" />
        <input v-model="busca" class="input" type="search" placeholder="Buscar por escola, DVR ou IP…" />
      </div>

      <label>Rede:</label>
      <select v-model="filtroTipo" class="select-input slim">
        <option value="">Todas</option>
        <option value="ADM">Administrativa (ADM)</option>
        <option value="PED">Pedagógica (PED)</option>
      </select>

      <label>Status:</label>
      <select v-model="filtroStatus" class="select-input slim">
        <option value="">Todos</option>
        <option value="online">Ligadas</option>
        <option value="offline">Desligadas</option>
        <option value="desconhecido">Sem resposta</option>
      </select>

      <label>Unidade:</label>
      <select v-model="filtroEscola" class="select-input slim largo">
        <option value="">Todas</option>
        <option v-for="e in escolas" :key="e.id" :value="e.id">{{ e.rotulo }}</option>
      </select>

      <span class="meta">{{ filtrados.length }} de {{ snap?.total ?? 0 }}</span>
    </div>

    <!-- Lista detalhada -->
    <div class="card table-card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Escola</th>
              <th>DVR</th>
              <th>Rede</th>
              <th>IP</th>
              <th>Situação</th>
              <th>Respondeu</th>
              <th>Latência</th>
              <th>Histórico</th>
              <th>Tempo no estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="carregando">
              <td colspan="9" class="td-centro">Verificando as câmeras…</td>
            </tr>
            <tr v-else-if="pagina.length === 0">
              <td colspan="9" class="td-centro">Nenhuma câmera com esses filtros.</td>
            </tr>
            <tr v-for="h in pagina" :key="h.ip" :class="{ 'linha-off': h.status === 'offline' }">
              <td>{{ nomeCurto(h.escola) }}</td>
              <td class="nowrap"><code class="dvr">{{ h.hostname }}</code></td>
              <td>
                <span class="tag" :class="h.tipo.toLowerCase()">{{ h.tipo }}</span>
              </td>
              <td class="nowrap"><code class="ip">{{ h.ip }}</code></td>
              <td><StatusPill :status="ROTULO_STATUS[h.status]" /></td>
              <td class="dim">{{ h.metodo || '—' }}</td>
              <td class="nowrap">{{ h.latenciaMs !== null ? `${h.latenciaMs} ms` : '—' }}</td>
              <td>
                <!-- Uma barra por verificação: verde respondeu, vermelho não -->
                <span class="spark">
                  <i v-for="(c, i) in h.historico" :key="i" :class="c === '1' ? 'on' : 'off'" />
                </span>
              </td>
              <td class="nowrap dim">
                {{ tempoNoEstado(h) }}
                <span v-if="h.alternancias > 2" class="oscila">instável</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <PaginationBar :page="page" :page-size="PAGE_SIZE" :total="ordenados.length" @change="(p) => (page = p)" />
    </div>
  </div>
</template>

<style scoped>
.dvrs-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---- banners ---- */
.banner-erro {
  display: flex;
  gap: 12px;
  padding: 14px 18px;
  border-color: var(--red);
  background: var(--red-soft);
  color: var(--red);
}
.banner-erro strong { display: block; font-size: 13.5px; }
.banner-erro span { display: block; font-size: 13px; color: var(--text-primary); margin-top: 2px; }
.banner-erro small { display: block; font-size: 12px; color: var(--text-secondary); margin-top: 6px; }

.banner-alerta {
  display: flex;
  gap: 12px;
  padding: 14px 18px;
  border-color: color-mix(in srgb, var(--red) 40%, var(--border));
  background: color-mix(in srgb, var(--red) 7%, var(--surface));
  color: var(--red);
}
.banner-alerta strong { display: block; font-size: 13.5px; }
.banner-alerta span { display: block; font-size: 12.5px; color: var(--text-secondary); margin-top: 2px; }

/* ---- KPIs ---- */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  gap: 14px;
}

/* ---- barra de status ---- */
.status-bar { padding: 12px 16px; }
.status-linha {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: 999px;
  background: var(--slate-soft);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}
.badge.azul { background: var(--blue-soft); color: var(--blue); }
.meta { font-size: 12px; color: var(--text-muted); }
.btn-mini { padding: 6px 12px; font-size: 12.5px; margin-left: auto; }

/* ---- painel por unidade ---- */
.painel-escolas { padding: 16px; }
.painel-escolas h3 { font-size: 14px; margin-bottom: 12px; }
.escolas-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 210px), 1fr));
  gap: 10px;
}
.escola-card {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}
.escola-card:hover {
  border-color: var(--border-strong);
  background: var(--surface-muted);
}
.escola-card.falha {
  border-color: color-mix(in srgb, var(--red) 35%, var(--border));
  background: color-mix(in srgb, var(--red) 4%, var(--surface));
}
.escola-topo {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 7px;
}
.escola-topo strong {
  font-size: 12.5px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.escola-fracao { font-size: 12px; font-weight: 700; color: var(--text-secondary); flex-shrink: 0; }
.barra { height: 5px; border-radius: 999px; background: var(--red-soft); overflow: hidden; }
.barra span { display: block; height: 100%; background: var(--green); }
.escola-linhas { margin-top: 8px; display: flex; flex-direction: column; gap: 3px; }
.linha-rede { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-muted); }
.detalhe { margin-left: auto; font-variant-numeric: tabular-nums; }
/* um quadradinho por DVR: a rede da escola inteira num olhar */
.barra-rede { display: inline-flex; gap: 3px; }
.barra-rede i { width: 9px; height: 9px; border-radius: 2px; }
.barra-rede i.online { background: var(--green); }
.barra-rede i.offline { background: var(--red); }
.barra-rede i.desconhecido { background: var(--slate-soft); }
.faixa-falha { display: block; margin-top: 6px; font-size: 11px; font-weight: 700; color: var(--red); }
.faixa-espera { display: block; margin-top: 6px; font-size: 11px; color: var(--text-muted); }
.faixa-ok { display: block; margin-top: 6px; font-size: 11px; color: var(--green); }

/* ---- filtros ---- */
.filtro-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  flex-wrap: wrap;
}
.filtro-bar label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.campo-busca { position: relative; flex: 1 1 240px; min-width: 190px; }
.campo-busca svg {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}
.campo-busca .input { padding-left: 34px; }
.select-input.slim { width: auto; min-width: 130px; }
.select-input.largo { min-width: 210px; }

/* ---- tabela ---- */
.dvr { font-size: 11.5px; color: var(--text-secondary); font-weight: 600; }
.ip { color: var(--text-primary); font-weight: 600; }
.linha-off { background: color-mix(in srgb, var(--red) 4%, transparent); }
.dim { color: var(--text-muted); font-size: 12.5px; }
.nowrap { white-space: nowrap; }
.td-centro { text-align: center; color: var(--text-muted); padding: 28px !important; }
.oscila {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--yellow-soft);
  color: var(--yellow);
  font-size: 10.5px;
  font-weight: 700;
}

/* ---- tag de rede ADM/PED ---- */
.tag {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.tag.adm { background: var(--blue-soft); color: var(--blue); }
.tag.ped { background: var(--purple-soft); color: var(--purple); }

/* ---- histórico por DVR ---- */
.spark { display: inline-flex; gap: 2px; align-items: center; }
.spark i { width: 5px; height: 15px; border-radius: 2px; }
.spark i.on { background: var(--green); }
.spark i.off { background: var(--red); opacity: 0.5; }

@media (max-width: 640px) {
  .btn-mini { margin-left: 0; }
  .spark i { width: 4px; height: 12px; }
}
</style>