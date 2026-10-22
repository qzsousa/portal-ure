<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePontoStore } from '@/stores/ponto'
import {
  baterPonto,
  listarSolicitacoesPonto,
  aprovarPonto,
  reprovarPonto,
  historicoPonto,
  listarPontoAdmin,
} from '@/api/ponto'
import type { PontoRegistro, PontoVisita } from '@/types'
import {
  Loader2,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Navigation,
  ShieldCheck,
  XCircle,
  History,
} from '@lucide/vue'

const auth = useAuthStore()
const ponto = usePontoStore()

const isAdmin = computed(() => auth.user?.nivel === 'ADMIN')
const carregando = ref(false)
const erro = ref('')
const sucesso = ref('')
const solicitacoes = ref<PontoRegistro[]>([])
const historico = ref<PontoRegistro[]>([])
const posicao = ref<{ lat: number; lng: number; accuracy: number } | null>(null)
const geoErro = ref('')
const obtendoGeo = ref(false)
const visitaSelecionada = ref<string | null>(null)

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (v: number) => (v * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}

const visitaAtiva = computed<PontoVisita | null>(() => {
  const vs = ponto.hoje?.visitas ?? []
  if (!vs.length) return null
  if (visitaSelecionada.value) return vs.find((v) => (v.agendaId ?? v.escola) === visitaSelecionada.value) ?? vs[0]
  return vs.find((v) => !v.ponto || (v.ponto.status !== 'NO_HORARIO' && v.ponto.status !== 'TARDIO_AUTORIZADO')) ?? vs[0]
})

const coordsVisita = computed(() => (visitaAtiva.value?.latitude != null && visitaAtiva.value?.longitude != null)
  ? { lat: visitaAtiva.value.latitude!, lng: visitaAtiva.value.longitude! }
  : null)

const distanciaAtual = computed(() => {
  if (!posicao.value || !coordsVisita.value) return null
  return haversine(posicao.value.lat, posicao.value.lng, coordsVisita.value.lat, coordsVisita.value.lng)
})

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    await ponto.carregar()
    if (isAdmin.value) {
      solicitacoes.value = await listarSolicitacoesPonto({ status: 'TARDIO_PENDENTE' })
      historico.value = await listarPontoAdmin({})
    } else {
      historico.value = await historicoPonto({})
    }
  } catch (e: any) {
    erro.value = e?.response?.data?.message || 'Erro ao carregar ponto'
  } finally {
    carregando.value = false
  }
}

function obterLocalizacao() {
  if (!navigator.geolocation) {
    geoErro.value = 'Geolocalização não suportada neste navegador'
    return
  }
  obtendoGeo.value = true
  geoErro.value = ''
  navigator.geolocation.getCurrentPosition(
    (p) => {
      posicao.value = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }
      obtendoGeo.value = false
    },
    (e) => {
      geoErro.value = e.message || 'Não foi possível obter a localização'
      obtendoGeo.value = false
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  )
}

async function registrar() {
  if (!visitaAtiva.value) return
  erro.value = ''
  sucesso.value = ''
  carregando.value = true
  try {
    const payload: any = { agendaId: visitaAtiva.value.agendaId ?? undefined, escola: visitaAtiva.value.escola }
    if (posicao.value) {
      payload.latitude = posicao.value.lat
      payload.longitude = posicao.value.lng
      payload.accuracy = posicao.value.accuracy
    }
    const r = await baterPonto(payload)
    await ponto.carregar()
    historico.value = isAdmin.value ? await listarPontoAdmin({}) : await historicoPonto({})
    if (r.status === 'PENDENTE') {
      const nome = auth.user?.nome || 'Técnico'
      const escola = visitaAtiva.value?.escola || ''
      const msg = encodeURIComponent(`Olá Jessica, estou fora do horário permitido para registrar o ponto. Técnico: ${nome}. Escola: ${escola}. Justificativa: `)
      window.location.href = `https://wa.me/5511941363521?text=${msg}`
      return
    }
    sucesso.value = 'Ponto registrado com sucesso.'
  } catch (e: any) {
    erro.value = e?.response?.data?.message || 'Erro ao registrar ponto'
  } finally {
    carregando.value = false
  }
}

async function aprovar(id: string) {
  await aprovarPonto(id)
  solicitacoes.value = await listarSolicitacoesPonto({ status: 'TARDIO_PENDENTE' })
  historico.value = await listarPontoAdmin({})
}

async function reprovar(id: string) {
  await reprovarPonto(id)
  solicitacoes.value = await listarSolicitacoesPonto({ status: 'TARDIO_PENDENTE' })
  historico.value = await listarPontoAdmin({})
}

const horaFormatada = (r: PontoRegistro) => r.batidoEm ? new Date(r.batidoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''

const horaAgora = ref('')
function atualizarHora() {
  horaAgora.value = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date())
}
onMounted(() => {
  carregar()
  atualizarHora()
  setInterval(atualizarHora, 1000)
})
</script>

<template>
  <div class="ponto-page">
    <header class="page-header">
      <div>
        <h1>Ponto</h1>
        <p class="subtitle">Registro diário de presença do técnico</p>
      </div>
      <div class="clock-chip">
        <Clock :size="16" />
        <span>{{ horaAgora || '--:--:--' }}</span>
      </div>
    </header>

    <div v-if="carregando && !ponto.hoje" class="loading-state">
      <Loader2 class="spin" :size="22" /> Carregando...
    </div>

    <div v-else-if="erro" class="alert alert-error">
      <AlertTriangle :size="18" /> {{ erro }}
    </div>
    <div v-else-if="sucesso" class="alert alert-success">
      <CheckCircle2 :size="18" /> {{ sucesso }}
    </div>

    <!-- Técnico -->
    <template v-if="!isAdmin">
      <!-- Férias -->
      <section v-if="ponto.hoje?.status === 'FERIAS'" class="status-card status-ok">
        <div class="status-icon"><ShieldCheck :size="28" /></div>
        <div class="status-body">
          <h2>Você está em férias</h2>
          <p>Não é necessário bater ponto durante o período de férias.</p>
        </div>
      </section>

      <!-- Todas batidas -->
      <section v-else-if="ponto.liberado" class="status-card status-ok">
        <div class="status-icon"><CheckCircle2 :size="28" /></div>
        <div class="status-body">
          <h2>Todas as visitas registradas</h2>
          <p>Você pode acessar o sistema.</p>
        </div>
      </section>

      <!-- Pendente -->
      <section v-else-if="ponto.status === 'PENDENTE'" class="status-card status-pending">
        <div class="status-icon"><Clock :size="28" /></div>
        <div class="status-body">
          <h2>Aguardando aprovação</h2>
          <p>Existe solicitação de ponto tardio pendente. Aguarde a liberação do administrador.</p>
        </div>
      </section>

      <!-- Reprovado -->
      <section v-else-if="ponto.status === 'REPROVADO'" class="status-card status-error">
        <div class="status-icon"><XCircle :size="28" /></div>
        <div class="status-body">
          <h2>Solicitação reprovada</h2>
          <p>Procure o administrador para regularizar seu ponto.</p>
        </div>
      </section>

      <!-- Formulário multi-visita -->
      <section v-else class="form-card">
        <div class="window-banner" :class="ponto.hoje?.dentroDaJanela ? 'window-open' : 'window-closed'">
          <Clock :size="16" />
          <span>
            Janela de ponto: <strong>08:00 às 08:30</strong>
          </span>
          <span class="window-tag">{{ ponto.hoje?.dentroDaJanela ? 'Aberta' : 'Fechada' }}</span>
        </div>

        <div v-if="ponto.hoje?.semAgenda" class="inline-warn">
          <AlertTriangle :size="16" />
          <span>Você não tem agenda de atendimento para hoje. O ponto usará sua unidade como referência.</span>
        </div>

        <!-- Lista de visitas do dia -->
        <div class="block">
          <h3>Visitas de hoje</h3>
          <ul class="visit-list">
            <li v-for="v in ponto.hoje?.visitas" :key="v.agendaId ?? v.escola" :class="{ active: (v.agendaId ?? v.escola) === (visitaAtiva?.agendaId ?? visitaAtiva?.escola) }" @click="visitaSelecionada = (v.agendaId ?? v.escola)">
              <div class="visit-main">
                <MapPin :size="14" />
                <span>{{ v.escola }}</span>
              </div>
              <span v-if="v.ponto" class="chip chip-ok" :class="v.ponto.dentroDoRaio === false ? 'chip-warn' : ''">
                <CheckCircle2 :size="12" /> {{ horaFormatada(v.ponto) }}
                <span v-if="v.ponto.distanciaMetros != null"> · {{ v.ponto.distanciaMetros }}m</span>
              </span>
              <span v-else class="chip chip-neutral">Pendente</span>
            </li>
          </ul>
        </div>

        <div v-if="visitaAtiva" class="block">
          <h3>Localização — {{ visitaAtiva.escola }}</h3>
          <div class="geo-row">
            <button class="btn btn-outline" @click="obterLocalizacao" :disabled="obtendoGeo">
              <Navigation :size="16" /> {{ obtendoGeo ? 'Obtendo...' : 'Obter minha localização' }}
            </button>
            <span v-if="posicao" class="coord-text">
              {{ posicao.lat.toFixed(5) }}, {{ posicao.lng.toFixed(5) }}
              <span class="muted">(±{{ Math.round(posicao.accuracy) }}m)</span>
            </span>
          </div>
          <p v-if="geoErro" class="error-text">{{ geoErro }}</p>

          <div v-if="distanciaAtual != null" class="distance-card" :class="distanciaAtual! <= 500 ? 'dist-ok' : 'dist-warn'">
            <div class="distance-value">{{ distanciaAtual }}<span>m</span></div>
            <div class="distance-info">
              <strong>{{ visitaAtiva.escola }}</strong>
              <span>{{ distanciaAtual! <= 500 ? 'Dentro do raio de 500m' : 'Fora do raio — ponto será salvo com alerta' }}</span>
            </div>
          </div>
          <p v-else-if="!coordsVisita" class="hint muted">Escola sem coordenadas cadastradas.</p>
        </div>

        <div v-if="posicao && !ponto.hoje?.dentroDaJanela" class="alert alert-error">
          <AlertTriangle :size="18" /> Você está fora do horario permitido para registrar o ponto. Entre contato com a Jessica via Whatsapp e justifique o atraso.
        </div>

        <button v-if="posicao" class="btn btn-primary btn-block" @click="registrar" :disabled="carregando || !visitaAtiva">
          <Loader2 v-if="carregando" class="spin" :size="18" />
          <template v-else>
            <CheckCircle2 :size="18" />
            {{ ponto.hoje?.dentroDaJanela ? 'Bater ponto' : 'Solicitar autorização' }} — {{ visitaAtiva?.escola }}
          </template>
        </button>

        <p v-if="!ponto.hoje?.dentroDaJanela" class="hint">
          Fora da janela (08:00–08:30): será criada uma solicitação para o administrador.
        </p>
      </section>

      <!-- Histórico -->
      <section class="history-section">
        <h2><History :size="18" /> Histórico de ponto</h2>
        <div v-if="!historico.length" class="empty-state">Nenhum registro encontrado.</div>
        <div v-for="r in historico" :key="r.id" class="hist-card">
          <div class="hist-main">
            <strong>{{ r.escola || '—' }}</strong>
            <span class="muted">{{ new Date(r.data).toLocaleDateString('pt-BR') }} · {{ horaFormatada(r) }}</span>
          </div>
          <div class="hist-meta">
            <span class="chip chip-neutral">{{ r.status }}</span>
            <span v-if="r.distanciaMetros != null" class="chip" :class="r.dentroDoRaio === false ? 'chip-warn' : 'chip-ok'">
              {{ r.distanciaMetros }}m
            </span>
            <span v-if="r.latitude != null" class="chip chip-neutral">
              <MapPin :size="12" /> {{ r.latitude?.toFixed(4) }}, {{ r.longitude?.toFixed(4) }}
            </span>
            <span v-if="r.semAgenda" class="chip chip-warn">sem agenda</span>
          </div>
        </div>
      </section>
    </template>

    <!-- Admin -->
    <template v-else>
      <section class="admin-section">
        <h2>Solicitações de ponto tardio</h2>
        <p class="muted">Aprove ou reprove as solicitações dos técnicos.</p>

        <div v-if="!solicitacoes.length" class="empty-state">
          <ShieldCheck :size="32" />
          <span>Nenhuma solicitação pendente.</span>
        </div>

        <div v-for="s in solicitacoes" :key="s.id" class="sol-card">
          <div class="sol-info">
            <strong>{{ s.usuario?.nome || s.usuarioId }}</strong>
            <span class="muted">{{ s.escola }} — {{ new Date(s.batidoEm).toLocaleString('pt-BR') }}</span>
            <div class="sol-meta">
              <span class="chip chip-neutral">dist: {{ s.distanciaMetros ?? '—' }}m</span>
              <span v-if="s.semAgenda" class="chip chip-warn">sem agenda</span>
              <span v-if="s.dentroDoRaio === false" class="chip chip-warn">fora do raio</span>
            </div>
          </div>
          <div class="sol-actions">
            <button class="btn btn-primary" @click="aprovar(s.id)">
              <CheckCircle2 :size="16" /> Aprovar
            </button>
            <button class="btn btn-danger" @click="reprovar(s.id)">
              <XCircle :size="16" /> Reprovar
            </button>
          </div>
        </div>
      </section>

      <section class="history-section">
        <h2><History :size="18" /> Histórico de ponto (todos)</h2>
        <div v-if="!historico.length" class="empty-state">Nenhum registro encontrado.</div>
        <div v-for="r in historico" :key="r.id" class="hist-card">
          <div class="hist-main">
            <strong>{{ r.usuario?.nome || r.usuarioId }}</strong>
            <span class="muted">{{ r.escola }} — {{ new Date(r.data).toLocaleDateString('pt-BR') }} · {{ horaFormatada(r) }}</span>
          </div>
          <div class="hist-meta">
            <span class="chip chip-neutral">{{ r.status }}</span>
            <span v-if="r.distanciaMetros != null" class="chip" :class="r.dentroDoRaio === false ? 'chip-warn' : 'chip-ok'">
              {{ r.distanciaMetros }}m
            </span>
            <span v-if="r.latitude != null" class="chip chip-neutral">
              <MapPin :size="12" /> {{ r.latitude?.toFixed(4) }}, {{ r.longitude?.toFixed(4) }}
            </span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ponto-page { max-width: 820px; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
.page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; }
.page-header h1 { font-size: 1.75rem; line-height: 1.1; }
.subtitle { color: var(--text-secondary); margin-top: 4px; font-size: 0.95rem; }
.clock-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 999px; font-weight: 600; color: var(--text-primary); box-shadow: var(--shadow-sm); }
.loading-state { display: flex; align-items: center; gap: 8px; color: var(--text-secondary); padding: 2rem 0; }
.alert { display: flex; align-items: center; gap: 8px; padding: 0.85rem 1rem; border-radius: var(--radius-sm); margin-bottom: 1rem; font-weight: 500; }
.alert-error { background: var(--red-soft); color: var(--red); border: 1px solid #fecaca; }
.alert-success { background: var(--green-soft); color: var(--green); border: 1px solid #bbf7d0; }
.status-card { display: flex; gap: 1rem; align-items: flex-start; padding: 1.25rem; border-radius: var(--radius-md); background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-sm); }
.status-icon { flex-shrink: 0; width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; }
.status-ok .status-icon { background: var(--green-soft); color: var(--green); }
.status-pending .status-icon { background: var(--yellow-soft); color: var(--yellow); }
.status-error .status-icon { background: var(--red-soft); color: var(--red); }
.status-body h2 { font-size: 1.15rem; margin-bottom: 4px; }
.status-body p { color: var(--text-secondary); }
.form-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); padding: 1.25rem; display: flex; flex-direction: column; gap: 1.25rem; }
.window-banner { display: flex; align-items: center; gap: 8px; padding: 0.75rem 1rem; border-radius: var(--radius-sm); font-size: 0.9rem; flex-wrap: wrap; }
.window-open { background: var(--green-soft); color: var(--green); }
.window-closed { background: var(--yellow-soft); color: var(--yellow); }
.window-tag { margin-left: auto; font-weight: 700; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.04em; }
.dot { margin: 0 6px; opacity: 0.6; }
.inline-warn { display: flex; align-items: center; gap: 8px; padding: 0.75rem 1rem; border-radius: var(--radius-sm); background: var(--yellow-soft); color: var(--yellow); font-size: 0.9rem; }
.block h3 { font-size: 0.95rem; margin-bottom: 8px; color: var(--text-primary); }
.visit-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.visit-list li { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; background: var(--surface-muted); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; transition: background 0.15s; }
.visit-list li.active { background: var(--blue-soft); border-color: var(--blue); }
.visit-main { display: flex; align-items: center; gap: 6px; font-size: 0.9rem; }
.geo-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.coord-text { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 0.85rem; color: var(--text-secondary); }
.distance-card { display: flex; align-items: center; gap: 1rem; padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border); margin-top: 10px; }
.dist-ok { background: var(--green-soft); border-color: #bbf7d0; }
.dist-warn { background: var(--yellow-soft); border-color: #fde68a; }
.distance-value { font-size: 1.6rem; font-weight: 800; line-height: 1; }
.distance-value span { font-size: 0.85rem; font-weight: 600; margin-left: 2px; }
.distance-info { display: flex; flex-direction: column; font-size: 0.9rem; }
.distance-info span { color: var(--text-secondary); }
.btn-block { width: 100%; justify-content: center; padding: 12px 16px; font-size: 1rem; }
.hint { text-align: center; font-size: 0.85rem; }
.chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; font-size: 0.8rem; font-weight: 600; }
.chip-ok { background: var(--green-soft); color: var(--green); }
.chip-warn { background: var(--yellow-soft); color: var(--yellow); }
.chip-neutral { background: var(--slate-soft); color: var(--slate); }
.admin-section h2 { margin-bottom: 4px; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 2rem; color: var(--text-muted); background: var(--surface); border: 1px dashed var(--border-strong); border-radius: var(--radius-md); }
.sol-card { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); margin-top: 0.75rem; box-shadow: var(--shadow-sm); }
.sol-info { display: flex; flex-direction: column; gap: 2px; }
.sol-meta { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
.sol-actions { display: flex; gap: 8px; flex-shrink: 0; }
.btn-danger { background: var(--red); color: #fff; border: 1px solid var(--red); }
.btn-danger:hover { background: #b91c1c; }
.btn-outline { background: var(--surface); border: 1px solid var(--border-strong); color: var(--text-secondary); }
.btn-outline:hover { background: var(--surface-muted); }
.btn-primary { background: var(--sidebar-bg); color: #fff; border: 1px solid var(--sidebar-bg); }
.btn-primary:hover { background: #0d2a52; }
.muted { color: var(--text-muted); }
.error-text { color: var(--red); font-size: 0.85rem; }
.history-section { margin-top: 2rem; }
.history-section h2 { display: flex; align-items: center; gap: 8px; margin-bottom: 0.75rem; }
.hist-card { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.85rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); margin-top: 0.5rem; box-shadow: var(--shadow-sm); }
.hist-main { display: flex; flex-direction: column; gap: 2px; }
.hist-meta { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) {
  .page-header { flex-direction: column; align-items: flex-start; }
  .sol-card, .hist-card { flex-direction: column; align-items: stretch; }
  .sol-actions { justify-content: stretch; }
  .sol-actions .btn { flex: 1; justify-content: center; }
}
</style>
