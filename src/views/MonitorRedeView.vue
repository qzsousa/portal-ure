<script setup lang="ts">
/**
 * Monitoramento de rede — online/offline dos endereços da rede privada.
 *
 * Os dados vêm do serviço de monitoramento (que roda NA MÁQUINA DA REDE e faz
 * o ping de verdade — o navegador não envia ICMP). A tela apenas consome a
 * API: nada de iframe, nada de ping no front.
 *
 * Reading this screen: os números do topo são a verdade sobre a rede agora; a
 * tabela é a lista detalhada, filtrável, com o histórico das últimas checagens
 * para dar contexto a quem caiu (caiu há 2 min ou está oscilando há meia hora
 * muda completamente o diagnóstico).
 */
import { computed, onMounted, ref } from 'vue'
import { Activity, AlertTriangle, Loader2, RefreshCw, Search, Wifi, WifiOff } from '@lucide/vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import {
  forcarVarredura,
  obterMonitoramento,
  verificarHealthMonitor,
  type MonitorHost,
  type MonitorSnapshot,
  type MonitorStatus,
} from '@/api/monitor'
import { AUTO_REFRESH_MS, useAutoRefresh } from '@/composables/useAutoRefresh'
import { useUiStore } from '@/stores/ui'
import { apiError } from '@/utils/apiError'

const PAGE_SIZE = 25

const ui = useUiStore()

const carregando = ref(true)
const erro = ref('')
const snap = ref<MonitorSnapshot | null>(null)
const page = ref(1)

const busca = ref('')
const filtroStatus = ref<'' | MonitorStatus>('')
const filtroFaixa = ref('')

/** Relógio local: a tela é de "tempo real" e um carimbo estático envelheheria. */
const agora = ref(Date.now())
/** Último instante em que a tela conseguiu falar com o serviço. */
const ultimaLeituraOk = ref<number | null>(null)

/* ---------------- carga ---------------- */

/**
 * `silencioso`: atualização automática.
 *
 * Mantém os dados anteriores se a recarga falhar — um túnel instável não pode
 * trocar um painel inteiro por "não foi possível carregar" a cada 30 s. A tela
 * passa a avisar "dados de X atrás" em vez de apagar a informação.
 */
async function carregar(silencioso = false) {
  if (!silencioso) carregando.value = true
  try {
    const dados = await obterMonitoramento()
    snap.value = dados
    ultimaLeituraOk.value = Date.now()
    erro.value = ''
  } catch (e) {
    if (!silencioso) erro.value = apiError(e, 'Não foi possível falar com o serviço de monitoramento.')
  } finally {
    carregando.value = false
  }
}

async function recarregarAgora() {
  try {
    await forcarVarredura()
    ui.info('Varredura solicitada. Os dados atualizam em instantes.')
  } catch (e) {
    // 429 é o caso esperado: o serviço recusa varredura repetida para não
    // inundar a rede de ping. Não é falha — é o serviço protegendo a rede.
    const mensagem = apiError(e, '')
    if (/15 s|pouco/i.test(mensagem)) {
      ui.info('Varredura solicitada há pouco — o ciclo automático já está cuidando.')
    } else {
      ui.error(mensagem || 'Não foi possível pedir uma nova varredura.')
    }
    return
  }
  setTimeout(() => void carregar(true), 1200)
}

onMounted(() => {
  agora.value = Date.now()
  void carregar()
  /*
   * O health check é o que separa "a tela está com dado velho" de "a tela está
   * mentindo". Sem ele, uma falha de rede apareceria como painel normal com
   * números parados — o pior tipo de defeito num painel de operação.
   */
  void verificarHealthMonitor().catch(() => {
    /* o erro já aparece no bloco vermelho quando a carga falha */
  })
})

/*
 * O serviço varre sozinho a cada 30 s por padrão; a tela acompanha no mesmo
 * intervalo. Não adianta consultar antes disso: seria a MESMA resposta, e cada
 * consulta extra é tráfego pelo túnel sem informação nova.
 *
 * O `agora` é atualizado no mesmo tick para que os carimbos "há 12 min" não
 * fiquem congelados entre uma leitura e outra.
 */
useAutoRefresh(() => {
  agora.value = Date.now()
  void carregar(true)
}, AUTO_REFRESH_MS.monitor)

/* ---------------- apresentação ---------------- */

const ROTULO_STATUS: Record<MonitorStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  desconhecido: 'Aguardando',
}

function duracao(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h${m % 60 ? ` ${m % 60} min` : ''}`
  const d = Math.floor(h / 24)
  return `${d} dia${d > 1 ? 's' : ''}`
}

function haQuantoTempo(epoch: number | null): string {
  if (!epoch) return '—'
  return duracao(agora.value - epoch)
}

/**
 * "offline há 12 min" / "online há 3 h", a partir de quando mudou de estado.
 *
 * DEFESA: `onlineDesde`/`offlineDesde` podem ser `null` mesmo com estado
 * definido — acontece logo na subida do serviço, quando o primeiro resultado já
 * é "offline" e não houve transição para contar. Sem o fallback, a subtração
 * daria `NaN` e a tela mostraria "NaN min".
 */
function tempoNoEstado(h: MonitorHost): string {
  if (h.status === 'online') {
    return h.onlineDesde ? `online há ${duracao(agora.value - h.onlineDesde)}` : 'online nesta leitura'
  }
  if (h.status === 'offline') {
    return h.offlineDesde ? `offline há ${duracao(agora.value - h.offlineDesde)}` : 'sem resposta ainda'
  }
  return 'sem resposta ainda'
}

const percentOnline = computed(() => snap.value?.percentualOnline ?? 0)
const totalRespondidos = computed(() => (snap.value ? snap.value.online + snap.value.offline : 0))

const faixas = computed(() => snap.value?.porFaixa ?? [])

/**
 * Comparações que involucram `>` ficam em função, e não no template.
 *
 * O `>` dentro de um atributo do template é lido pelo parser HTML como
 * início de tag: `:class="{ tem-offline: f.offline > 0 }"` faz o
 * compilador interromper o atributo no `>` e o `vue-tsc` acusar erro de
 * sintaxe — com mensagem que não aponta nem para o arquivo nem para a linha
 * certa. Dentro de uma função no `<script>` não há ambiguidade nenhuma.
 */
function foraDoAr(f: { offline: number }): boolean {
  return f.offline > 0
}

function percentualDoGrupo(f: { online: number; total: number }): number {
  return f.total > 0 ? (f.online / f.total) * 100 : 0
}

const temGrupos = computed(() => faixas.value.length > 0)

/* ---------------- filtros ---------------- */

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') /* combining diacritics U+0300–U+036F */
}

const filtrados = computed(() => {
  const lista = snap.value?.hosts ?? []
  const termo = normalizar(busca.value.trim())

  return lista.filter((h) => {
    if (filtroStatus.value && h.status !== filtroStatus.value) return false
    if (filtroFaixa.value && h.faixa !== filtroFaixa.value) return false
    if (termo && !normalizar(`${h.ip} ${h.rotulo}`).includes(termo)) return false
    return true
  })
})

/**
 * Offline primeiro, depois desconhecido, depois online — quem abre a tela
 * procurando o que caiu não deveria precisar ordenar por coluna para achar.
 */
const ordenados = computed(() =>
  [...filtrados.value].sort((a, b) => {
    const peso = (h: MonitorHost) => (h.status === 'offline' ? 0 : h.status === 'desconhecido' ? 1 : 2)
    const d = peso(a) - peso(b)
    if (d !== 0) return d
    // Dentro do mesmo grupo, quem está fora do ar há mais tempo sobe.
    if (a.status !== b.status) return (a.offlineDesde ?? 0) < (b.offlineDesde ?? 0) ? -1 : 1
    return normalizar(a.ip).localeCompare(normalizar(b.ip))
  }),
)

const pagina = computed(() => ordenados.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))

/** Endereços que caíram na última varredura — o que a tela destaca. */
const caidosRecentemente = computed(() =>
  (snap.value?.hosts ?? [])
    .filter((h) => h.status === 'offline' && h.offlineDesde)
    .sort((a, b) => (a.offlineDesde ?? 0) - (b.offlineDesde ?? 0))
    .slice(0, 6),
)

const temQuedas = computed(() => caidosRecentemente.value.length > 0)
</script>

<template>
  <div class="rede-page">
    <!-- Estado do serviço: separa "caiu o serviço" de "meu login expirou". -->
    <div v-if="erro" class="erro card">
      <AlertTriangle :size="18" />
      <div>
        <strong>Serviço de monitoramento indisponível</strong>
        <span>{{ erro }}</span>
        <small>
          A aba depende de uma máquina dentro da rede rodando o serviço de ping.
          Se o túnel ou a máquina estiverem fora, esta tela não tem como funcionar.
        </small>
      </div>
    </div>

    <!-- KPIs -->
    <div class="stats-grid">
      <StatCard
        label="Endereços monitorados"
        :value="carregando && !snap ? '…' : (snap?.total ?? 0)"
        tone="blue"
      >
        <Activity :size="22" />
      </StatCard>
      <StatCard label="Online" :value="carregando && !snap ? '…' : (snap?.online ?? 0)" tone="green" :detail="`${percentOnline}% da rede`">
        <Wifi :size="22" />
      </StatCard>
      <StatCard
        label="Offline"
        :value="carregando && !snap ? '…' : (snap?.offline ?? 0)"
        tone="red"
        :detail="snap?.caidosAgora ? `${snap.caidosAgora} caíram agora` : 'nenhuma queda recente'"
      >
        <WifiOff :size="22" />
      </StatCard>
      <StatCard
        label="Latência média"
        :value="snap?.latenciaMediaMs !== null && snap?.latenciaMediaMs !== undefined ? `${snap.latenciaMediaMs} ms` : '—'"
        tone="slate"
        :detail="snap?.latenciaMaximaMs !== null && snap?.latenciaMaximaMs !== undefined ? `máx ${snap.latenciaMaximaMs} ms` : ''"
      >
        <Activity :size="22" />
      </StatCard>
    </div>

    <!-- Barra de status da varredura -->
    <div class="status-bar card">
      <div class="status-linha">
        <span v-if="snap?.emAndamento" class="badge em-andamento">
          <Loader2 :size="13" class="spin" /> Varrendo a rede…
        </span>
        <span v-else-if="snap?.ultimaVarreduraEm" class="badge">
          Varredura {{ haQuantoTempo(snap.ultimaVarreduraEm) }} atrás
        </span>
        <span v-else class="badge">Aguardando a primeira varredura…</span>

        <span v-if="snap?.duracaoVarreduraMs !== null && snap?.duracaoVarreduraMs !== undefined" class="meta">
          levou {{ (snap.duracaoVarreduraMs / 1000).toFixed(1).replace('.', ',') }} s
        </span>
        <span v-if="snap?.concorrencia" class="meta">
          {{ snap.concorrencia }} pings em paralelo · ciclo de {{ snap.intervaloSegundos }} s
        </span>

        <button class="btn btn-outline btn-mini" type="button" @click="recarregarAgora">
          <RefreshCw :size="15" /> Varrer agora
        </button>
      </div>

      <p v-if="snap && totalRespondidos < snap.total" class="aviso-agora">
        {{ snap.desconhecido }} endereço(s) ainda sem resposta — a primeira varredura ainda não os alcançou.
      </p>
    </div>

    <!-- Filtros -->
    <div class="filtro-bar card">
      <div class="campo-busca">
        <Search :size="16" />
        <input v-model="busca" class="input" type="search" placeholder="Buscar por IP ou grupo…" />
      </div>

      <label>Status:</label>
      <select v-model="filtroStatus" class="select-input slim">
        <option value="">Todos</option>
        <option value="online">Online</option>
        <option value="offline">Offline</option>
        <option value="desconhecido">Aguardando</option>
      </select>

      <label>Grupo:</label>
      <select v-model="filtroFaixa" class="select-input slim">
        <option value="">Todos</option>
        <option v-for="f in faixas" :key="f.id" :value="f.id">
          {{ f.rotulo }} ({{ f.offline }} fora)
        </option>
      </select>

      <span class="meta">{{ filtrados.length }} de {{ snap?.total ?? 0 }}</span>
    </div>

    <!-- Resumo por grupo: onde a rede está pior -->
    <div v-if="temGrupos" class="faixas-grid">
      <div v-for="f in faixas" :key="f.id" class="faixa-card card" :class="{ 'tem-offline': foraDoAr(f) }">
        <div class="faixa-topo">
          <strong>{{ f.rotulo }}</strong>
          <span class="faixa-num">{{ f.online }}/{{ f.total }}</span>
        </div>
        <div class="barra">
          <span class="barra-on" :style="{ width: `${percentualDoGrupo(f)}%` }" />
        </div>
        <small v-if="foraDoAr(f)" class="faixa-off">{{ f.offline }} fora do ar</small>
        <small v-else-if="f.desconhecido > 0" class="faixa-espera">{{ f.desconhecido }} aguardando</small>
        <small v-else class="faixa-ok">tudo respondendo</small>
      </div>
    </div>

    <!-- Quem caiu por último -->
    <div v-if="temQuedas" class="caidos card">
      <h3><WifiOff :size="16" /> Caíram mais recentemente</h3>
      <ul>
        <li v-for="h in caidosRecentemente" :key="h.ip">
          <code>{{ h.ip }}</code>
          <span>{{ h.rotulo }}</span>
          <em>{{ haQuantoTempo(h.offlineDesde) }}</em>
        </li>
      </ul>
    </div>

    <!-- Tabela -->
    <div class="card table-card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Endereço</th>
              <th>Grupo</th>
              <th>Status</th>
              <th>Como respondeu</th>
              <th>Latência</th>
              <th>Histórico</th>
              <th>Tempo no estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="carregando">
              <td colspan="7" class="td-center">Carregando…</td>
            </tr>
            <tr v-else-if="pagina.length === 0">
              <td colspan="7" class="td-center">Nenhum endereço com esses filtros.</td>
            </tr>
            <tr v-for="h in pagina" :key="h.ip" :class="{ 'linha-offline': h.status === 'offline' }">
              <td class="nowrap"><code class="ip">{{ h.ip }}</code></td>
              <td>{{ h.rotulo }}</td>
              <td><StatusPill :status="ROTULO_STATUS[h.status]" /></td>
              <td class="dim">{{ h.metodo || '—' }}</td>
              <td class="nowrap">{{ h.latenciaMs !== null ? `${h.latenciaMs} ms` : '—' }}</td>
              <td>
                <!-- mini-gráfico: uma barra por ciclo, verde = respondeu -->
                <span class="spark" :aria-label="`${h.historico.length} verificações recentes`">
                  <i v-for="(c, i) in h.historico.split('')" :key="i" :class="c === '1' ? 'on' : 'off'" />
                </span>
              </td>
              <td class="nowrap dim">
                {{ tempoNoEstado(h) }}
                <span v-if="h.alternancias > 2" class="alerta-osc">oscila</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <PaginationBar
        :page="page"
        :page-size="PAGE_SIZE"
        :total="ordenados.length"
        @change="(p) => (page = p)"
      />
    </div>
  </div>
</template>

<style scoped>
.rede-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---- erros e avisos ---- */
.erro {
  display: flex;
  gap: 12px;
  padding: 14px 18px;
  border-color: var(--red);
  background: var(--red-soft);
  color: var(--red);
}
.erro strong { display: block; font-size: 13.5px; }
.erro span { display: block; font-size: 13px; color: var(--text-primary); margin-top: 2px; }
.erro small { display: block; font-size: 12px; color: var(--text-secondary); margin-top: 6px; }

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
.badge.em-andamento { background: var(--blue-soft); color: var(--blue); }
.meta { font-size: 12px; color: var(--text-muted); }
.btn-mini { padding: 6px 12px; font-size: 12.5px; margin-left: auto; }
.aviso-agora {
  margin: 10px 0 0;
  font-size: 12.5px;
  color: var(--text-secondary);
}

/* ---- filtros ---- */
.filtro-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  flex-wrap: wrap;
}
.filtro-bar label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.campo-busca { position: relative; flex: 1 1 260px; min-width: 200px; }
.campo-busca svg {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}
.campo-busca .input { padding-left: 34px; }
.select-input.slim { width: auto; min-width: 150px; }

/* ---- cartões por grupo ---- */
.faixas-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
  gap: 12px;
}
.faixa-card { padding: 14px 16px; }
.faixa-card.tem-offline { border-color: color-mix(in srgb, var(--red) 35%, var(--border)); }
.faixa-topo {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 8px;
}
.faixa-topo strong { font-size: 13px; color: var(--text-primary); }
.faixa-num { font-size: 13px; font-weight: 700; color: var(--text-secondary); }
.barra {
  height: 6px;
  border-radius: 999px;
  background: var(--red-soft);
  overflow: hidden;
}
.barra-on { display: block; height: 100%; background: var(--green); }
.faixa-off { display: block; margin-top: 7px; font-size: 11.5px; font-weight: 700; color: var(--red); }
.faixa-espera { display: block; margin-top: 7px; font-size: 11.5px; color: var(--text-muted); }
.faixa-ok { display: block; margin-top: 7px; font-size: 11.5px; color: var(--green); }

/* ---- quedas recentes ---- */
.caidos { padding: 14px 16px; }
.caidos h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 10px;
}
.caidos ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.caidos li {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 13px;
}
.caidos code { color: var(--text-primary); font-weight: 600; }
.caidos span { color: var(--text-secondary); }
.caidos em { margin-left: auto; color: var(--red); font-style: normal; font-weight: 700; font-size: 12px; }

/* ---- tabela ---- */
.ip { color: var(--text-primary); font-weight: 600; }
.linha-offline { background: color-mix(in srgb, var(--red) 4%, transparent); }
.dim { color: var(--text-muted); font-size: 12.5px; }
.nowrap { white-space: nowrap; }
.td-center { text-align: center; color: var(--text-muted); padding: 28px !important; }
.alerta-osc {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--yellow-soft);
  color: var(--yellow);
  font-size: 10.5px;
  font-weight: 700;
}

/* ---- mini-gráfico de histórico ---- */
.spark { display: inline-flex; gap: 2px; align-items: center; }
.spark i { width: 5px; height: 16px; border-radius: 2px; }
.spark i.on { background: var(--green); }
.spark i.off { background: var(--red); opacity: 0.55; }

@media (max-width: 640px) {
  .btn-mini { margin-left: 0; }
  .spark i { width: 4px; height: 13px; }
}
</style>