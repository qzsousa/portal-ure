<script setup lang="ts">
import { computed, onMounted, reactive, ref, type ComponentPublicInstance } from 'vue'
import { CalendarDays, ChevronLeft, ChevronRight, Info } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { listarTecnicos, type TecnicoDestino } from '@/api/chamados'
import { listarEscolas } from '@/api/usuarios'
import { ordenarTecnicos } from '@/utils/tecnicos'
import { useAuthStore } from '@/stores/auth'

/* Mesmas constantes de AppTopbar.vue, espelhadas porque o AppTopbar está fora
   do escopo desta task. Pendência: extrair para src/utils/calendario.ts quando
   o topbar puder ser editado — os dois precisam contar os mesmos nomes. */
const DIAS_SEMANA = [
  'Domingo',
  'Segunda-Feira',
  'Terça-Feira',
  'Quarta-Feira',
  'Quinta-Feira',
  'Sexta-Feira',
  'Sábado',
]
const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]
/** Cabeçalho das colunas, derivado dos mesmos nomes ("Domingo" → "Dom"). */
const DIAS_SEMANA_CURTO = DIAS_SEMANA.map((d) => d.slice(0, 3))

/** Atribuição de um dia: escola atendida + técnico responsável. */
interface Atribuicao {
  escola: string
  tecnicoId: string
  tecnicoNome: string
}

const STORAGE_KEY = 'agenda-atendimento-v1'

/* ---------- Estado ---------- */
const estado = reactive({
  loading: true,
  erro: '',
  escolas: [] as string[],
  tecnicos: [] as TecnicoDestino[],
})

/** Atribuições por dia (chave = "yyyy-mm-dd"). */
const atribuicoes = reactive<Record<string, Atribuicao>>({})

const auth = useAuthStore()
/** Remover atribuição é decisão da matriz: só o ADMIN desfaz o dia. */
const podeRemover = computed(() => auth.user?.nivel === 'ADMIN')

/* ---------- Mês exibido ---------- */
const hoje = new Date()
const anoMes = reactive({ ano: hoje.getFullYear(), mes: hoje.getMonth() })

const tituloMes = computed(() => `${MESES[anoMes.mes]} de ${anoMes.ano}`)

function mesAnterior() {
  if (anoMes.mes === 0) {
    anoMes.mes = 11
    anoMes.ano--
  } else {
    anoMes.mes--
  }
  ajustarFoco()
}

function proximoMes() {
  if (anoMes.mes === 11) {
    anoMes.mes = 0
    anoMes.ano++
  } else {
    anoMes.mes++
  }
  ajustarFoco()
}

function irParaHoje() {
  anoMes.ano = hoje.getFullYear()
  anoMes.mes = hoje.getMonth()
  ajustarFoco()
}

/* ---------- Células do calendário (construído do zero, sem biblioteca) ---------- */
interface CelulaDia {
  dia: number
  iso: string
  mesAtual: boolean
  ehHoje: boolean
  escola: string
  tecnicoNome: string
}

/** "yyyy-mm-dd" em horário local — evita virada de dia por fuso. */
function isoDe(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dia}`
}

function mesmoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

const celulas = computed<CelulaDia[]>(() => {
  const primeiro = new Date(anoMes.ano, anoMes.mes, 1)
  const offset = primeiro.getDay() // 0 = Domingo
  const diasNoMes = new Date(anoMes.ano, anoMes.mes + 1, 0).getDate()
  const diasMesAnterior = new Date(anoMes.ano, anoMes.mes, 0).getDate()
  const saida: CelulaDia[] = []

  // Dias do mês anterior que completam a primeira semana.
  for (let i = offset - 1; i >= 0; i--) {
    const d = new Date(anoMes.ano, anoMes.mes - 1, diasMesAnterior - i)
    saida.push({ dia: d.getDate(), iso: isoDe(d), mesAtual: false, ehHoje: false, escola: '', tecnicoNome: '' })
  }
  for (let d = 1; d <= diasNoMes; d++) {
    const data = new Date(anoMes.ano, anoMes.mes, d)
    const iso = isoDe(data)
    const attr = atribuicoes[iso]
    saida.push({
      dia: d,
      iso,
      mesAtual: true,
      ehHoje: mesmoDia(data, hoje),
      escola: attr?.escola || '',
      tecnicoNome: attr?.tecnicoNome || '',
    })
  }
  // Dias do próximo mês para fechar a grade em múltiplos de 7.
  let prox = 1
  while (saida.length % 7 !== 0) {
    const d = new Date(anoMes.ano, anoMes.mes + 1, prox)
    saida.push({ dia: prox, iso: isoDe(d), mesAtual: false, ehHoje: false, escola: '', tecnicoNome: '' })
    prox++
  }
  return saida
})

/* ---------- Navegação por teclado (setas + Enter) ---------- */
const diaRefs = ref<Array<HTMLButtonElement | null>>([])
const focoIdx = ref(-1)

function refDia(idx: number) {
  return (el: Element | ComponentPublicInstance | null) => {
    diaRefs.value[idx] = el as HTMLButtonElement | null
  }
}

function ajustarFoco() {
  const alvo = celulas.value.findIndex((c) => c.mesAtual)
  focoIdx.value = alvo >= 0 ? alvo : 0
}

/** Setas movem o dia, Home/End vão ao início/fim da grade. Enter é o clique (botão nativo). */
function navegarTeclado(e: KeyboardEvent) {
  const total = celulas.value.length
  if (total === 0) return
  if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
  e.preventDefault()
  if (e.key === 'ArrowRight') focoIdx.value = Math.min(focoIdx.value + 1, total - 1)
  else if (e.key === 'ArrowLeft') focoIdx.value = Math.max(focoIdx.value - 1, 0)
  else if (e.key === 'ArrowDown') focoIdx.value = Math.min(focoIdx.value + 7, total - 1)
  else if (e.key === 'ArrowUp') focoIdx.value = Math.max(focoIdx.value - 7, 0)
  else if (e.key === 'Home') focoIdx.value = 0
  else focoIdx.value = total - 1
  diaRefs.value[focoIdx.value]?.focus()
}

/** Rótulo acessível da célula: data por extenso + atribuição, se houver. */
function rotuloDia(c: CelulaDia): string {
  const data = new Date(c.iso + 'T12:00:00')
  const base = data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
  if (!c.escola) return `${base} — sem atribuição`
  return `${base} — ${c.escola} com ${c.tecnicoNome}`
}

/* ---------- Modal de atribuição ---------- */
const modalAberto = ref(false)
const diaSel = ref('')
const escolaSel = ref('')
const tecnicoSel = ref('')

const diaPreenchido = computed(() => !!atribuicoes[diaSel.value])

const dataModal = computed(() => {
  if (!diaSel.value) return ''
  return new Date(diaSel.value + 'T12:00:00').toLocaleDateString('pt-BR')
})

function abrirDia(c: CelulaDia) {
  diaSel.value = c.iso
  const attr = atribuicoes[c.iso]
  escolaSel.value = attr?.escola || ''
  tecnicoSel.value = attr?.tecnicoId || ''
  modalAberto.value = true
}

function salvar() {
  if (!diaSel.value || !escolaSel.value || !tecnicoSel.value) return
  const tecnico = estado.tecnicos.find((t) => t.id === tecnicoSel.value)
  atribuicoes[diaSel.value] = {
    escola: escolaSel.value,
    tecnicoId: tecnicoSel.value,
    tecnicoNome: tecnico?.nome || '',
  }
  salvarAtribuicoes()
  modalAberto.value = false
}

function remover() {
  delete atribuicoes[diaSel.value]
  salvarAtribuicoes()
  modalAberto.value = false
}

/* ---------- Persistência local (ainda sem endpoint no backend) ---------- */
function carregarAtribuicoes(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const dados = JSON.parse(raw) as Record<string, Atribuicao>
    for (const [dia, attr] of Object.entries(dados)) {
      if (
        attr &&
        typeof attr.escola === 'string' &&
        typeof attr.tecnicoId === 'string' &&
        typeof attr.tecnicoNome === 'string'
      ) {
        atribuicoes[dia] = attr
      }
    }
  } catch {
    /* localStorage corrompido ou indisponível: agenda começa vazia */
  }
}

function salvarAtribuicoes(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(atribuicoes))
  } catch {
    /* sem espaço ou bloqueado: a atribuição não persiste, mas a tela funciona */
  }
}

/* ---------- Carga ---------- */
async function carregar() {
  estado.loading = true
  estado.erro = ''
  try {
    const [escolas, tecnicos] = await Promise.all([listarEscolas(), listarTecnicos()])
    estado.escolas = escolas
    estado.tecnicos = ordenarTecnicos(tecnicos)
  } catch {
    estado.tecnicos = []
    estado.erro =
      'Não foi possível carregar a lista de técnicos. O serviço pode estar indisponível no momento — tente novamente mais tarde.'
  } finally {
    estado.loading = false
  }
}

onMounted(() => {
  carregarAtribuicoes()
  ajustarFoco()
  void carregar()
})
</script>

<template>
  <div class="agenda-page">
    <header class="agenda-head">
      <div>
        <h2><CalendarDays :size="22" /> Calendário de atendimento</h2>
        <p class="agenda-sub">Clique em um dia para atribuir a escola e o técnico que vão atendê-la.</p>
      </div>
      <div class="agenda-nav">
        <button class="btn btn-outline" type="button" @click="irParaHoje">Hoje</button>
        <button class="nav-btn" type="button" aria-label="Mês anterior" @click="mesAnterior">
          <ChevronLeft :size="18" />
        </button>
        <button class="nav-btn" type="button" aria-label="Próximo mês" @click="proximoMes">
          <ChevronRight :size="18" />
        </button>
      </div>
    </header>

    <p v-if="estado.erro" class="erro card">{{ estado.erro }}</p>

    <div class="card agenda-card">
      <h3 class="agenda-mes">{{ tituloMes }}</h3>

      <div class="grade" role="group" :aria-label="`Calendário de ${tituloMes}`" @keydown="navegarTeclado">
        <div v-for="(nome, i) in DIAS_SEMANA_CURTO" :key="i" class="grade-col">{{ nome }}</div>
        <button
          v-for="(c, idx) in celulas"
          :key="c.iso"
          :ref="refDia(idx)"
          class="dia"
          :class="{ fora: !c.mesAtual, hoje: c.ehHoje, preenchida: !!c.escola }"
          :tabindex="idx === focoIdx ? 0 : -1"
          :aria-label="rotuloDia(c)"
          :aria-pressed="!!c.escola"
          @focus="focoIdx = idx"
          @click="abrirDia(c)"
        >
          <span class="dia-num">{{ c.dia }}</span>
          <span v-if="c.escola" class="dia-info">
            <span class="dia-escola">{{ c.escola }}</span>
            <span class="dia-tecnico">{{ c.tecnicoNome }}</span>
          </span>
        </button>
      </div>

      <p class="agenda-ajuda">
        Navegue com as setas do teclado e pressione Enter para abrir um dia. Dias com a barra verde já têm
        escola e técnico atribuídos.
      </p>
    </div>

    <div class="aviso-local card">
      <Info :size="18" />
      <p>
        As atribuições ficam salvas apenas neste navegador (localStorage). Ainda não existe endpoint no
        backend para a agenda — a persistência em servidor depende de uma task futura.
      </p>
    </div>

    <BaseModal :titulo="`Atendimento — ${dataModal}`" :aberto="modalAberto" @fechar="modalAberto = false">
      <div class="modal-campos">
        <div class="field">
          <label for="agenda-escola">Escola</label>
          <select
            id="agenda-escola"
            v-model="escolaSel"
            class="select-input"
            :disabled="estado.loading && estado.escolas.length === 0"
          >
            <option value="" disabled>
              {{
                estado.loading && estado.escolas.length === 0
                  ? 'Carregando escolas...'
                  : 'Selecione a escola'
              }}
            </option>
            <option v-for="e in estado.escolas" :key="e" :value="e">{{ e }}</option>
          </select>
        </div>
        <div class="field">
          <label for="agenda-tecnico">Técnico</label>
          <select
            id="agenda-tecnico"
            v-model="tecnicoSel"
            class="select-input"
            :disabled="estado.loading && estado.tecnicos.length === 0"
          >
            <option value="" disabled>
              {{
                estado.loading && estado.tecnicos.length === 0
                  ? 'Carregando técnicos...'
                  : 'Selecione o técnico'
              }}
            </option>
            <option v-for="t in estado.tecnicos" :key="t.id" :value="t.id">{{ t.nome }}</option>
          </select>
        </div>
      </div>
      <template #footer>
        <button v-if="diaPreenchido && podeRemover" class="btn btn-perigo" type="button" @click="remover">
          Remover atribuição
        </button>
        <button class="btn btn-outline" type="button" @click="modalAberto = false">Cancelar</button>
        <button
          class="btn btn-primary"
          type="button"
          :disabled="!escolaSel || !tecnicoSel"
          @click="salvar"
        >
          Salvar
        </button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.agenda-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.agenda-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.agenda-head h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 19px;
}

.agenda-head h2 :deep(svg) {
  color: var(--brand-gold);
}

.agenda-sub {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 13px;
}

.agenda-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-btn {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  transition: background 0.15s ease;
}

.nav-btn:hover {
  background: var(--surface-muted);
}

.agenda-card {
  padding: 18px;
}

.agenda-mes {
  font-size: 17px;
  margin-bottom: 14px;
}

.grade {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.grade-col {
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  padding-bottom: 4px;
}

.dia {
  min-height: 76px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  padding: 6px 8px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.dia:hover {
  border-color: var(--blue);
}

.dia:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}

.dia.fora {
  background: var(--surface-muted);
}

.dia.preenchida {
  border-left: 3px solid var(--green);
}

.dia-num {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-weight: 700;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.dia.hoje .dia-num {
  background: var(--brand-gold);
  color: var(--sidebar-bg);
}

.dia-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.3;
}

.dia-escola {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dia-tecnico {
  font-size: 10.5px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agenda-ajuda {
  margin: 12px 2px 0;
  font-size: 12px;
  color: var(--text-muted);
}

.aviso-local {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  border-left: 4px solid var(--yellow);
  background: var(--yellow-soft);
  color: var(--text-secondary);
  font-size: 13px;
}

.aviso-local :deep(svg) {
  flex-shrink: 0;
  margin-top: 2px;
}

.aviso-local p {
  margin: 0;
}

.erro {
  padding: 14px 18px;
  color: var(--red);
  font-weight: 500;
}

.modal-campos {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (max-width: 640px) {
  .dia {
    min-height: 56px;
    padding: 4px 5px;
  }

  .dia-info {
    display: none;
  }
}
</style>
