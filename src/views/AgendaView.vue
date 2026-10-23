<script setup lang="ts">
import { computed, onMounted, reactive, ref, type ComponentPublicInstance } from 'vue'
import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { listarTecnicos, type TecnicoDestino } from '@/api/chamados'
import { atribuirDia, listarAtribuicoes, removerAtribuicao } from '@/api/agenda'
import { listarEscolas } from '@/api/usuarios'
import { ordenarTecnicos } from '@/utils/tecnicos'
import { corDoTecnico } from '@/utils/cores'
import { useAuthStore } from '@/stores/auth'
import type { AtribuicaoAgenda } from '@/types'

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

/* ---------- Estado ---------- */
const estado = reactive({
  loading: true,
  erro: '',
  escolas: [] as string[],
  tecnicos: [] as TecnicoDestino[],
  salvando: false,
})

/** Atribuições por dia (chave = "yyyy-mm-dd"). Espelha `AtribuicaoAgenda` do backend. */
const atribuicoes = reactive<Record<string, AtribuicaoAgenda[]>>({})

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
  void carregarAtribuicoes()
}

function proximoMes() {
  if (anoMes.mes === 11) {
    anoMes.mes = 0
    anoMes.ano++
  } else {
    anoMes.mes++
  }
  ajustarFoco()
  void carregarAtribuicoes()
}

function irParaHoje() {
  anoMes.ano = hoje.getFullYear()
  anoMes.mes = hoje.getMonth()
  ajustarFoco()
  void carregarAtribuicoes()
}

/* ---------- Células do calendário (construído do zero, sem biblioteca) ---------- */
interface CelulaDia {
  dia: number
  iso: string
  mesAtual: boolean
  ehHoje: boolean
  /** Atribuições do dia (pode haver mais de um técnico). */
  attrs: AtribuicaoAgenda[]
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

/**
 * Chave do dia a partir do `data` que o backend devolve (ISO, meia-noite UTC).
 *
 * O calendário é montado em horário local, mas o backend normaliza a data para
 * meia-noite UTC do dia. Extrair os 10 primeiros caracteres (a parte "AAAA-MM-DD"
 * do UTC) é o que faz a atribuição cair na célula que o usuário clicou, em
 * qualquer fuso horário.
 */
function chaveDaData(isoUtc: string): string {
  return isoUtc.slice(0, 10)
}

/**
 * Primeiro dia do mês exibido e primeiro dia do seguinte, para o filtro de
 * intervalo da API.
 *
 * O `fim` é o primeiro dia do mês seguinte (exclusivo): assim o último dia do
 * mês entra tanto se o backend tratar `fim` como exclusivo quanto como
 * inclusivo. Usa `new Date(ano, mes + 1, 1)` porque o mês 13 é normalizado para
 * janeiro do ano seguinte — montar a string na mão daria "2026-13-01" em
 * dezembro.
 */
function intervaloAtual(): { inicio: string; fim: string } {
  return {
    inicio: isoDe(new Date(anoMes.ano, anoMes.mes, 1)),
    fim: isoDe(new Date(anoMes.ano, anoMes.mes + 1, 1)),
  }
}

/** Iniciais do técnico (1 ou 2 letras) para o selo colorido da célula. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return ''
  const primeiro = (partes[0]?.[0] ?? '').toUpperCase()
  const ultimo = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '').toUpperCase() : ''
  return `${primeiro}${ultimo}`
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
    saida.push({ dia: d.getDate(), iso: isoDe(d), mesAtual: false, ehHoje: false, attrs: [] })
  }
  for (let d = 1; d <= diasNoMes; d++) {
    const data = new Date(anoMes.ano, anoMes.mes, d)
    const iso = isoDe(data)
    const attrs = atribuicoes[iso] || []
    saida.push({
      dia: d,
      iso,
      mesAtual: true,
      ehHoje: mesmoDia(data, hoje),
      attrs,
    })
  }
  // Dias do próximo mês para fechar a grade em múltiplos de 7.
  let prox = 1
  while (saida.length % 7 !== 0) {
    const d = new Date(anoMes.ano, anoMes.mes + 1, prox)
    saida.push({ dia: prox, iso: isoDe(d), mesAtual: false, ehHoje: false, attrs: [] })
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
  if (!c.attrs.length) return `${base} — sem atribuição`
  return `${base} — ${c.attrs.map((a) => `${a.escola} com ${a.tecnicoNome}`).join('; ')}`
}

/* ---------- Modal de atribuição ---------- */
const modalAberto = ref(false)
const diaSel = ref('')
const escolaSel = ref('')
const tecnicoSel = ref('')
const observacaoSel = ref('')
const solicitarPontoSel = ref(true)

const atribuicoesDoDia = computed(() => atribuicoes[diaSel.value] || [])

const escolasDisponiveis = computed(() =>
  estado.escolas.filter((e) => !atribuicoesDoDia.value.some((a) => a.escola === e)),
)

const dataModal = computed(() => {
  if (!diaSel.value) return ''
  return new Date(diaSel.value + 'T12:00:00').toLocaleDateString('pt-BR')
})

function abrirDia(c: CelulaDia) {
  diaSel.value = c.iso
  escolaSel.value = ''
  tecnicoSel.value = ''
  observacaoSel.value = ''
  solicitarPontoSel.value = true
  modalAberto.value = true
}

async function salvar() {
  if (!diaSel.value || !escolaSel.value || !tecnicoSel.value) return
  const tecnico = estado.tecnicos.find((t) => t.id === tecnicoSel.value)
  estado.salvando = true
  try {
    const criada = await atribuirDia({
      escola: escolaSel.value,
      data: diaSel.value,
      tecnicoId: tecnicoSel.value,
      tecnicoNome: tecnico?.nome || '',
      observacao: observacaoSel.value.trim() || undefined,
      solicitarPonto: solicitarPontoSel.value,
    })
    const chave = chaveDaData(criada.data)
    if (!atribuicoes[chave]) atribuicoes[chave] = []
    atribuicoes[chave].push(criada)
    escolaSel.value = ''
    tecnicoSel.value = ''
  } catch (e: any) {
    const data = e?.response?.data
    const msg = (typeof data === 'string' ? data : data?.message) || ''
    estado.erro = msg || 'Não foi possível salvar a atribuição. Tente novamente.'
  } finally {
    estado.salvando = false
  }
}

/**
 * Remove a atribuição do dia.
 *
 * A permissão é revalidada AQUI, e não só no `v-if` do botão: o `v-if` é
 * decisão de template, e a função é o que de fato fala com o backend. Se o
 * nível do usuário não for ADMIN, a função retorna sem chamar a API — o
 * servidor é a autoridade final, mas o portal não manda o que sabe que será
 * recusado.
 */
async function removerItem(id: string) {
  if (auth.user?.nivel !== 'ADMIN') return
  try {
    await removerAtribuicao(id)
    const chave = diaSel.value
    if (atribuicoes[chave]) {
      atribuicoes[chave] = atribuicoes[chave].filter((a) => a.id !== id)
      if (!atribuicoes[chave].length) delete atribuicoes[chave]
    }
  } catch {
    estado.erro = 'Não foi possível remover a atribuição. Tente novamente.'
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
    await carregarAtribuicoes()
  } catch {
    estado.tecnicos = []
    estado.erro =
      'Não foi possível carregar a lista de técnicos. O serviço pode estar indisponível no momento — tente novamente mais tarde.'
  } finally {
    estado.loading = false
  }
}

/**
 * Carrega as atribuições do mês exibido.
 *
 * O filtro de intervalo vai para a API, mas o corte também é feito aqui: se o
 * backend ignorar os parâmetros (ou os nomes das chaves mudarem), a tela
 * continua mostrando só o mês, em vez de derrubar atribuições de outros meses
 * na grade.
 */
async function carregarAtribuicoes() {
  // Limpa o mês anterior para não acumular atribuições de outros meses.
  for (const k of Object.keys(atribuicoes)) delete atribuicoes[k]
  try {
    const { inicio, fim } = intervaloAtual()
    const lista = await listarAtribuicoes({ inicio, fim })
    for (const a of lista) {
      const chave = chaveDaData(a.data)
      if (chave >= inicio && chave < fim) {
        if (!atribuicoes[chave]) atribuicoes[chave] = []
        atribuicoes[chave].push(a)
      }
    }
    if (!Object.keys(atribuicoes).length) await migrarDoNavegador()
  } catch {
    estado.erro = 'Não foi possível carregar a agenda. Tente novamente mais tarde.'
  }
}

/**
 * Migração única das atribuições que estavam no localStorage.
 *
 * Quem usou a agenda antes do endpoint existir tinha os dias salvos só no
 * navegador. Sem isto, essas atribuições desapareceriam em silêncio quando o
 * endpoint entrasse. A migração lê o storage antigo e faz um POST por dia,
 * uma única vez, e remove a chave — mesmo que algum POST falhe, para não
 * repetir a tentativa a cada carregamento.
 *
 * Só roda quando o backend não devolveu atribuição nenhuma: se já há dados
 * no servidor, os do navegador são duplicata e ficam para trás.
 */
async function migrarDoNavegador() {
  const STORAGE_KEY = 'agenda-atendimento-v1'
  let dados: Record<string, { escola: string; tecnicoId: string; tecnicoNome: string }> | null = null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) dados = JSON.parse(raw)
  } catch {
    dados = null
  }
  if (!dados) return

  const entradas = Object.entries(dados).filter(
    ([dia, a]) =>
      typeof dia === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(dia) &&
      !!a &&
      typeof a.escola === 'string' &&
      typeof a.tecnicoId === 'string' &&
      typeof a.tecnicoNome === 'string',
  )

  if (entradas.length) {
    await Promise.all(
      entradas.map(([dia, a]) =>
        atribuirDia({
          escola: a.escola,
          data: dia,
          tecnicoId: a.tecnicoId,
          tecnicoNome: a.tecnicoNome,
        }).catch(() => null),
      ),
    )
  }
  localStorage.removeItem(STORAGE_KEY)
}

onMounted(() => {
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
          :class="{ fora: !c.mesAtual, hoje: c.ehHoje, preenchida: c.attrs.length > 0 }"
          :tabindex="idx === focoIdx ? 0 : -1"
          :aria-label="rotuloDia(c)"
          :aria-pressed="c.attrs.length > 0"
          :style="c.attrs.length ? { borderLeftColor: corDoTecnico(c.attrs[0].tecnicoId, c.attrs[0].tecnicoCor) } : undefined"
          @focus="focoIdx = idx"
          @click="abrirDia(c)"
        >
          <span class="dia-num">{{ c.dia }}</span>
          <span v-if="c.attrs.length" class="dia-info">
            <span v-for="a in c.attrs" :key="a.id" class="dia-attr">
              <span class="dia-escola">{{ a.escola }}</span>
              <span class="dia-tecnico">
                <span class="dia-tecnico-iniciais" :style="{ backgroundColor: corDoTecnico(a.tecnicoId, a.tecnicoCor) }">
                  {{ iniciais(a.tecnicoNome) }}
                </span>
                {{ a.tecnicoNome }}
              </span>
            </span>
          </span>
        </button>
      </div>

      <p class="agenda-ajuda">
        Navegue com as setas do teclado e pressione Enter para abrir um dia. Dias com a barra colorida já
        têm escola e técnico atribuídos — cada técnico tem a sua cor.
      </p>
    </div>

    <BaseModal :titulo="`Atendimento — ${dataModal}`" :aberto="modalAberto" @fechar="modalAberto = false">
      <div class="modal-campos">
        <div v-if="atribuicoesDoDia.length" class="atribuicoes-lista">
          <p class="atribuicoes-titulo">Técnicos já inseridos neste dia</p>
          <ul class="atribuicoes-ul">
            <li v-for="a in atribuicoesDoDia" :key="a.id" class="atribuicao-item">
              <span
                class="dia-tecnico-iniciais"
                :style="{ backgroundColor: corDoTecnico(a.tecnicoId, a.tecnicoCor) }"
              >{{ iniciais(a.tecnicoNome) }}</span>
              <span class="atribuicao-info">
                <strong>{{ a.tecnicoNome }}</strong>
                <span class="atribuicao-escola">{{ a.escola }}</span>
                <span v-if="a.observacao" class="atribuicao-obs">{{ a.observacao }}</span>
              </span>
              <button
                v-if="podeRemover"
                class="btn btn-perigo btn-sm"
                type="button"
                @click="removerItem(a.id)"
              >Remover</button>
            </li>
          </ul>
        </div>
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
            <option v-for="e in escolasDisponiveis" :key="e" :value="e">{{ e }}</option>
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
        <div class="field">
          <label for="agenda-obs">Observação (opcional)</label>
          <textarea
            id="agenda-obs"
            v-model="observacaoSel"
            class="select-input"
            rows="2"
            placeholder="Ex.: redirecionado para esta escola no mesmo dia"
          />
          <div class="field">
            <label>
              <input type="checkbox" v-model="solicitarPontoSel" />
              Solicitar ponto para este atendimento
            </label>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-outline" type="button" @click="modalAberto = false">Fechar</button>
        <button
          class="btn btn-primary"
          type="button"
          :disabled="!escolaSel || !tecnicoSel || estado.salvando"
          @click="salvar"
        >
          {{ estado.salvando ? 'Salvando...' : 'Adicionar' }}
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
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dia-tecnico-iniciais {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 4px;
  font-size: 9.5px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 0.02em;
}

.agenda-ajuda {
  margin: 12px 2px 0;
  font-size: 12px;
  color: var(--text-muted);
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

.atribuicoes-lista {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
}

.atribuicao-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  min-width: 0;
}

.atribuicao-item:hover {
  border-color: var(--blue);
}

.atribuicoes-titulo {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.atribuicoes-ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.atribuicao-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  min-width: 0;
}

.atribuicao-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.atribuicao-escola {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 11px;
}

.dia-attr {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
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
