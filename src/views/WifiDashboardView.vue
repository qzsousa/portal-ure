<template>
  <div class="wifi-dashboard">
    <div class="page-head">
      <div class="page-head-left">
        <div class="page-head-icon"><Wifi :size="22" /></div>
        <div>
          <h1>Painel - Access Points</h1>
          <div class="meta">Atualizado em {{ atualizado }}</div>
        </div>
      </div>
      <button class="btn btn-primary" type="button" @click="router.push('/wifi')">+ Novo levantamento</button>
    </div>

    <div v-if="carregando" class="loading">Carregando dados do painel…</div>

    <div v-else>
      <div class="kpi-grid">
        <div v-for="k in kpis" :key="k.t" class="kpi" :class="k.c">
          <h3>{{ k.t }}</h3>
          <div class="val">{{ k.v }}</div>
          <div class="sub">{{ k.s }}</div>
        </div>
      </div>

      <div class="progress-box card">
        <h2>Progresso das visitas</h2>
        <div class="progress-bar"><div class="progress-fill" :style="{ width: pct + '%' }"></div></div>
        <div class="progress-legend">
          <span><b>{{ pct.toFixed(1) }}%</b> das escolas visitadas</span>
          <span><b>{{ visitadas }}</b> de <b>{{ total }}</b> • faltam <b>{{ faltam }}</b></span>
        </div>
        <div v-if="pendentes.length" class="pend-wrap">
          <div class="pend-title">Escolas ainda não visitadas:</div>
          <div class="chips-pend">
            <span v-for="p in pendentes" :key="p">{{ p }}</span>
          </div>
        </div>
        <div v-else class="pend-ok">🎉 Todas as escolas foram visitadas!</div>
      </div>



      <div class="table-card card">
        <h2>Detalhamento por escola</h2>
        <div class="filtros">
          <input v-model="busca" placeholder="Buscar escola, técnico…" />
          <select v-model="ordem">
            <option value="escola">Ordem alfabética</option>
            <option value="data">Data da visita</option>
            <option value="semAp">Mais salas sem AP</option>
            <option value="aps">Mais APs</option>
          </select>
        </div>
        <div class="tbl-scroll">
          <table class="det">
            <thead>
              <tr>
                <th>Escola</th><th>Data</th><th>Técnico</th>
                <th>Salas</th><th>Sem AP</th><th>Com infra</th><th>Parcial</th><th>Sem infra</th>
                <th>APs</th><th>ON</th><th>OFF</th><th>DOWN</th><th>Rack</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="escolasFiltradas.length === 0">
                <td colspan="13" class="empty-cell">Nenhum registro.</td>
              </tr>
              <tr v-for="e in escolasFiltradas" :key="e.id" class="row-click" @click="abrirDetalhe(e)">
                <td><b>{{ e.escola }}</b><span v-if="e.visitas > 1" class="badge info">{{ e.visitas }} visitas</span></td>
                <td>{{ e.data }}</td>
                <td>{{ e.tecnico }}</td>
                <td>{{ e.salas }}</td>
                <td>{{ e.semAp }}</td>
                <td>{{ e.com }}</td>
                <td>{{ e.parcial }}</td>
                <td>{{ e.sem }}</td>
                <td>{{ e.aps }}</td>
                <td><span class="badge ok">{{ e.on }}</span></td>
                <td><span class="badge warn">{{ e.off }}</span></td>
                <td><span class="badge bad">{{ e.down }}</span></td>
                <td><span v-if="e.rack" class="badge" :class="rackBadge(e.rack)">{{ e.rack }}</span><span v-else>—</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <BaseModal :aberto="modalAberto" :titulo="visitaModal ? visitaModal.escola : 'Detalhes'" @fechar="modalAberto = false">
        <div v-if="visitaModal" class="detalhe-ap">
          <div class="det-grid">
            <div><span>Data</span><strong>{{ visitaModal.data }}</strong></div>
            <div><span>Técnico</span><strong>{{ visitaModal.tecnico }}</strong></div>
            <div><span>Salas</span><strong>{{ visitaModal.salas }}</strong></div>
            <div><span>Sem AP</span><strong>{{ visitaModal.semAp }}</strong></div>
            <div><span>APs</span><strong>{{ visitaModal.aps }}</strong></div>
            <div><span>Rack</span><strong>{{ visitaModal.rack || '—' }}</strong></div>
          </div>

          <h3>Access Points instalados</h3>
          <div v-if="!visitaModal.listaAps?.length" class="vazio">Nenhum AP registrado.</div>
          <ul v-else class="ap-list">
            <li v-for="a in visitaModal.listaAps" :key="a.id">
              <div class="ap-head">
                <strong>{{ a.numero }}</strong>
                <span class="badge" :class="statusBadge(a.status)">{{ a.status }}</span>
              </div>
              <div class="ap-sub">{{ a.local }}<template v-if="a.bloco"> · {{ a.bloco }}</template></div>
              <div v-if="a.obs" class="ap-obs">{{ a.obs }}</div>
            </li>
          </ul>

          <h3>Salas sem AP</h3>
          <div v-if="!visitaModal.listaSem?.length" class="vazio">Nenhuma sala registrada.</div>
          <ul v-else class="sem-list">
            <li v-for="s in visitaModal.listaSem" :key="s.id">
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
import { listarEscolas } from '@/api/usuarios'



const TOTAL = 72
const total = TOTAL

const router = useRouter()
const carregando = ref(true)
const visitas = ref<any[]>([])
const escolasLista = ref<string[]>([])
const busca = ref('')
const ordem = ref('escola')
const modalAberto = ref(false)
const visitaModal = ref<any>(null)
const atualizado = ref('')

onMounted(async () => {
  try {
    visitas.value = await listarVisitasWifi()
  } catch {
    visitas.value = []
  }
  try {
    escolasLista.value = await listarEscolas()
  } catch {
    escolasLista.value = []
  }
  atualizado.value = new Date().toLocaleString('pt-BR')
  carregando.value = false
})

// agregar por escola (última visita)
const escolasAgg = computed(() => {
  const ultima: Record<string, any> = {}
  const qtd: Record<string, number> = {}
  for (const r of visitas.value) {
    const nome = String(r.escola || '').trim()
    if (!nome) continue
    const k = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
    qtd[k] = (qtd[k] || 0) + 1
    const reg = new Date(r.createdAt).getTime()
    if (!ultima[k] || reg >= ultima[k].reg) ultima[k] = { reg, r, nome, visitas: qtd[k] }
    ultima[k].visitas = qtd[k]
  }
  return Object.values(ultima).map((u: any) => {
    const r = u.r
    const d = r.dataVisita ? new Date(r.dataVisita) : null
    return {
      id: r.id,
      escola: u.nome,
      visitas: u.visitas,
      data: d ? d.toLocaleDateString('pt-BR') : '',
      dataIso: d ? d.toISOString().slice(0, 10) : '',
      tecnico: String(r.tecnico || ''),
      salas: Number(r.salasTotal) || 0,
      rack: String(r.rackCond || ''),
      aps: Number(r.totalAps) || 0,
      on: Number(r.apsOn) || 0,
      off: Number(r.apsOff) || 0,
      down: Number(r.apsDown) || 0,
      semAp: Number(r.salasSemAp) || 0,
      com: Number(r.semApComInfra) || 0,
      parcial: Number(r.semApParcial) || 0,
      sem: Number(r.semApSemInfra) || 0,
      lat: r.latitude,
      lng: r.longitude,
    }
  })
})

const visitadas = computed(() => escolasAgg.value.length)
const faltam = computed(() => Math.max(0, TOTAL - visitadas.value))
const pct = computed(() => TOTAL ? Math.min(100, (visitadas.value / TOTAL) * 100) : 0)

const pendentes = computed(() => {
  const keys = new Set(escolasAgg.value.map((e) => e.escola.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()))
  return (escolasLista.value || []).filter((nome) => !keys.has(nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()))
})

const soma = (c: string) => escolasAgg.value.reduce((t: number, e: any) => t + (e[c] || 0), 0)

const kpis = computed(() => {
  const k = {
    salas: soma('salas'),
    semAp: soma('semAp'),
    com: soma('com'),
    parcial: soma('parcial'),
    sem: soma('sem'),
    aps: soma('aps'),
    on: soma('on'),
    off: soma('off'),
    down: soma('down'),
  }
  return [
    { t: 'Escolas visitadas', v: `${visitadas.value} / ${TOTAL}`, s: `${pct.value.toFixed(1)}% concluído`, c: 'ok' },
    { t: 'Total de salas', v: k.salas.toLocaleString('pt-BR'), s: 'nas escolas visitadas', c: 'info' },
    { t: 'Salas sem AP', v: k.semAp.toLocaleString('pt-BR'), s: 'precisam de atenção', c: 'warn' },
    { t: 'Com ponto de rede pronto', v: k.com.toLocaleString('pt-BR'), s: 'só falta instalar o AP', c: 'ok' },
    { t: 'Infra parcial', v: k.parcial.toLocaleString('pt-BR'), s: 'canaleta/cabo incompleto', c: 'warn' },
    { t: 'Sem nenhuma infra', v: k.sem.toLocaleString('pt-BR'), s: 'requer obra completa', c: 'bad' },
    { t: 'APs instalados', v: k.aps.toLocaleString('pt-BR'), s: 'total registrado', c: 'info' },
    { t: 'APs ON / OFF / DOWN', v: `${k.on} / ${k.off} / ${k.down}`, s: 'funcionando / desligado / fora', c: 'ok' },
  ]
})


// table
const escolasFiltradas = computed(() => {
  let lista = [...escolasAgg.value]
  const b = busca.value.toLowerCase()
  if (b) lista = lista.filter((e) => (e.escola + ' ' + e.tecnico).toLowerCase().includes(b))
  if (ordem.value === 'escola') lista.sort((a, b) => a.escola.localeCompare(b.escola))
  else if (ordem.value === 'data') lista.sort((a, b) => (b.dataIso || '').localeCompare(a.dataIso || ''))
  else if (ordem.value === 'semAp') lista.sort((a, b) => b.semAp - a.semAp)
  else if (ordem.value === 'aps') lista.sort((a, b) => b.aps - a.aps)
  return lista
})

function rackBadge(r: string) {
  if (r === 'Adequado') return 'ok'
  if (r === 'Precisa de adequação') return 'warn'
  if (r === 'Inexistente') return 'bad'
  return 'info'
}

function abrirDetalhe(e: any) {
  const v = visitas.value.find((x: any) => x.id === e.id)
  if (!v) return
  visitaModal.value = {
    ...e,
    listaAps: v.aps || [],
    listaSem: v.salasSem || [],
    obs: v.obs,
  }
  modalAberto.value = true
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
.wifi-dashboard { max-width: 1400px; margin: 0 auto; padding: 0 0 60px; }
.page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px; padding: 16px 18px; border-radius: var(--radius-md); background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--sidebar-bg); }
.page-head-left { display: flex; align-items: center; gap: 12px; }
.page-head-icon { color: var(--sidebar-bg); display: flex; align-items: center; }
.page-head h1 { font-size: 1.25rem; color: var(--text-primary); }
.meta { font-size: .85rem; color: var(--text-muted); }
@media (max-width: 640px) {
  .page-head { flex-direction: column; align-items: stretch; }
  .page-head .btn { width: 100%; }
  .filtros { flex-direction: column; }
  .filtros input, .filtros select { width: 100%; }
  .kpi-grid { grid-template-columns: 1fr 1fr; }
  .chart-box { height: 220px; }
  .tbl-scroll { max-height: 360px; }
}
.loading { text-align: center; padding: 60px; color: var(--text-muted); }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
.kpi { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; position: relative; overflow: hidden; }
.kpi::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--blue); }
.kpi.ok::before { background: var(--green); }
.kpi.warn::before { background: var(--amber); }
.kpi.bad::before { background: var(--red); }
.kpi.info::before { background: var(--blue); }
.kpi h3 { margin: 0 0 6px; font-size: .7rem; text-transform: uppercase; letter-spacing: .6px; color: var(--text-muted); font-weight: 600; }
.kpi .val { font-size: 1.9rem; font-weight: 700; line-height: 1.1; }
.kpi .sub { font-size: .78rem; color: var(--text-muted); margin-top: 2px; }
.progress-box { padding: 20px; margin-bottom: 20px; }
.progress-box h2 { margin: 0 0 12px; font-size: 1rem; }
.progress-bar { height: 16px; background: var(--surface-muted); border-radius: 99px; overflow: hidden; border: 1px solid var(--border); }
.progress-fill { height: 100%; background: linear-gradient(90deg, var(--blue), var(--green)); transition: width .8s ease; border-radius: 99px; }
.progress-legend { display: flex; justify-content: space-between; margin-top: 8px; font-size: .82rem; color: var(--text-muted); }
.progress-legend b { color: var(--text-primary); }
.pend-wrap { margin-top: 14px; }
.pend-title { font-size: .82rem; color: var(--text-muted); margin-bottom: 6px; }
.chips-pend { display: flex; flex-wrap: wrap; gap: 6px; }
.chips-pend span { background: var(--surface-muted); border: 1px solid var(--border); border-radius: 99px; padding: 4px 10px; font-size: .78rem; color: var(--text-muted); }
.pend-ok { margin-top: 14px; color: var(--green); font-weight: 600; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
@media (max-width: 820px) { .grid-2 { grid-template-columns: 1fr; } }
.chart-card { padding: 18px; }
.chart-card h2 { margin: 0 0 14px; font-size: .95rem; font-weight: 600; }
.chart-box { height: 260px; }
.table-card { padding: 18px; margin-bottom: 20px; overflow: hidden; }
.table-card h2 { margin: 0 0 14px; font-size: .95rem; font-weight: 600; }
.filtros { display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.filtros input, .filtros select { background: var(--surface-muted); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 12px; font: inherit; min-height: 38px; }
.filtros input { flex: 1; min-width: 200px; }
.tbl-scroll { max-height: 520px; overflow: auto; border-radius: var(--radius-sm); border: 1px solid var(--border); }
.det { width: 100%; border-collapse: collapse; font-size: .85rem; }
.det th { text-align: left; padding: 10px 8px; border-bottom: 2px solid var(--border); color: var(--text-muted); font-weight: 600; font-size: .72rem; text-transform: uppercase; letter-spacing: .5px; position: sticky; top: 0; background: var(--surface); cursor: pointer; }
.det td { padding: 10px 8px; border-bottom: 1px solid var(--border); }
.det tr:hover { background: var(--surface-muted); }
.badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: .72rem; font-weight: 600; }
.badge.ok { background: var(--green-soft); color: var(--green); }
.badge.warn { background: var(--amber-soft); color: var(--amber); }
.badge.bad { background: var(--red-soft); color: var(--red); }
.badge.info { background: var(--blue-soft); color: var(--blue); }
.empty-cell { text-align: center; color: var(--text-muted); padding: 30px; }
.row-click { cursor: pointer; }
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
</style>
