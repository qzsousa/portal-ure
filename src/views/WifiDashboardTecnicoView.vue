<template>
  <div class="wifi-tec">
    <div class="page-head">
      <div class="page-head-left">
        <div class="page-head-icon"><Wifi :size="22" /></div>
        <div>
          <h1>Meus levantamentos</h1>
          <div class="meta">Visitas registradas por você</div>
        </div>
      </div>
      <button class="btn btn-primary" type="button" @click="router.push('/wifi')">+ Novo levantamento</button>
    </div>

    <div v-if="carregando" class="loading">Carregando…</div>

    <div v-else>
      <div class="kpi-grid">
        <div class="kpi ok">
          <h3>Visitas</h3>
          <div class="val">{{ visitas.length }}</div>
          <div class="sub">levantamentos seus</div>
        </div>
        <div class="kpi info">
          <h3>APs instalados</h3>
          <div class="val">{{ totalAps }}</div>
          <div class="sub">total registrado</div>
        </div>
        <div class="kpi warn">
          <h3>Salas sem AP</h3>
          <div class="val">{{ totalSem }}</div>
          <div class="sub">precisam de atenção</div>
        </div>
        <div class="kpi">
          <h3>Escolas</h3>
          <div class="val">{{ escolasUnicas }}</div>
          <div class="sub">visitadas por você</div>
        </div>
      </div>

      <div class="filtros">
        <input v-model="busca" placeholder="Buscar escola…" />
      </div>

      <div v-if="visitasFiltradas.length === 0" class="empty">Nenhum levantamento encontrado.</div>

      <div class="card-list">
        <div v-for="v in visitasFiltradas" :key="v.id" class="visita-card" @click="abrirDetalhe(v)">
          <div class="vc-head">
            <strong>{{ v.escola }}</strong>
            <span class="vc-data">{{ formatarData(v.dataVisita) }}</span>
          </div>
          <div class="vc-meta">
            <span class="badge info">{{ v.totalAps }} APs</span>
            <span class="badge warn">{{ v.salasSemAp }} sem AP</span>
            <span v-if="v.apsOn" class="badge ok">{{ v.apsOn }} ON</span>
            <span v-if="v.apsOff" class="badge warn">{{ v.apsOff }} OFF</span>
            <span v-if="v.apsDown" class="badge bad">{{ v.apsDown }} DOWN</span>
          </div>
          <div v-if="v.rackCond" class="vc-rack">Rack: {{ v.rackCond }}</div>
        </div>
      </div>

      <BaseModal :aberto="modalAberto" :titulo="visitaModal ? visitaModal.escola : 'Detalhes'" @fechar="modalAberto = false">
        <div v-if="visitaModal" class="detalhe-ap">
          <div class="det-grid">
            <div><span>Data</span><strong>{{ formatarData(visitaModal.dataVisita) }}</strong></div>
            <div><span>Técnico</span><strong>{{ visitaModal.tecnico }}</strong></div>
            <div><span>Salas</span><strong>{{ visitaModal.salasTotal }}</strong></div>
            <div><span>Sem AP</span><strong>{{ visitaModal.salasSemAp }}</strong></div>
            <div><span>APs</span><strong>{{ visitaModal.totalAps }}</strong></div>
            <div><span>Rack</span><strong>{{ visitaModal.rackCond || '—' }}</strong></div>
          </div>

          <h3>Access Points instalados</h3>
          <div v-if="!visitaModal.aps?.length" class="vazio">Nenhum AP registrado.</div>
          <ul v-else class="ap-list">
            <li v-for="a in visitaModal.aps" :key="a.id">
              <div class="ap-head">
                <strong>{{ a.numero }}</strong>
                <span class="badge" :class="statusBadge(a.status)">{{ a.status }}</span>
              </div>
              <div class="ap-sub">{{ a.local }}<template v-if="a.bloco"> · {{ a.bloco }}</template></div>
              <div v-if="a.obs" class="ap-obs">{{ a.obs }}</div>
            </li>
          </ul>

          <h3>Salas sem AP</h3>
          <div v-if="!visitaModal.salasSem?.length" class="vazio">Nenhuma sala registrada.</div>
          <ul v-else class="sem-list">
            <li v-for="s in visitaModal.salasSem" :key="s.id">
              <div class="ap-head">
                <strong>{{ s.sala }}</strong>
                <span class="badge" :class="infraBadge(s.infra)">{{ rotuloInfra(s.infra) }}</span>
              </div>
              <div v-if="s.tipo" class="ap-sub">{{ s.tipo }}<template v-if="s.bloco"> · {{ s.bloco }}</template></div>
              <div v-if="s.falta?.length" class="ap-sub">Falta: {{ s.falta.join(', ') }}</div>
              <div v-if="s.obs" class="ap-obs">{{ s.obs }}</div>
            </li>
          </ul>

          <div v-if="visitaModal.obs" class="obs-box">
            <span>Observações</span>
            <p>{{ visitaModal.obs }}</p>
          </div>

          <div class="modal-actions">
            <button class="btn btn-primary" type="button" @click="editar(visitaModal.id)">Editar levantamento</button>
          </div>
        </div>
      </BaseModal>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Wifi } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { listarVisitasWifi } from '@/api/wifi'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { apiError } from '@/utils/apiError'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

const carregando = ref(true)
const visitas = ref<any[]>([])
const busca = ref('')
const modalAberto = ref(false)
const visitaModal = ref<any>(null)

onMounted(async () => {
  try {
    const todas = await listarVisitasWifi()
    const nome = auth.user?.nome || ''
    visitas.value = nome ? todas.filter((v: any) => v.tecnico === nome) : todas
  } catch (e) {
    ui.error(apiError(e, 'Não foi possível carregar as visitas.'))
    visitas.value = []
  } finally {
    carregando.value = false
  }
})

const visitasFiltradas = computed(() => {
  const b = busca.value.toLowerCase().trim()
  if (!b) return visitas.value
  return visitas.value.filter((v: any) => String(v.escola || '').toLowerCase().includes(b))
})

const totalAps = computed(() => visitas.value.reduce((t: number, v: any) => t + (Number(v.totalAps) || 0), 0))
const totalSem = computed(() => visitas.value.reduce((t: number, v: any) => t + (Number(v.salasSemAp) || 0), 0))
const escolasUnicas = computed(() => new Set(visitas.value.map((v: any) => String(v.escola || '').trim().toLowerCase())).size)

function formatarData(d: any) {
  if (!d) return ''
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('pt-BR')
}

function abrirDetalhe(v: any) {
  visitaModal.value = v
  modalAberto.value = true
}

function editar(id: string) {
  modalAberto.value = false
  router.push({ name: 'wifi-levantamento', query: { id } })
}

function statusBadge(s: string) {
  return s === 'ON' ? 'ok' : s === 'OFF' ? 'warn' : 'bad'
}
function infraBadge(i: string) {
  return i === 'SIM' ? 'ok' : i === 'PARCIAL' ? 'warn' : 'bad'
}
function rotuloInfra(i: string) {
  return i === 'SIM' ? 'Com infra' : i === 'PARCIAL' ? 'Parcial' : 'Sem infra'
}
</script>

<style scoped>
.wifi-tec { max-width: 720px; margin: 0 auto; padding: 0 0 40px; }
.page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px; padding: 16px 18px; border-radius: var(--radius-md); background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--sidebar-bg); }
.page-head-left { display: flex; align-items: center; gap: 12px; }
.page-head-icon { color: var(--sidebar-bg); display: flex; align-items: center; }
.page-head h1 { font-size: 1.2rem; color: var(--text-primary); margin: 0 0 2px; }
.meta { font-size: .85rem; color: var(--text-muted); }
.loading { text-align: center; padding: 60px; color: var(--text-muted); }
.kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px; }
.kpi { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px; position: relative; overflow: hidden; }
.kpi::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--blue); }
.kpi.ok::before { background: var(--green); }
.kpi.warn::before { background: var(--amber); }
.kpi.info::before { background: var(--blue); }
.kpi h3 { margin: 0 0 4px; font-size: .68rem; text-transform: uppercase; letter-spacing: .6px; color: var(--text-muted); font-weight: 600; }
.kpi .val { font-size: 1.7rem; font-weight: 700; line-height: 1.1; }
.kpi .sub { font-size: .75rem; color: var(--text-muted); margin-top: 2px; }
.filtros { margin-bottom: 12px; }
.filtros input { width: 100%; background: var(--surface-muted); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; font: inherit; min-height: 42px; }
.card-list { display: flex; flex-direction: column; gap: 10px; }
.visita-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px; cursor: pointer; transition: background .15s; }
.visita-card:active { background: var(--surface-muted); }
.vc-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; }
.vc-head strong { font-size: 1rem; color: var(--text-primary); }
.vc-data { font-size: .8rem; color: var(--text-muted); }
.vc-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
.vc-rack { font-size: .8rem; color: var(--text-muted); }
.badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: .72rem; font-weight: 600; }
.badge.ok { background: var(--green-soft); color: var(--green); }
.badge.warn { background: var(--amber-soft); color: var(--amber); }
.badge.bad { background: var(--red-soft); color: var(--red); }
.badge.info { background: var(--blue-soft); color: var(--blue); }
.empty { text-align: center; color: var(--text-muted); padding: 30px; border: 1.5px dashed var(--border); border-radius: var(--radius-sm); }
.detalhe-ap { display: flex; flex-direction: column; gap: 16px; }
.det-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.det-grid div { background: var(--surface-muted); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
.det-grid span { font-size: .72rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600; }
.det-grid strong { font-size: .95rem; color: var(--text-primary); }
.detalhe-ap h3 { font-size: 1rem; margin: 4px 0 0; }
.ap-list, .sem-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.ap-list li, .sem-list li { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; background: var(--surface); }
.ap-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.ap-sub { font-size: .85rem; color: var(--text-secondary); margin-top: 4px; }
.ap-obs { font-size: .82rem; color: var(--text-muted); margin-top: 4px; font-style: italic; }
.vazio { color: var(--text-muted); font-size: .85rem; }
.obs-box { background: var(--surface-muted); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; }
.obs-box span { font-size: .72rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600; }
.obs-box p { margin: 4px 0 0; font-size: .9rem; color: var(--text-primary); }
.modal-actions { display: flex; justify-content: flex-end; }
.btn { font: inherit; cursor: pointer; border-radius: var(--radius-sm); min-height: 46px; }
.btn-primary { background: var(--sidebar-bg); color: #fff; font-weight: 700; padding: 10px 16px; border: 1.5px solid var(--sidebar-bg); }
.btn-primary:hover { background: #0d2a52; }
</style>
