<script setup lang="ts">
/**
 * Monitoramento de rede — online/offline dos endereços da rede privada.
 *
 * Os dados vêm do serviço de monitoramento (que roda NA MÁQUINA DA REDE e faz
 * o ping de verdade — o navegador não envia ICMP). A tela apenas consome a
 * API: nada de iframe, nada de ping no front.
 *
 * ## Como ler esta tela
 *
 * A unidade da tela é a ESCOLA, não o endereço. Na configuração dos DVRs cada
 * escola tem 6 endereços fixos — VIDEO-DVR1/2/3 na rede ADM (administrativa) e
 * os mesmos 3 na rede PED (pedagógica) — e o que interessa é "a escola X está
 * com DVR2 da rede ADM fora do ar", não "10.109.121.195 não responde".
 *
 * Por isso a tabela é uma linha por equipamento com o agrupamento da escola, e
 * não uma linha plana de 432 endereços: em uma lista plana os 6 endereços de
 * uma escola ficam separados por outros, e uma queda de rede vira 6 linhas
 * parecendo 6 defeitos. Paginação também é por escola — cortar no meio de um
 * grupo mostra metade dos DVRs e sugere que a escola tem menos equipamentos.
 *
 * Por que os KPIs não somam só endereços: "12 fora do ar" e "3 escolas com
 * problema" são a mesma informação em duas unidades. Quem atende chamado
 * precisa da segunda, e precisa dela por REDE — ADM caída é acesso gerencial
 * perdido, PED caída é gravação e projeção.
 */
import { computed, onMounted, ref } from 'vue'
import {
  Activity,
  AlertTriangle,
  Building2,
  Cctv,
  Loader2,
  Network,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
} from '@lucide/vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import {
  forcarVarredura,
  obterMonitoramento,
  verificarHealthMonitor,
  type MonitorHost,
  type MonitorRede,
  type MonitorSnapshot,
  type MonitorStatus,
} from '@/api/monitor'
import { AUTO_REFRESH_MS, useAutoRefresh } from '@/composables/useAutoRefresh'
import { useUiStore } from '@/stores/ui'
import { apiError } from '@/utils/apiError'

const PAGE_SIZE = 12

const ui = useUiStore()

const carregando = ref(true)
const erro = ref('')
const snap = ref<MonitorSnapshot | null>(null)
const page = ref(1)

const busca = ref('')
const filtroStatus = ref<'' | MonitorStatus>('')
const filtroRede = ref('')
const filtroEscola = ref('')

/** Relógio local: a tela é de "tempo real" e um carimbo estático envelheceria. */
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

/**
 * Nome legível da rede.
 *
 * A sigla sozinha não diz nada na tela: "ADM" e "PED" são jargão de rede. A
 * expansão vai num `title` porque a linha já carrega equipamento, IP, latência
 * e histórico — e quem não sabe a sigla não deve precisar abrir outra tela
 * para descobrir o que a coluna quer dizer.
 */
const NOME_REDE: Record<string, string> = {
  ADM: 'Rede administrativa (acesso gerencial)',
  PED: 'Rede pedagógica (gravação e projeção)',
}

function nomeRede(rede: string | null): string {
  return rede ?? '—'
}

function tituloRede(rede: string | null): string {
  if (!rede) return ''
  return NOME_REDE[rede] ?? `Rede ${rede}`
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

const porRede = computed<MonitorRede[]>(() => snap.value?.porRede ?? [])

/** Redes disponíveis no filtro, na ordem em que o serviço as devolveu. */
const redes = computed(() => porRede.value.map((r) => r.id).filter(Boolean))

/**
 * Comparações que involucram `>` ficam em função, e não no template.
 *
 * O `>` dentro de um atributo do template é lido pelo parser HTML como início
 * de tag: `:class="{ tem-offline: f.offline > 0 }"` faz o compilador interromper
 * o atributo no `>` e o `vue-tsc` acusar erro de sintaxe — com mensagem que não
 * aponta nem para o arquivo nem para a linha certa. Dentro de uma função no
 * `<script>` não há ambiguidade nenhuma.
 */
function percentualDoGrupo(f: { online: number; total: number }): number {
  return f.total > 0 ? (f.online / f.total) * 100 : 0
}

/* ---------------- agrupamento por escola ---------------- */

interface Escola {
  id: string
  nome: string
  hosts: MonitorHost[]
  total: number
  online: number
  offline: number
  desconhecido: number
  /** Offline mais antigo do grupo — a queda mais antiga ainda sem conserto. */
  offlineDesde: number | null
  /** `porRede` do próprio grupo, para a coluna "por rede". */
  redes: MonitorRede[]
}

/**
 * Agrupa os endereços por escola, na ordem em que o serviço devolveu as faixas.
 *
 * A ordem NÃO é alfabética: é a ordem do `porFaixa` do serviço, que vem do
 * `config.json`. Ordenar alfabeticamente jogaria para o fim a escola que está
 * com problema, e essa é justamente a que se quer ver primeiro.
 */
const escolas = computed<Escola[]>(() => {
  const rotulos = new Map((snap.value?.porFaixa ?? []).map((f) => [f.id, f.rotulo]))

  const porId = new Map<string, Escola>()
  for (const h of snap.value?.hosts ?? []) {
    let grupo = porId.get(h.faixa)
    if (!grupo) {
      grupo = {
        id: h.faixa,
        nome: rotulos.get(h.faixa) ?? h.rotulo,
        hosts: [],
        total: 0,
        online: 0,
        offline: 0,
        desconhecido: 0,
        offlineDesde: null,
        redes: [],
      }
      porId.set(h.faixa, grupo)
    }
    grupo.hosts.push(h)
    grupo.total += 1
    if (h.status === 'online') grupo.online += 1
    else if (h.status === 'offline') {
      grupo.offline += 1
      // `null` de propósito: o primeiro offline define a queda mais antiga, e
      // comparação com `null` devolveria `true` para todos os seguintes.
      if (grupo.offlineDesde === null) grupo.offlineDesde = h.offlineDesde
    } else grupo.desconhecido += 1
  }

  const ordem = (snap.value?.porFaixa ?? []).map((f) => f.id)
  const lista = [...porId.values()]

  // Redes dentro da escola: ADM antes de PED, para o olho encontrar o par na
  // mesma linha. A ordem de rede não é alfabética de propósito — ADM vem
  // primeiro porque é a rede de gerência, a que se procura mais.
  const ordemRede = (r: string) => (r === 'ADM' ? 0 : r === 'PED' ? 1 : 2)
  for (const grupo of lista) {
    const porRedeLocal = new Map<string, MonitorRede>()
    for (const h of grupo.hosts) {
      if (!h.rede) continue
      let r = porRedeLocal.get(h.rede)
      if (!r) {
        r = { id: h.rede, total: 0, online: 0, offline: 0, desconhecido: 0 }
        porRedeLocal.set(h.rede, r)
      }
      r.total += 1
      if (h.status === 'online') r.online += 1
      else if (h.status === 'offline') r.offline += 1
      else r.desconhecido += 1
    }
    grupo.redes = [...porRedeLocal.values()].sort((a, b) => ordemRede(a.id) - ordemRede(b.id))
  }

  return lista.sort((a, b) => {
    const i = ordem.indexOf(a.id) - ordem.indexOf(b.id)
    return i === 0 ? 0 : i === -1 ? 1 : -1
  })
})

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') /* combining diacritics U+0300–U+036F */
}

/* ---------------- filtros ---------------- */

/**
 * Filtra no NÍVEL DA ESCOLA, não do endereço.
 *
 * "Offline" answering "mostre as escolas com algum equipamento fora do ar".
 * Se o filtro fosse por endereço, uma escola com 1 dos 6 DVRs fora apareceria
 * com "5 de 6" no contador — que parece estar saudável à primeira vista.
 */
const filtradas = computed(() => {
  const termo = normalizar(busca.value.trim())

  return escolas.value.filter((e) => {
    if (filtroEscola.value && e.id !== filtroEscola.value) return false
    if (filtroRede.value && !e.redes.some((r) => r.id === filtroRede.value)) return false
    if (filtroStatus.value === 'offline' && e.offline === 0) return false
    if (filtroStatus.value === 'online' && e.online !== e.total) return false
    if (filtroStatus.value === 'desconhecido' && e.desconhecido === 0) return false
    if (termo) {
      const alvo = normalizar(
        `${e.nome} ${e.hosts.map((h) => `${h.ip} ${h.equip ?? ''} ${h.rede ?? ''}`).join(' ')}`,
      )
      if (!alvo.includes(termo)) return false
    }
    return true
  })
})

/**
 * Offline primeiro, depois aguardando, depois tudo certo.
 *
 * Dentro de cada faixa, a escola com a queda mais antiga sobe. É o critério que
 * resolve a fila de quem atende: um DVR caído há 40 min passa à frente de um
 * que caiu há 10 s, mesmo sendo menos "recente".
 */
const ordenadas = computed(() =>
  [...filtradas.value].sort((a, b) => {
    const peso = (e: Escola) => (e.offline > 0 ? 0 : e.desconhecido > 0 ? 1 : 2)
    const d = peso(a) - peso(b)
    if (d !== 0) return d
    if (a.offline > 0 && b.offline > 0) {
      const ta = a.offlineDesde ?? Number.MAX_SAFE_INTEGER
      const tb = b.offlineDesde ?? Number.MAX_SAFE_INTEGER
      if (ta !== tb) return ta - tb
    }
    return normalizar(a.nome).localeCompare(normalizar(b.nome))
  }),
)

const pagina = computed(() => ordenadas.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))

/**
 * Equipamentos que caíram na última varredura, já com escola e rede.
 *
 * Ordenados por queda mais antiga e limitados a 8: uma /24 inteira fora do ar
 * coloca os 3 endereços da ADM de várias escolas na lista ao mesmo tempo, e um
 * cabeçalho de 40 linhas seria pior que nenhum.
 *
 * O nome da escola vem do `escolas` já agrupado, e não de um mapa montado à
 * parte: um mapa construído uma única vez no `setup` ficaria preso ao primeiro
 * carregamento e a lista mostraria a school do snapshot anterior.
 */
const caidosRecentemente = computed(() => {
  const nomeDaFaixa = new Map(escolas.value.map((e) => [e.id, e.nome]))
  return (snap.value?.hosts ?? [])
    .filter((h) => h.status === 'offline' && h.offlineDesde)
    .sort((a, b) => (a.offlineDesde ?? 0) - (b.offlineDesde ?? 0))
    .slice(0, 8)
    .map((h) => ({ host: h, escola: nomeDaFaixa.get(h.faixa) ?? h.rotulo }))
})

/**
 * Totais da lista filtrada, para os cartões do topo.
 *
 * São os totais do que está SENDO OLHADO, não os totais da rede inteira: se a
 * busca é "ADHEMAR", os cartões precisam falar da ADHEMAR. Senão o painel
 * responde a uma pergunta que ninguém fez.
 */
const resumoFiltrado = computed(() => {
  const lista = filtradas.value
  return {
    escolas: lista.length,
    total: lista.reduce((a, e) => a + e.total, 0),
    online: lista.reduce((a, e) => a + e.online, 0),
    offline: lista.reduce((a, e) => a + e.offline, 0),
    comProblema: lista.filter((e) => e.offline > 0).length,
  }
})

const temFiltro = computed(
  () => Boolean(busca.value.trim()) || filtroStatus.value !== '' || filtroRede.value !== '' || filtroEscola.value !== '',
)

function limparFiltros() {
  busca.value = ''
  filtroStatus.value = ''
  filtroRede.value = ''
  filtroEscola.value = ''
  page.value = 1
}

function temProblema(e: Escola): boolean {
  return e.offline > 0
}

function estaFiltrandoEscola(): boolean {
  return filtroEscola.value !== ''
}
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
        label="Escolas monitoradas"
        :value="carregando && !snap ? '…' : resumoFiltrado.escolas"
        tone="blue"
        :detail="`${resumoFiltrado.total} endereços`"
      >
        <Building2 :size="22" />
      </StatCard>
      <StatCard
        label="Online"
        :value="carregando && !snap ? '…' : resumoFiltrado.online"
        tone="green"
        :detail="`${percentOnline}% da rede`"
      >
        <Wifi :size="22" />
      </StatCard>
      <StatCard
        label="Escolas com problema"
        :value="carregando && !snap ? '…' : resumoFiltrado.comProblema"
        tone="red"
        :detail="
          snap?.caidosAgora ? `${snap.caidosAgora} caíram agora` : `${resumoFiltrado.offline} endereços fora do ar`
        "
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

    <!-- Por rede: ADM e PED caem por motivos e por pessoas diferentes. -->
    <div v-if="porRede.length > 0" class="redes-grid">
      <div
        v-for="r in porRede"
        :key="r.id"
        class="rede-card card"
        :class="{ 'tem-offline': r.offline > 0 }"
      >
        <div class="rede-topo">
          <Network :size="15" />
          <strong>{{ r.id }}</strong>
          <span class="rede-num">{{ r.online }}/{{ r.total }}</span>
        </div>
        <p class="rede-desc">{{ tituloRede(r.id) }}</p>
        <div class="barra">
          <span class="barra-on" :style="{ width: `${percentualDoGrupo(r)}%` }" />
        </div>
        <small v-if="r.offline > 0" class="rede-off">{{ r.offline }} fora do ar</small>
        <small v-else-if="r.desconhecido > 0" class="rede-espera">{{ r.desconhecido }} aguardando</small>
        <small v-else class="rede-ok">tudo respondendo</small>
      </div>
    </div>

    <!-- Filtros -->
    <div class="filtro-bar card">
      <div class="campo-busca">
        <Search :size="16" />
        <input v-model="busca" class="input" type="search" placeholder="Buscar por escola, IP, DVR ou rede…" />
      </div>

      <label>Situação:</label>
      <select v-model="filtroStatus" class="select-input slim">
        <option value="">Todas</option>
        <option value="offline">Com equipamento fora</option>
        <option value="online">Tudo respondendo</option>
        <option value="desconhecido">Aguardando</option>
      </select>

      <label>Rede:</label>
      <select v-model="filtroRede" class="select-input slim">
        <option value="">Todas</option>
        <option v-for="r in redes" :key="r" :value="r">{{ r }} — {{ tituloRede(r) }}</option>
      </select>

      <label>Escola:</label>
      <select v-model="filtroEscola" class="select-input slim largo">
        <option value="">Todas</option>
        <option v-for="e in escolas" :key="e.id" :value="e.id">{{ e.nome }}</option>
      </select>

      <button v-if="temFiltro" class="btn btn-outline btn-mini-inline" type="button" @click="limparFiltros">
        Limpar
      </button>

      <span class="meta">{{ filtradas.length }} de {{ escolas.length }} escolas</span>
    </div>

    <!-- Quem caiu por último -->
    <div v-if="caidosRecentemente.length > 0" class="caidos card">
      <h3><WifiOff :size="16" /> Caíram mais recentemente</h3>
      <ul>
        <li v-for="c in caidosRecentemente" :key="c.host.ip">
          <code>{{ c.host.ip }}</code>
          <span class="equip"><Cctv :size="13" /> {{ c.host.equip ?? '—' }}</span>
          <span class="escola">{{ c.escola }}</span>
          <span class="tag-rede" :title="tituloRede(c.host.rede)">{{ nomeRede(c.host.rede) }}</span>
          <em>{{ haQuantoTempo(c.host.offlineDesde) }}</em>
        </li>
      </ul>
    </div>

    <!-- Tabela: uma linha por equipamento, agrupada por escola -->
    <div class="card table-card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Equipamento</th>
              <th>Rede</th>
              <th>Escola</th>
              <th>Endereço</th>
              <th>Status</th>
              <th>Como respondeu</th>
              <th>Latência</th>
              <th>Histórico</th>
              <th>Tempo no estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="carregando">
              <td colspan="9" class="td-center">Carregando…</td>
            </tr>
            <tr v-else-if="pagina.length === 0">
              <td colspan="9" class="td-center">
                {{ temFiltro ? 'Nenhuma escola com esses filtros.' : 'Nenhuma escola monitorada.' }}
              </td>
            </tr>

            <template v-for="e in pagina" :key="e.id">
              <!--
                Uma linha de resumo por escola, DENTRO do <tbody>.
                Sem ela, a coluna "Escola" repetiria o mesmo nome em 6 linhas e
                quem rolasse a tabela leria o nome como dado — é o ruído que a
                coluna inteira existe para evitar.
              -->
              <tr v-if="!estaFiltrandoEscola()" class="linha-escola" :class="{ 'escola-problema': temProblema(e) }">
                <td :colspan="3">
                  <Cctv :size="15" />
                  <strong>{{ e.nome }}</strong>
                </td>
                <td :colspan="3">
                  <span
                    v-for="r in e.redes"
                    :key="r.id"
                    class="mini-rede"
                    :class="{ 'mini-off': r.offline > 0 }"
                    :title="tituloRede(r.id)"
                  >
                    {{ r.id }} {{ r.online }}/{{ r.total }}
                  </span>
                  <span v-if="e.redes.length === 0" class="meta">{{ e.online }}/{{ e.total }}</span>
                </td>
                <td>
                  <StatusPill
                    :status="e.offline > 0 ? `Offline` : e.desconhecido > 0 ? 'Aguardando' : 'Online'"
                  />
                </td>
                <td colspan="2">
                  <span v-if="temProblema(e)" class="resumo-queda">
                    {{ e.offline }} de {{ e.total }} fora
                    <template v-if="e.offlineDesde"> · a mais antiga há {{ duracao(agora - e.offlineDesde) }}</template>
                  </span>
                  <span v-else class="meta">tudo respondendo</span>
                </td>
              </tr>

              <tr
                v-for="h in e.hosts"
                :key="h.ip"
                class="linha-host"
                :class="{ 'linha-offline': h.status === 'offline' }"
              >
                <td class="nowrap">
                  <span class="equip"><Cctv :size="14" /> {{ h.equip ?? '—' }}</span>
                </td>
                <td>
                  <span class="tag-rede" :title="tituloRede(h.rede)">{{ nomeRede(h.rede) }}</span>
                </td>
                <td class="dim">{{ e.nome }}</td>
                <td class="nowrap"><code class="ip">{{ h.ip }}</code></td>
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
            </template>
          </tbody>
        </table>
      </div>
      <PaginationBar :page="page" :page-size="PAGE_SIZE" :total="ordenadas.length" @change="(p) => (page = p)" />
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

/* ---- barra de proporção (usada nos cartões de rede) ---- */
.barra {
  height: 6px;
  border-radius: 999px;
  background: var(--red-soft);
  overflow: hidden;
}
.barra-on { display: block; height: 100%; background: var(--green); }

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

/* ---- cartões por rede (ADM/PED) ---- */
.redes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: 12px;
}
.rede-card { padding: 14px 16px; }
.rede-card.tem-offline { border-color: color-mix(in srgb, var(--red) 35%, var(--border)); }
.rede-topo {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 2px;
}
.rede-topo svg { color: var(--text-muted); }
.rede-topo strong {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--text-primary);
}
.rede-num {
  margin-left: auto;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
}
/*
 * A expansão da sigla fica visível e não só no `title`.
 *
 * "ADM" e "PED" não significam nada para quem não é de rede — e a sigla aparece
 * em toda linha da tabela. Um `title` exigiria passar o mouse em 6 etiquetas por
 * escola; uma linha de texto resolve uma vez, para toda a tela.
 */
.rede-desc {
  margin: 0 0 9px;
  font-size: 11.5px;
  color: var(--text-muted);
}
.rede-off { display: block; margin-top: 7px; font-size: 11.5px; font-weight: 700; color: var(--red); }
.rede-espera { display: block; margin-top: 7px; font-size: 11.5px; color: var(--text-muted); }
.rede-ok { display: block; margin-top: 7px; font-size: 11.5px; font-weight: 700; color: var(--green); }

/* ---- etiqueta de rede na tabela ---- */
.tag-rede {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 6px;
  background: var(--slate-soft);
  color: var(--text-secondary);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

/* ---- filtro por escola: nome longo precisa de espaço ---- */
.select-input.largo { min-width: 240px; }
.btn-mini-inline {
  padding: 6px 12px;
  font-size: 12.5px;
}

/* ---- equipamento ---- */
.equip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* ---- linha de agrupamento da escola ---- */
.linha-escola td {
  padding: 9px 14px;
  background: var(--surface-muted);
  border-top: 1px solid var(--border);
  font-size: 13px;
  color: var(--text-primary);
}
.linha-escola:first-child td { border-top: none; }
.linha-escola td:first-child {
  display: flex;
  align-items: center;
  gap: 7px;
}
.linha-escola svg { color: var(--text-muted); }
/*
 * Escola com equipamento fora do ar: a linha de agrupamento é que precisa
 * chamar atenção, porque é ela que diz QUEM está com problema — as linhas dos
 * equipamentos abaixo já vêm destacadas em vermelho.
 */
.linha-escola.escola-problema {
  background: color-mix(in srgb, var(--red) 7%, var(--surface-muted));
}
.linha-escola.escola-problema td:first-child,
.linha-escola.escola-problema svg { color: var(--red); }
.linha-escola.escola-problema strong { color: var(--red); }

.mini-rede {
  display: inline-block;
  margin-right: 6px;
  padding: 1px 7px;
  border-radius: 6px;
  background: var(--slate-soft);
  color: var(--text-secondary);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.03em;
}
.mini-rede.mini-off {
  background: var(--red-soft);
  color: var(--red);
}
.resumo-queda {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--red);
}

/* ---- quedas recentes: agora trazem equipamento, escola e rede ---- */
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
  flex-wrap: wrap;
}
.caidos code { color: var(--text-primary); font-weight: 600; }
.caidos .escola { color: var(--text-secondary); }
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