<template>
  <div class="wifi-levantamento">
    <div class="page-head">
      <div class="page-head-icon"><Wifi :size="22" /></div>
      <div>
        <h1>Levantamento de Access Points</h1>
        <p>Preencha durante a visita. Ao salvar, tudo vai direto para o banco.</p>
      </div>
    </div>

    <div v-if="bannerVisivel" class="banner">
      <span>Há um rascunho não enviado neste aparelho.</span>
      <span class="banner-actions">
        <button class="btn btn-outline" type="button" @click="restaurarRascunho">Continuar rascunho</button>
        <button class="linkbtn" type="button" @click="descartarRascunho">Descartar</button>
      </span>
    </div>

    <!-- Escola e visita -->
    <section class="card-section">
      <h2>Escola e visita</h2>
      <p class="hint">Digite para buscar a escola na lista ou escreva o nome completo.</p>
      <div class="grid">
        <label class="full field">
          Escola <span class="req">*</span>
          <input v-model="visita.escola" list="dl-escolas" autocomplete="off" placeholder="Nome da escola" :class="{ err: erros.escola }" @change="onEscolaChange" />
          <span v-if="erros.escola" class="errmsg">Campo obrigatório</span>
        </label>
        <label class="field">
          Técnico <span class="req">*</span>
          <input v-model="visita.tecnico" readonly class="readonly" placeholder="Seu nome" :class="{ err: erros.tecnico }" />
          <span v-if="erros.tecnico" class="errmsg">Campo obrigatório</span>
        </label>
        <label class="field">
          Data da visita <span class="req">*</span>
          <input type="date" v-model="visita.data" :class="{ err: erros.data }" />
          <span v-if="erros.data" class="errmsg">Campo obrigatório</span>
        </label>
        <label class="field">
          Código da escola (CIE)
          <input v-model="visita.cie" inputmode="numeric" placeholder="Opcional" />
        </label>
      </div>

      <div v-if="escolaCoords" class="geo-cadastrada">
        Coordenadas da escola: {{ escolaCoords.lat.toFixed(6) }}, {{ escolaCoords.lng.toFixed(6) }}
      </div>
    </section>

    <!-- Infraestrutura -->
    <section class="card-section">
      <h2>Infraestrutura</h2>
      <p class="hint">Situação da escola e do link.</p>
      <div class="grid">
        <label class="field">
          Total de salas <span class="req">*</span>
          <input type="number" min="0" inputmode="numeric" v-model="visita.salasTotal" :class="{ err: erros.salasTotal }" />
          <span v-if="erros.salasTotal" class="errmsg">Campo obrigatório</span>
        </label>
        <label class="field">
          Condição do Rack Intragov
          <select v-model="visita.rackCond">
            <option value="">Selecione</option>
            <option>Adequado</option>
            <option>Precisa de adequação</option>
            <option>Inexistente</option>
          </select>
        </label>
      </div>
    </section>

    <!-- APs -->
    <section class="card-section">
      <h2>Access Points instalados</h2>
      <p class="hint">Um cartão por AP. Informe o número que está na etiqueta (ou patrimônio) e onde ele está.</p>
      <div id="listaAps">
        <div v-for="(ap, idx) in aps" :key="ap.id" class="item ap">
          <div class="item-head">
            <strong>AP {{ idx + 1 }}</strong>
            <button type="button" class="linkbtn" @click="removerAp(ap.id)">Remover</button>
          </div>
          <div class="grid">
            <label class="field">
              Nº do AP <span class="req">*</span>
              <input v-model="ap.numero" placeholder="Etiqueta ou patrimônio" :class="{ err: apErros[ap.id]?.numero }" />
              <span v-if="apErros[ap.id]?.numero" class="errmsg">Informe o número do AP</span>
            </label>
            <label class="field">
              Localização <span class="req">*</span>
              <input v-model="ap.local" list="dl-ambientes" placeholder="Ex.: Sala 5, corredor térreo" :class="{ err: apErros[ap.id]?.local }" />
              <span v-if="apErros[ap.id]?.local" class="errmsg">Informe onde ele está</span>
            </label>
            <label class="field full">
              Bloco / andar
              <input v-model="ap.bloco" placeholder="Ex.: Bloco B, 1º andar" />
            </label>
            <div class="field full">
              <label>Status <span class="req">*</span></label>
              <div class="seg" :class="{ err: apErros[ap.id]?.status }">
                <label><input type="radio" :name="'st' + ap.id" value="ON" v-model="ap.status" /><span>ON<br><small>Funcionando</small></span></label>
                <label><input type="radio" :name="'st' + ap.id" value="OFF" v-model="ap.status" /><span>OFF<br><small>Desligado</small></span></label>
                <label><input type="radio" :name="'st' + ap.id" value="DOWN" v-model="ap.status" /><span>DOWN<br><small>Fora do ar</small></span></label>
              </div>
              <span v-if="apErros[ap.id]?.status" class="errmsg">Escolha o status</span>
              <span v-if="apErros[ap.id]?.duplicado" class="errmsg">Número repetido neste levantamento</span>
            </div>
            <label class="field full">
              Observações
              <input v-model="ap.obs" />
            </label>
          </div>
        </div>
      </div>
      <div v-if="aps.length === 0" class="empty">Nenhum AP adicionado. Se a escola não tem AP, deixe vazio e registre as salas abaixo.</div>
      <button type="button" class="btn btn-outline" @click="addAp">+ Adicionar AP</button>
    </section>

    <!-- Salas sem AP -->
    <section class="card-section">
      <h2>Salas sem AP</h2>
      <p class="hint">Registre cada sala ou ambiente sem AP e diga se já existe infraestrutura para instalar um.</p>
      <div id="listaSem">
        <div v-for="(s, idx) in sem" :key="s.id" class="item sem" :data-infra="s.infra">
          <div class="item-head">
            <strong>Sala {{ idx + 1 }}</strong>
            <button type="button" class="linkbtn" @click="removerSem(s.id)">Remover</button>
          </div>
          <div class="grid">
            <label class="field">
              Sala / ambiente <span class="req">*</span>
              <input v-model="s.sala" placeholder="Ex.: Sala 12" :class="{ err: semErros[s.id]?.sala }" />
              <span v-if="semErros[s.id]?.sala" class="errmsg">Informe a sala</span>
            </label>
            <label class="field">
              Tipo
              <select v-model="s.tipo">
                <option value="">Selecione</option>
                <option v-for="t in tiposAmbiente" :key="t" :value="t">{{ t }}</option>
              </select>
            </label>
            <label class="field full">
              Bloco / andar
              <input v-model="s.bloco" placeholder="Ex.: Bloco A, térreo" />
            </label>
            <div class="field full">
              <label>Infraestrutura existente <span class="req">*</span></label>
              <div class="seg" :class="{ err: semErros[s.id]?.infra }">
                <label><input type="radio" :name="'infra' + s.id" value="SIM" v-model="s.infra" /><span>Ponto de rede pronto<br><small>só falta instalar o AP</small></span></label>
                <label><input type="radio" :name="'infra' + s.id" value="PARCIAL" v-model="s.infra" /><span>Infra parcial<br><small>canaleta ou cabo incompleto</small></span></label>
                <label><input type="radio" :name="'infra' + s.id" value="NAO" v-model="s.infra" /><span>Sem infra<br><small>nada instalado</small></span></label>
              </div>
              <span v-if="semErros[s.id]?.infra" class="errmsg">Escolha a infraestrutura existente</span>
            </div>
            <div v-if="s.infra !== 'SIM'" class="field full">
              <label>O que falta para instalar o AP</label>
              <div class="chips">
                <label v-for="f in FALTAS" :key="f">
                  <input type="checkbox" :value="f" v-model="s.falta" />
                  <span>{{ f }}</span>
                </label>
              </div>
            </div>
            <label class="field full">
              Observações
              <input v-model="s.obs" />
            </label>
          </div>
        </div>
      </div>
      <div v-if="sem.length === 0" class="empty">Nenhuma sala adicionada.</div>
      <button type="button" class="btn btn-outline" @click="addSem">+ Adicionar sala sem AP</button>

      <details class="bulk">
        <summary>Adicionar várias salas de uma vez</summary>
        <div class="grid">
          <label class="field full">
            Uma sala por linha
            <textarea v-model="bulkSalas" placeholder="Sala 1&#10;Sala 2&#10;Sala 3"></textarea>
          </label>
          <div class="field full">
            <label>Infraestrutura dessas salas</label>
            <div class="seg">
              <label><input type="radio" value="SIM" v-model="bulkInfra" /><span>Ponto de rede pronto</span></label>
              <label><input type="radio" value="PARCIAL" v-model="bulkInfra" /><span>Infra parcial</span></label>
              <label><input type="radio" value="NAO" v-model="bulkInfra" /><span>Sem infra</span></label>
            </div>
          </div>
          <div class="field full">
            <button type="button" class="btn btn-outline" @click="bulkAdd">Adicionar essas salas</button>
          </div>
        </div>
      </details>
    </section>

    <!-- Observações -->
    <section class="card-section">
      <h2>Observações gerais</h2>
      <label class="field">
        Pendências, riscos ou o que mais o time precisa saber
        <textarea v-model="visita.obs"></textarea>
      </label>
    </section>



    <!-- Barra inferior -->
    <div class="bar">
      <div class="counts">
        <span><b>{{ aps.length }}</b> APs instalados</span>
        <span><b>{{ sem.length }}</b> salas sem AP</span>
      </div>
      <button type="button" class="btn btn-primary" :disabled="salvando" @click="salvar">
        {{ salvando ? 'Salvando…' : 'Salvar levantamento' }}
      </button>
    </div>

    <datalist id="dl-escolas">
      <option v-for="e in escolas" :key="e" :value="e" />
    </datalist>
    <datalist id="dl-tecnicos">
      <option v-for="t in tecnicos" :key="t" :value="t" />
    </datalist>
    <datalist id="dl-ambientes">
      <option v-for="a in tiposAmbiente" :key="a" :value="a" />
    </datalist>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Wifi } from '@lucide/vue'
import { chamadosApi } from '@/api/http'
import { LINKS_INTERNET } from '@/data/linksInternetData'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { listarEscolas } from '@/api/usuarios'
import { listarUltimasVisitasWifi, salvarLevantamento } from '@/api/wifi'
import { listarUsuarios } from '@/api/usuarios'

const auth = useAuthStore()
const ui = useUiStore()

const FALTAS = ['Cabo de rede', 'Canaleta / eletroduto', 'Ponto elétrico', 'Porta no switch / rack', 'Ponto de rede (tomada)', 'Suporte / fixação']
const tiposAmbiente = ['Sala de aula', 'Sala de informática', 'Biblioteca / sala de leitura', 'Laboratório', 'Secretaria', 'Direção', 'Sala dos professores', 'Coordenação', 'Refeitório', 'Quadra / pátio', 'Corredor', 'Auditório', 'Sala de recursos', 'Outro']

const KEY = 'infra_wifi_rascunho_v2'
let seq = 0

const escolas = ref<string[]>([])
const escolasCompletas = ref<any[]>([])
const escolaCoords = ref<{ lat: number; lng: number } | null>(null)
const tecnicos = ref<string[]>([])
const salvando = ref(false)
const bannerVisivel = ref(false)
const rascunho = ref<any>(null)

const visita = ref<any>({
  escola: '',
  tecnico: auth.user?.nome || '',
  data: hoje(),
  cie: '',
  salasTotal: '',
  rackCond: '',
  obs: '',
  lat: '',
  lng: '',
})

const aps = ref<any[]>([])
const sem = ref<any[]>([])

const apErros = ref<Record<string, any>>({})
const semErros = ref<Record<string, any>>({})
const erros = ref<Record<string, boolean>>({})

const bulkSalas = ref('')
const bulkInfra = ref('NAO')

const ultimas = ref<any[]>([])
const carregandoHist = ref(false)

function hoje() {
  const d = new Date()
  const m = ('0' + (d.getMonth() + 1)).slice(-2)
  const dd = ('0' + d.getDate()).slice(-2)
  return d.getFullYear() + '-' + m + '-' + dd
}

function addAp(d: any = {}) {
  const id = ++seq
  const item = { id, numero: d.numero ?? '', local: d.local ?? '', bloco: d.bloco ?? '', status: d.status ?? '', obs: d.obs ?? '' }
  aps.value.push(item)
  return item
}

function addSem(d: any = {}) {
  const id = ++seq
  const item = { id, sala: d.sala ?? '', tipo: d.tipo ?? '', bloco: d.bloco ?? '', infra: d.infra ?? '', falta: d.falta ? [...d.falta] : [], obs: d.obs ?? '' }
  sem.value.push(item)
  return item
}

function removerAp(id: number) {
  const item = aps.value.find((a) => a.id === id)
  const temDado = !!(item && (item.numero || item.local || item.bloco || item.obs))
  if (temDado && !window.confirm('Remover este item?')) return
  aps.value = aps.value.filter((a) => a.id !== id)
  delete apErros.value[id]
  agendaRascunho()
}

function removerSem(id: number) {
  const item = sem.value.find((s) => s.id === id)
  const temDado = !!(item && (item.sala || item.bloco || item.obs))
  if (temDado && !window.confirm('Remover este item?')) return
  sem.value = sem.value.filter((s) => s.id !== id)
  delete semErros.value[id]
  agendaRascunho()
}

function bulkAdd() {
  const linhas = bulkSalas.value.split('\n').map((s) => s.trim()).filter(Boolean)
  if (!linhas.length) {
    ui.error('Digite pelo menos uma sala.')
    return
  }
  linhas.forEach((s) => addSem({ sala: s, infra: bulkInfra.value }))
  bulkSalas.value = ''
  ui.success(linhas.length + ' sala(s) adicionada(s).')
  agendaRascunho()
}



function limparErros() {
  erros.value = {}
  apErros.value = {}
  semErros.value = {}
}

function validar(): boolean {
  limparErros()
  let primeiro: any = null
  const falhaCampo = (nome: string) => {
    erros.value[nome] = true
    if (!primeiro) primeiro = nome
  }

  if (!visita.value.escola.trim()) falhaCampo('escola')
  if (!visita.value.tecnico.trim()) falhaCampo('tecnico')
  if (!visita.value.data.trim()) falhaCampo('data')
  if (String(visita.value.salasTotal).trim() === '') falhaCampo('salasTotal')

  const vistos: Record<string, boolean> = {}
  for (const ap of aps.value) {
    const e: any = {}
    if (!ap.numero.trim()) e.numero = true
    if (!ap.local.trim()) e.local = true
    if (!ap.status) e.status = true
    const k = ap.numero.trim().toLowerCase()
    if (k) {
      if (vistos[k]) e.duplicado = true
      vistos[k] = true
    }
    if (Object.keys(e).length) {
      apErros.value[ap.id] = e
      if (!primeiro) primeiro = 'ap:' + ap.id
    }
  }

  for (const s of sem.value) {
    const e: any = {}
    if (!s.sala.trim()) e.sala = true
    if (!s.infra) e.infra = true
    if (Object.keys(e).length) {
      semErros.value[s.id] = e
      if (!primeiro) primeiro = 'sem:' + s.id
    }
  }

  if (primeiro) {
    ui.error('Falta preencher campos obrigatórios (marcados em vermelho).')
    return false
  }
  return true
}

function collect() {
  return {
    visita: { ...visita.value },
    aps: aps.value.map((a) => ({
      numero: a.numero,
      local: a.local,
      bloco: a.bloco,
      status: a.status,
      obs: a.obs,
    })),
    semAp: sem.value.map((s) => ({
      sala: s.sala,
      tipo: s.tipo,
      bloco: s.bloco,
      infra: s.infra,
      falta: s.infra === 'SIM' ? [] : [...s.falta],
      obs: s.obs,
    })),
  }
}

async function salvar() {
  if (salvando.value) return
  if (!validar()) return
  const p = collect()
  if (!p.aps.length && !p.semAp.length) {
    if (!window.confirm('Nenhum AP nem sala sem AP foi registrado. Salvar assim mesmo?')) return
  }
  salvando.value = true
  try {
    const r = await salvarLevantamento(p)
    try { localStorage.removeItem(KEY) } catch {}
    ui.success(`Levantamento salvo — ${r.escola} (protocolo ${r.id})`)
    // reset
    novo()
  } catch (e: any) {
    ui.error(e?.response?.data?.message || e?.message || 'Não foi possível salvar.')
  } finally {
    salvando.value = false
  }
}

function novo() {
  visita.value = { escola: '', tecnico: auth.user?.nome || '', data: hoje(), cie: '', salasTotal: '', rackCond: '', obs: '', lat: '', lng: '' }
  aps.value = []
  sem.value = []
  limparErros()
  carregarHist()
}

// rascunho
let tSave: any
function agendaRascunho() {
  clearTimeout(tSave)
  tSave = setTimeout(() => {
    try {
      const p = collect()
      if (p.visita.escola || p.aps.length || p.semAp.length) localStorage.setItem(KEY, JSON.stringify(p))
    } catch {}
  }, 800)
}

function restaurarRascunho() {
  if (!rascunho.value) return
  const p = rascunho.value
  Object.keys(p.visita || {}).forEach((k) => {
    if (visita.value[k] !== undefined) visita.value[k] = p.visita[k]
  })
  ;(p.aps || []).forEach((a: any) => addAp(a))
  ;(p.semAp || []).forEach((s: any) => addSem(s))
    if (p.visita?.lat && p.visita?.lng) {
      // coordenadas restauradas do rascunho
    }
  bannerVisivel.value = false
}

function descartarRascunho() {
  try { localStorage.removeItem(KEY) } catch {}
  bannerVisivel.value = false
  rascunho.value = null
}

function checaRascunho() {
  let raw: string | null = null
  try { raw = localStorage.getItem(KEY) } catch {}
  if (!raw) return
  try {
    rascunho.value = JSON.parse(raw)
    bannerVisivel.value = true
  } catch {}
}

async function carregarHist() {
  carregandoHist.value = true
  try {
    ultimas.value = await listarUltimasVisitasWifi()
  } catch {
    ultimas.value = []
  } finally {
    carregandoHist.value = false
  }
}

// watchers for draft
watch([visita, aps, sem], () => agendaRascunho(), { deep: true })

function normalizarNome(s: string): string {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

function aplicarDadosEscola(nome: string) {
  const n = normalizarNome(String(nome || ''))
  const found = escolasCompletas.value.find((e: any) => normalizarNome(String(e.nome || '')) === n)
  if (found && (found.latitude != null || found.longitude != null)) {
    escolaCoords.value = { lat: Number(found.latitude), lng: Number(found.longitude) }
    visita.value.lat = Number(found.latitude).toFixed(6)
    visita.value.lng = Number(found.longitude).toFixed(6)
  } else {
    escolaCoords.value = null
  }
  let link = LINKS_INTERNET.find((l: any) => normalizarNome(String(l.escola || '')) === n)
  if (!link) link = LINKS_INTERNET.find((l: any) => normalizarNome(String(l.escola || '')).includes(n) || n.includes(normalizarNome(String(l.escola || ''))))
  if (link?.cie) visita.value.cie = link.cie
}

watch(() => visita.value.escola, (nome) => aplicarDadosEscola(String(nome || '')))

function onEscolaChange(e: Event) {
  aplicarDadosEscola((e.target as HTMLInputElement).value)
}

onMounted(async () => {
  try {
    escolas.value = await listarEscolas()
  } catch {
    escolas.value = []
  }
  try {
    const { data } = await chamadosApi.get('/escolas')
    escolasCompletas.value = Array.isArray(data) ? data : []
  } catch {
    escolasCompletas.value = []
  }

  if (auth.user?.nome && !visita.value.tecnico) visita.value.tecnico = auth.user.nome
  try {
    const res = await listarUsuarios({ nivel: 'TECNICO', limit: 100 })
    tecnicos.value = (res?.data || []).map((u: any) => u.nome)
  } catch {
    tecnicos.value = []
  }
  if (!tecnicos.value.includes(visita.value.tecnico) && visita.value.tecnico) tecnicos.value.unshift(visita.value.tecnico)
  checaRascunho()
  await carregarHist()
})
</script>

<style scoped>
.wifi-levantamento { max-width: 920px; margin: 0 auto; padding: 0 0 140px; }
@media (max-width: 640px) {
  .wifi-levantamento { padding: 0 0 160px; }
  .grid { grid-template-columns: 1fr; }
  .seg { grid-template-columns: 1fr; }
  .bar { flex-direction: column; align-items: stretch; gap: 8px; }
  .bar .btn-primary { min-width: 0; width: 100%; }
  .banner { flex-direction: column; align-items: stretch; }
  .banner-actions { justify-content: stretch; }
  .banner-actions .btn, .banner-actions .linkbtn { flex: 1; }
  .item-head { flex-wrap: wrap; gap: 8px; }
  .hist { font-size: .8rem; }
}
.page-head { margin-bottom: 14px; display: flex; align-items: center; gap: 12px; padding: 16px 18px; border-radius: var(--radius-md); background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--sidebar-bg); }
.page-head-icon { color: var(--sidebar-bg); display: flex; align-items: center; }
.page-head h1 { margin: 0 0 4px; font-size: 1.35rem; color: var(--text-primary); }
.page-head p { margin: 0; color: var(--text-muted); font-size: .95rem; }
.card-section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); margin: 14px 0; padding: 16px; }
.card-section h2 { margin: 0 0 4px; font-size: 1.15rem; }
.hint { margin: 0 0 14px; color: var(--text-muted); font-size: .93rem; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.full { grid-column: 1 / -1; }
@media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
.field { display: flex; flex-direction: column; gap: 4px; margin: 0; font-weight: 700; font-size: .92rem; }
.field label { font-weight: 700; }
.req { color: var(--red); }
.input, select, textarea { /* reuse global */ }
input, select, textarea { display: block; width: 100%; margin-top: 4px; padding: 11px 14px; font: inherit; font-weight: 400; color: var(--text-primary); background: var(--surface); border: 1.5px solid var(--border-strong); border-radius: var(--radius-sm); min-height: 46px; }
input.readonly { background: var(--surface-muted); color: var(--text-secondary); cursor: not-allowed; }
select { appearance: none; -webkit-appearance: none; -moz-appearance: none; padding-right: 44px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; background-size: 18px; cursor: pointer; }
select:focus { border-color: var(--sidebar-bg); box-shadow: 0 0 0 3px rgb(8 26 51 / 0.12); }
textarea { min-height: 84px; resize: vertical; }
.err { border-color: var(--red) !important; background: var(--red-soft); }
.errmsg { color: var(--red); font-size: .85rem; font-weight: 400; margin-top: 2px; }
.btn { font: inherit; cursor: pointer; border-radius: var(--radius-sm); min-height: 46px; }
.btn-outline { border: 1.5px solid var(--border-strong); background: var(--surface); color: var(--text-secondary); font-weight: 700; padding: 10px 16px; }
.btn-outline:hover { background: var(--surface-muted); }
.btn-primary { background: var(--sidebar-bg); color: #fff; font-weight: 700; padding: 10px 16px; border: 1.5px solid var(--sidebar-bg); }
.btn-primary:hover { background: #0d2a52; }
.btn-primary:disabled { opacity: .6; cursor: wait; }
.linkbtn { border: 0; background: none; color: var(--red); font-weight: 700; min-height: 36px; padding: 4px 8px; cursor: pointer; }
.item { border: 1px solid var(--border); border-left-width: 6px; border-radius: var(--radius-sm); padding: 12px; margin: 12px 0; background: var(--surface-muted); }
.item.ap { border-left-color: var(--blue); }
.item.sem[data-infra="SIM"] { border-left-color: var(--green); }
.item.sem[data-infra="PARCIAL"] { border-left-color: var(--amber); }
.item.sem[data-infra="NAO"] { border-left-color: var(--red); }
.item.sem:not([data-infra]) { border-left-color: var(--border); }
.item-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 4px; }
@media (max-width: 560px) { .seg { grid-template-columns: 1fr; } }
.seg label { margin: 0; font-weight: 400; }
.seg input { position: absolute; opacity: 0; width: 1px; height: 1px; min-height: 0; }
.seg span { display: block; text-align: center; padding: 10px 8px; border: 1.5px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); font-size: .9rem; cursor: pointer; min-height: 46px; }
.seg input[value="SIM"]:checked + span { background: var(--green-soft); border-color: var(--green); color: var(--green); font-weight: 700; }
.seg input[value="PARCIAL"]:checked + span { background: var(--amber-soft); border-color: var(--amber); color: var(--amber); font-weight: 700; }
.seg input[value="NAO"]:checked + span { background: var(--red-soft); border-color: var(--red); color: var(--red); font-weight: 700; }
.seg input[value="ON"]:checked + span { background: var(--green-soft); border-color: var(--green); color: var(--green); font-weight: 700; }
.seg input[value="OFF"]:checked + span { background: var(--amber-soft); border-color: var(--amber); color: var(--amber); font-weight: 700; }
.seg input[value="DOWN"]:checked + span { background: var(--red-soft); border-color: var(--red); color: var(--red); font-weight: 700; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.chips label { margin: 0; font-weight: 400; position: relative; }
.chips input { position: absolute; opacity: 0; width: 1px; height: 1px; min-height: 0; }
.chips span { display: inline-block; padding: 8px 12px; border: 1.5px solid var(--border); border-radius: 99px; background: var(--surface); font-size: .9rem; cursor: pointer; }
.chips input:checked + span { background: var(--text-primary); color: var(--surface); border-color: var(--text-primary); }
.empty { padding: 16px; border: 1.5px dashed var(--border); border-radius: var(--radius-sm); color: var(--text-muted); text-align: center; margin: 12px 0; }
details.bulk { margin-top: 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; background: var(--surface-muted); }
details.bulk summary { cursor: pointer; font-weight: 700; min-height: 32px; }
details.bulk .grid { margin-top: 10px; }
.geo-block { margin-top: 12px; }
.geo-box { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.geo-status { font-size: .9rem; color: var(--text-muted); }
.geo-ok { color: var(--green); font-weight: 700; }
.geo-cadastrada { font-size: .85rem; color: var(--text-secondary); margin-bottom: 6px; padding: 8px 10px; background: var(--surface-muted); border: 1px solid var(--border); border-radius: var(--radius-sm); }
.geo-comparacao { margin-top: 6px; font-size: .88rem; font-weight: 600; }
.geo-bad { color: var(--red); }
.bar { position: fixed; left: 0; right: 0; bottom: 0; background: var(--sidebar-bg); color: #fff; padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px)); display: flex; gap: 12px; align-items: center; justify-content: space-between; z-index: 10; }
.bar .counts { display: flex; flex-direction: column; font-size: .88rem; color: #D3DBE2; line-height: 1.3; }
.bar .counts b { color: #fff; }
.bar .btn-primary { background: #fff; color: var(--sidebar-bg); border-color: #fff; min-width: 170px; }
.banner { display: flex; margin: 14px 0; padding: 12px 14px; border-radius: var(--radius-sm); background: var(--amber-soft); border: 1px solid var(--amber); gap: 8px; flex-wrap: wrap; align-items: center; justify-content: space-between; }
.banner-actions { display: flex; gap: 8px; }
.toast {} 
.hist { width: 100%; border-collapse: collapse; font-size: .9rem; }
.hist td, .hist th { padding: 6px 4px; border-bottom: 1px solid var(--border); text-align: left; }
.seg.err { outline: 3px solid var(--red); }
</style>
