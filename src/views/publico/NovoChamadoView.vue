<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch, type Component } from 'vue'
import { useRouter } from 'vue-router'
import type { AxiosError } from 'axios'
import {
  AlertTriangle,
  AppWindow,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  FileText,
  HelpCircle,
  Info,
  Loader2,
  Mail,
  Monitor,
  PackageSearch,
  Paperclip,
  Phone,
  Search,
  Send,
  Wifi,
} from '@lucide/vue'
import { useUiStore } from '@/stores/ui'
import { apiError } from '@/utils/apiError'
import {
  criarChamadoPublico,
  getFormularioPublico,
  listarCategoriasEquipamento,
  listarEscolasPublico,
  listarMarcasEquipamento,
  listarModelosEquipamento,
  type FormularioCategoria,
  type FormularioOpcao,
  type FormularioOpcaoAlerta,
  type FormularioPergunta,
  type NovoChamadoPayload,
} from '@/api/publico'

const ui = useUiStore()
const router = useRouter()

/** Busca de chamado por protocolo (vai para /consulta). */
const buscaProtocolo = ref('')
function consultarProtocolo() {
  const p = buscaProtocolo.value.trim()
  if (!p) return
  void router.push({ path: '/consulta', query: { protocolo: p } })
}

/** Opção especial "digitar manualmente" (mesma ideia do formulário antigo). */
const OUTRO = '__OUTRO__'
/** Sentinela da pseudo-opção "Outro (descrever)" adicionada a toda pergunta OPCOES. */
const OUTRO_PERGUNTA = '__OUTRO_PERGUNTA__'
const TAMANHO_MAX_ANEXO = 10 * 1024 * 1024 // 10 MB
const URGENCIAS = ['Baixa', 'Média', 'Alta'] as const
const CARGOS = [
  'Diretor',
  'Vice-diretor',
  'Coordenador',
  'Gerente de Organização Escolar',
  'Agente de Organização Escolar',
  'Professor',
  'Estagiário (Proati)',
] as const

/* ==================== wizard / formulário ==================== */

type Etapa = 0 | 1 | 2 | 3 // 0 = home, 1 = perguntas, 2 = identificação, 3 = sucesso
const passo = ref<Etapa>(0)

const formulario = ref<FormularioCategoria[]>([])
const carregandoFormulario = ref(true)
const erroFormulario = ref('')

/** Respostas das perguntas dinâmicas, indexadas por pergunta.id. */
const respostas = reactive<Record<string, string>>({})
/** Texto livre quando a resposta é a pseudo-opção "Outro (descrever)". */
const outrosTextos = reactive<Record<string, string>>({})

/** Texto da resposta como aparece para o usuário (traduz a sentinela Outro). */
function rotuloResposta(p: FormularioPergunta): string | null {
  const atual = respostas[p.id]
  if (p.tipo !== 'OPCOES' || !atual) return null
  if (atual === OUTRO_PERGUNTA) return 'Outro'
  return atual
}

const categoriaSelecionada = ref<FormularioCategoria | null>(null)
const corCategoria = computed(() => categoriaSelecionada.value?.cor?.trim() || 'var(--blue)')

/** Guarda contra buscas concorrentes ( separado do estado visual de loading ). */
let buscaFormularioEmAndamento = false

async function carregarFormulario() {
  if (buscaFormularioEmAndamento) return // evita chamada dupla simultânea
  buscaFormularioEmAndamento = true
  carregandoFormulario.value = true
  erroFormulario.value = ''
  try {
    formulario.value = await getFormularioPublico()
  } catch (e) {
    erroFormulario.value = apiError(e, 'Não foi possível carregar o formulário. Tente novamente.')
  } finally {
    carregandoFormulario.value = false
    buscaFormularioEmAndamento = false
  }
}

function selecionarCategoria(cat: FormularioCategoria) {
  categoriaSelecionada.value = cat
  Object.keys(respostas).forEach((k) => delete respostas[k])
  Object.keys(outrosTextos).forEach((k) => delete outrosTextos[k])
  Object.keys(erros).forEach((k) => delete erros[k])
  eqCategoria.value = ''
  eqMarca.value = ''
  eqModelo.value = ''
  eqMarcaCustom.value = ''
  eqModeloCustom.value = ''
  eqCategorias.value = []
  eqMarcas.value = []
  eqModelos.value = []
  passo.value = 1
  if (cat.chave === 'equipamento') void garantirCategoriasEquipamento()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function voltarHome() {
  passo.value = 0
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

/** Visibilidade condicional: só exibe se a pergunta-pai tiver EXATAMENTE o rótulo esperado. */
function perguntaVisivel(p: FormularioPergunta): boolean {
  if (!p.dependeDePerguntaId) return true
  return respostas[p.dependeDePerguntaId] === p.dependeDeOpcao
}

const perguntasVisiveis = computed<FormularioPergunta[]>(() => {
  const cat = categoriaSelecionada.value
  if (!cat) return []
  return (cat.perguntas ?? [])
    .filter((p) => p.ativa && perguntaVisivel(p))
    .sort((a, b) => a.ordem - b.ordem)
})

function selecionada(p: FormularioPergunta): FormularioOpcao | null {
  const atual = respostas[p.id]
  if (p.tipo !== 'OPCOES' || !atual) return null
  return p.opcoes.find((o) => o.rotulo === atual) ?? null
}

/** Alerta ativo da opção atualmente selecionada (some ao trocar de opção). */
function alertaDaPergunta(p: FormularioPergunta): FormularioOpcaoAlerta | null {
  return selecionada(p)?.alerta ?? null
}

/** Opções escolhidas (na ordem das perguntas) — usado no resumo e na composição do tipo. */
const opcoesEscolhidas = computed<FormularioOpcao[]>(() => {
  const cat = categoriaSelecionada.value
  if (!cat) return []
  return (cat.perguntas ?? [])
    .filter((p) => perguntaVisivel(p))
    .sort((a, b) => a.ordem - b.ordem)
    .map((p) => selecionada(p))
    .filter((o): o is FormularioOpcao => !!o)
})

const temEncerra = computed(() => opcoesEscolhidas.value.some((o) => o.alerta?.encerra))
const exigeAnexo = computed(() => opcoesEscolhidas.value.some((o) => o.alerta?.exigeAnexo))

/* ==================== cascata de equipamento (etapa perguntas) ==================== */

const eqCategorias = ref<string[]>([])
const eqMarcas = ref<string[]>([])
const eqModelos = ref<string[]>([])
const eqCategoria = ref('')
const eqMarca = ref('')
const eqModelo = ref('')
const eqMarcaCustom = ref('')
const eqModeloCustom = ref('')
const carregandoEquip = ref(false)

const ehEquipamento = computed(() => categoriaSelecionada.value?.chave === 'equipamento')

async function garantirCategoriasEquipamento() {
  if (eqCategorias.value.length || carregandoEquip.value) return
  carregandoEquip.value = true
  try {
    eqCategorias.value = await listarCategoriasEquipamento()
  } catch (e) {
    ui.error(apiError(e, 'Não foi possível carregar o catálogo de equipamentos.'))
  } finally {
    carregandoEquip.value = false
  }
}
/** Cascata genérica: categoria → marcas. */
async function carregarMarcas(
  categoria: string,
  marcasRef: typeof eqMarcas,
  marcaRef: typeof eqMarca,
  modelosRef: typeof eqModelos,
) {
  marcasRef.value = []
  marcaRef.value = ''
  modelosRef.value = []
  if (!categoria) return
  try {
    marcasRef.value = await listarMarcasEquipamento(categoria)
  } catch {
    marcasRef.value = []
  }
}

/** Cascata genérica: categoria + marca → modelos (modeloRef opcional). */
async function carregarModelos(
  categoria: string,
  marca: string,
  modelosRef: typeof eqModelos,
  modeloRef?: typeof eqModelo,
) {
  modelosRef.value = []
  if (modeloRef) modeloRef.value = ''
  if (!categoria || !marca || marca === OUTRO) return
  try {
    modelosRef.value = await listarModelosEquipamento(categoria, marca)
  } catch {
    modelosRef.value = []
  }
}

watch(eqCategoria, (c) => {
  eqMarcaCustom.value = ''
  eqModeloCustom.value = ''
  void carregarMarcas(c, eqMarcas, eqMarca, eqModelos)
})
watch(eqMarca, (m) => {
  eqModeloCustom.value = ''
  void carregarModelos(eqCategoria.value, m, eqModelos, eqModelo)
})

/* ---------- equipamento selecionado ---------- */

const equipamentoCompleto = computed(() => {
  if (!eqCategoria.value) return false
  if (!eqMarca.value) return false
  if (eqMarca.value === OUTRO) return !!eqMarcaCustom.value.trim()
  if (!eqModelo.value) return false
  if (eqModelo.value === OUTRO) return !!eqModeloCustom.value.trim()
  return true
})

const equipamentoDescricao = computed(() => {
  if (!eqCategoria.value) return ''
  const marca = eqMarca.value === OUTRO ? eqMarcaCustom.value.trim() : eqMarca.value
  const modelo = eqModelo.value === OUTRO ? eqModeloCustom.value.trim() : eqModelo.value
  return [eqCategoria.value, marca, modelo].filter(Boolean).join(' / ')
})

const resumoPills = computed<string[]>(() => {
  const cat = categoriaSelecionada.value
  if (!cat) return []
  const pills = [
    cat.nome,
    ...perguntasVisiveis.value
      .map((p) => rotuloResposta(p))
      .filter((r): r is string => !!r),
  ]
  if (ehEquipamento.value && equipamentoDescricao.value) pills.push(equipamentoDescricao.value)
  return pills
})

const podeAvancarPerguntas = computed(() => {
  if (!categoriaSelecionada.value) return false
  if (temEncerra.value) return false
  for (const p of perguntasVisiveis.value) {
    if (!p.obrigatoria) continue
    const resp = (respostas[p.id] ?? '').trim()
    if (p.tipo === 'OPCOES') {
      // "Outro (descrever)" exige o texto livre preenchido
      if (!resp) return false
      if (resp === OUTRO_PERGUNTA && (outrosTextos[p.id] ?? '').trim().length < 2) return false
    } else if (resp.length < 2) {
      return false
    }
  }
  if (ehEquipamento.value && !equipamentoCompleto.value) return false
  return true
})

function avancarParaIdentificacao() {
  if (!podeAvancarPerguntas.value) return
  passo.value = 2
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function voltarPerguntas() {
  erroEnvio.value = ''
  passo.value = 1
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

/* ==================== identificação ==================== */

const escolas = ref<string[]>([])
const carregandoEscolas = ref(false)

const ident = reactive({
  nome: '',
  cargo: '',
  email: '',
  escola: '',
  descricaoAdicional: '',
  urgencia: '' as '' | 'Baixa' | 'Média' | 'Alta',
})
const anexo = ref<File | null>(null)
const erros = reactive<Record<string, string>>({})
const enviando = ref(false)
const erroEnvio = ref('')
const protocolo = ref('')
const protocoloCopiado = ref(false)

function emailValido(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function onAnexoChange(e: Event) {
  erros.anexo = ''
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] || null
  if (file && file.size > TAMANHO_MAX_ANEXO) {
    anexo.value = null
    input.value = ''
    erros.anexo = 'Arquivo muito grande. O tamanho máximo é 10 MB.'
    return
  }
  anexo.value = file
}

function removerAnexo() {
  anexo.value = null
  const input = document.getElementById('anexo') as HTMLInputElement | null
  if (input) input.value = ''
}

/** Base64 SEM o prefixo data:...;base64, — como o backend espera. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function validarIdentificacao(): boolean {
  Object.keys(erros).forEach((k) => delete erros[k])
  if (!ident.nome.trim()) erros.nome = 'Informe o nome completo.'
  if (!ident.cargo) erros.cargo = 'Selecione o cargo/função.'
  if (!ident.email.trim()) erros.email = 'Informe o e-mail institucional.'
  else if (!emailValido(ident.email.trim())) erros.email = 'Informe um e-mail válido (ex.: nome@educacao.sp.gov.br).'
  if (!ident.escola) erros.escola = 'Selecione a escola/unidade.'
  if (!ident.urgencia) erros.urgencia = 'Selecione a urgência.'
  if (exigeAnexo.value && !anexo.value) erros.anexo = 'Anexe ao menos uma foto (obrigatório para esta opção).'
  if (!descricaoFinal().trim()) erros.descricaoAdicional = 'Descreva brevemente o problema.'
  return Object.keys(erros).length === 0
}

/* ---------- composição do submit ---------- */

function tipoFinal(): string {
  const cat = categoriaSelecionada.value
  if (!cat) return ''
  const primeira = perguntasVisiveis.value.map((p) => rotuloResposta(p)).find((r) => !!r)
  const base = primeira ? `${cat.nome} - ${primeira}` : cat.nome
  return base.length > 100 ? base.slice(0, 100) : base
}

function descricaoFinal(): string {
  const linhas: string[] = []
  for (const p of perguntasVisiveis.value) {
    const bruta = respostas[p.id] ?? ''
    const r = bruta === OUTRO_PERGUNTA ? `Outro: ${(outrosTextos[p.id] ?? '').trim()}` : bruta.trim()
    if (r) linhas.push(`[${p.rotulo}] ${r}`)
  }
  if (ehEquipamento.value && equipamentoDescricao.value) {
    linhas.push(`[Equipamento] ${equipamentoDescricao.value}`)
  }
  const extra = ident.descricaoAdicional.trim()
  if (extra) linhas.push(extra)
  return linhas.join('\n')
}

async function enviar() {
  if (enviando.value) return
  erroEnvio.value = ''
  if (!validarIdentificacao()) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  enviando.value = true
  try {
    const payload: NovoChamadoPayload = {
      unidade: ident.escola,
      solicitante: ident.nome.trim(),
      funcao: ident.cargo,
      tipo: tipoFinal(),
      descricao: descricaoFinal(),
      urgencia: ident.urgencia,
      email: ident.email.trim(),
    }
    if (anexo.value) {
      payload.anexoBase64 = await fileToBase64(anexo.value)
      payload.anexoNome = anexo.value.name
      payload.anexoTipo = anexo.value.type
    }
    const chamado = await criarChamadoPublico(payload)
    protocolo.value = chamado.protocolo
    passo.value = 3
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e) {
    const status = (e as AxiosError)?.response?.status
    erroEnvio.value =
      status === 413
        ? 'O anexo é muito grande para ser enviado. Tente um arquivo menor.'
        : apiError(e, 'Não foi possível enviar o chamado. Tente novamente.')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } finally {
    enviando.value = false
  }
}

/** "Abrir outro chamado": volta à home com TODAS as respostas/dados limpos. */
function novoChamado() {
  protocolo.value = ''
  protocoloCopiado.value = false
  categoriaSelecionada.value = null
  Object.keys(respostas).forEach((k) => delete respostas[k])
  Object.keys(outrosTextos).forEach((k) => delete outrosTextos[k])
  Object.keys(erros).forEach((k) => delete erros[k])
  eqCategoria.value = ''
  eqMarca.value = ''
  eqModelo.value = ''
  eqMarcaCustom.value = ''
  eqModeloCustom.value = ''
  eqCategorias.value = []
  eqMarcas.value = []
  eqModelos.value = []
  ident.nome = ''
  ident.cargo = ''
  ident.email = ''
  ident.escola = ''
  ident.descricaoAdicional = ''
  ident.urgencia = ''
  removerAnexo()
  erroEnvio.value = ''
  voltarHome()
}

async function copiarProtocolo() {
  await copiarTexto(protocolo.value)
  protocoloCopiado.value = true
  window.setTimeout(() => (protocoloCopiado.value = false), 2000)
}
/* ==================== catálogo (modal somente-leitura) ==================== */

/* ==================== contato / helpers ==================== */

const EMAIL_SETEC = 'lt3.setec@educacao.sp.gov.br'
const emailCopiado = ref(false)

/** Copia texto para a área de transferência (com fallback para navegadores antigos). */
async function copiarTexto(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = texto
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

async function copiarEmail() {
  await copiarTexto(EMAIL_SETEC)
  emailCopiado.value = true
  window.setTimeout(() => (emailCopiado.value = false), 2000)
}

function iconeCategoria(chave: string): Component {
  const mapa: Record<string, Component> = {
    rede: Wifi,
    equipamento: Monitor,
    sistemas: AppWindow,
    email: Mail,
  }
  return mapa[chave] ?? HelpCircle
}

onMounted(() => {
  void carregarFormulario()
  carregandoEscolas.value = true
  listarEscolasPublico()
    .then((l) => (escolas.value = l))
    .catch(() => {})
    .finally(() => (carregandoEscolas.value = false))
})
</script>

<template>
  <!-- Tela de loading de página inteira: nada aparece até o formulário carregar -->
  <div v-if="carregandoFormulario" class="boot-loading">
    <Loader2 :size="34" class="spin" />
    <p>Carregando...</p>
  </div>

  <div v-else class="leg-app">
    <!-- Cabeçalho no padrão do formulário antigo -->
    <header class="leg-topo">
      <img src="/logo-ure.png" alt="Brasão da URE Leste 3" class="leg-logo" />
      <div class="leg-topo-org">
        <small>Governo do Estado de São Paulo</small>
        <strong>SETEC — Unidade Regional de Ensino Leste 3</strong>
      </div>
    </header>

    <main class="leg-main">
      <div class="wiz-page">
      <!-- ==================== ETAPA 0 — HOME ==================== -->
      <template v-if="passo === 0">
        <header class="home-head">
          <p class="eyebrow">Abertura de Chamados — SETEC</p>
          <h1>Como podemos ajudar?</h1>
          <p class="home-sub">
            Selecione o tipo de problema abaixo. O chamado será encaminhado automaticamente à equipe do SETEC.
          </p>
        </header>

        <div v-if="carregandoFormulario" class="estado card">
          <Loader2 :size="22" class="spin" />
          <p>Carregando tipos de chamado...</p>
        </div>

        <div v-else-if="erroFormulario" class="aviso card">
          <p>{{ erroFormulario }}</p>
          <button type="button" class="btn btn-primary" @click="carregarFormulario">Tentar novamente</button>
        </div>

        <div v-else-if="!formulario.length" class="estado card">
          <PackageSearch :size="22" />
          <p>Nenhuma categoria disponível no momento.</p>
        </div>

        <!-- Grid de categorias -->
        <div v-else class="home-grid">
          <button
            v-for="cat in formulario"
            :key="cat.id"
            type="button"
            class="cat-card"
            :style="{ borderLeftColor: cat.cor || 'var(--blue)' }"
            @click="selecionarCategoria(cat)"
          >
            <span class="cat-icone" :style="{ color: cat.cor || 'var(--blue)' }">
              <component :is="iconeCategoria(cat.chave)" :size="20" />
            </span>
            <strong class="cat-nome">{{ cat.nome }}</strong>
            <span v-if="cat.descricao" class="cat-desc">{{ cat.descricao }}</span>
            <span class="cat-link" :style="{ color: cat.cor || 'var(--blue)' }">
              Abrir chamado <ArrowRight :size="13" />
            </span>
          </button>
        </div>

        <!-- Cartão de contato -->
        <section class="card contato">
          <div class="contato-info">
            <h2>Fale com o SETEC</h2>
            <p class="contato-nome">Jessica Moraes — Chefe de Seção SETEC</p>
            <p class="contato-sub">(11) 2523-7010 · {{ EMAIL_SETEC }}</p>
          </div>
          <div class="contato-acoes">
            <a class="btn-pill" href="tel:+551125237010">
              <Phone :size="14" />
              Ligar
            </a>
            <button type="button" class="btn-pill" @click="copiarEmail">
              <component :is="emailCopiado ? CheckCircle2 : Copy" :size="14" />
              {{ emailCopiado ? 'Copiado!' : 'Copiar e-mail' }}
            </button>
          </div>
        </section>

        <!-- Busca de chamado por protocolo -->
        <section class="card busca-chamado">
          <div class="busca-info">
            <Search :size="18" />
            <div>
              <h2>Acompanhar chamado</h2>
              <p>Já abriu um chamado? Consulte pelo número de protocolo.</p>
            </div>
          </div>
          <form class="busca-grupo" @submit.prevent="consultarProtocolo">
            <input
              v-model="buscaProtocolo"
              type="text"
              placeholder="Ex.: CH-20260923-0007"
              aria-label="Número do protocolo"
            />
            <button type="submit" :disabled="!buscaProtocolo.trim()">
              <Search :size="15" />
              Consultar
            </button>
          </form>
        </section>
      </template>
      <!-- ==================== ETAPA 1 — PERGUNTAS ==================== -->
      <template v-else-if="passo === 1 && categoriaSelecionada">
        <header class="etapa-head">
          <div class="etapa-topo">
            <button type="button" class="btn-ghost" @click="voltarHome">
              <ArrowLeft :size="14" />
              Voltar
            </button>
            <span class="badge-cat" :style="{ background: corCategoria }">{{ categoriaSelecionada.nome }}</span>
          </div>
          <h1>{{ categoriaSelecionada.nome }}</h1>
          <p class="etapa-sub">Responda as perguntas para detalhar o chamado.</p>
        </header>

        <div class="etapa-lista">
          <section v-for="p in perguntasVisiveis" :key="p.id" class="card bloco">
            <h3 class="bloco-titulo">
              {{ p.rotulo }}
              <span v-if="p.obrigatoria" class="req" aria-hidden="true">*</span>
            </h3>
            <p v-if="p.ajuda" class="bloco-ajuda">{{ p.ajuda }}</p>

            <!-- OPCOES: rádio-cards -->
            <div v-if="p.tipo === 'OPCOES'" class="opcoes" role="radiogroup" :aria-label="p.rotulo">
              <button
                v-for="op in p.opcoes"
                :key="op.rotulo"
                type="button"
                class="opcao"
                :class="{ sel: respostas[p.id] === op.rotulo }"
                :style="{ '--cat-cor': corCategoria }"
                role="radio"
                :aria-checked="respostas[p.id] === op.rotulo"
                @click="respostas[p.id] = op.rotulo"
              >
                <span class="opcao-radio" aria-hidden="true"></span>
                <span class="opcao-texto">{{ op.rotulo }}</span>
              </button>

              <!-- Toda pergunta de opções ganha "Outro (descrever)" -->
              <button
                type="button"
                class="opcao"
                :class="{ sel: respostas[p.id] === OUTRO_PERGUNTA }"
                :style="{ '--cat-cor': corCategoria }"
                role="radio"
                :aria-checked="respostas[p.id] === OUTRO_PERGUNTA"
                @click="respostas[p.id] = OUTRO_PERGUNTA"
              >
                <span class="opcao-radio" aria-hidden="true"></span>
                <span class="opcao-texto">Outro (descrever)</span>
              </button>

              <div v-if="respostas[p.id] === OUTRO_PERGUNTA" class="outro-box">
                <label :for="`outro-${p.id}`">Descreva o problema {{ p.obrigatoria ? '*' : '(opcional)' }}</label>
                <textarea
                  :id="`outro-${p.id}`"
                  v-model="outrosTextos[p.id]"
                  class="input textarea"
                  rows="3"
                  placeholder="Conte com suas palavras o que está acontecendo..."
                ></textarea>
              </div>
            </div>
            <div v-if="p.tipo === 'OPCOES' && alertaDaPergunta(p)" class="alerta" :class="alertaDaPergunta(p)!.tipo">
              <component :is="alertaDaPergunta(p)!.tipo === 'aviso' ? AlertTriangle : Info" :size="15" />
              <div class="alerta-corpo">
                <p>{{ alertaDaPergunta(p)!.texto }}</p>
                <div v-if="alertaDaPergunta(p)!.linkUrl || alertaDaPergunta(p)!.encerra" class="alerta-acoes">
                  <a
                    v-if="alertaDaPergunta(p)!.linkUrl"
                    class="alerta-link"
                    :href="alertaDaPergunta(p)!.linkUrl"
                    target="_blank"
                    rel="noopener"
                  >
                    {{ alertaDaPergunta(p)!.linkRotulo || 'Saiba mais' }}
                  </a>
                  <button
                    v-if="alertaDaPergunta(p)!.encerra"
                    type="button"
                    class="btn btn-outline alerta-voltar"
                    @click="voltarHome"
                  >
                    <ArrowLeft :size="13" />
                    Voltar ao início
                  </button>
                </div>
              </div>
            </div>

            <!-- TEXTO: ramo independente (ver nota abaixo) -->
            <input
              v-if="p.tipo === 'TEXTO'"
              :id="`p-${p.id}`"
              v-model="respostas[p.id]"
              class="input"
              type="text"
              placeholder="Digite sua resposta"
              :aria-label="p.rotulo"
            />

            <!-- TEXTO_LONGO -->
            <textarea
              v-if="p.tipo === 'TEXTO_LONGO'"
              :id="`p-${p.id}`"
              v-model="respostas[p.id]"
              class="input textarea"
              rows="4"
              placeholder="Digite sua resposta"
              :aria-label="p.rotulo"
            ></textarea>
          </section>

          <!-- Cascata de equipamento (somente categoria 'equipamento') -->
          <section v-if="ehEquipamento" class="card bloco">
            <h3 class="bloco-titulo">Selecione o equipamento <span class="req" aria-hidden="true">*</span></h3>
            <p class="bloco-ajuda">Escolha no catálogo ou use "Outro" para digitar manualmente.</p>
            <div class="tripla">
              <div class="field">
                <label for="eq-categoria">Categoria</label>
                <select id="eq-categoria" v-model="eqCategoria" class="select-input" :disabled="carregandoEquip">
                  <option value="" disabled>— Selecione —</option>
                  <option v-for="c in eqCategorias" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>
              <div class="field">
                <label for="eq-marca">Marca</label>
                <select id="eq-marca" v-model="eqMarca" class="select-input" :disabled="!eqCategoria">
                  <option value="">— Selecione —</option>
                  <option v-for="m in eqMarcas" :key="m" :value="m">{{ m }}</option>
                  <option v-if="eqCategoria" :value="OUTRO">Outro (digitar manualmente)</option>
                </select>
              </div>
              <div class="field">
                <label for="eq-modelo">Modelo</label>
                <select
                  id="eq-modelo"
                  v-model="eqModelo"
                  class="select-input"
                  :disabled="!eqMarca || eqMarca === OUTRO"
                >
                  <option value="">— Selecione —</option>
                  <option v-for="m in eqModelos" :key="m" :value="m">{{ m }}</option>
                  <option v-if="eqMarca && eqMarca !== OUTRO" :value="OUTRO">Outro (digitar manualmente)</option>
                </select>
              </div>
            </div>
            <div v-if="eqMarca === OUTRO" class="dupla">
              <div class="field">
                <label for="eq-marca-custom">Qual é a marca? *</label>
                <input id="eq-marca-custom" v-model="eqMarcaCustom" class="input" type="text" placeholder="Digite a marca" />
              </div>
              <div class="field">
                <label for="eq-modelo-custom">Qual é o modelo? <span class="opcional">(opcional)</span></label>
                <input id="eq-modelo-custom" v-model="eqModeloCustom" class="input" type="text" placeholder="Digite o modelo" />
              </div>
            </div>
            <div v-else-if="eqModelo === OUTRO" class="field">
              <label for="eq-modelo-custom2">Qual é o modelo? *</label>
              <input id="eq-modelo-custom2" v-model="eqModeloCustom" class="input" type="text" placeholder="Digite o modelo" />
            </div>
            <p v-if="carregandoEquip" class="bloco-info">Carregando equipamentos...</p>
            <p v-else-if="equipamentoDescricao" class="bloco-info">
              <FileText :size="14" />
              Equipamento selecionado: <strong>{{ equipamentoDescricao }}</strong>
            </p>
            <p v-else class="bloco-info neutro">
              {{ eqCategorias.length }} equipamento(s) no catálogo. Complete a seleção acima.
            </p>
          </section>
        </div>

        <footer class="acoes-rodape">
          <button type="button" class="btn btn-outline" @click="voltarHome">
            <ArrowLeft :size="15" />
            Voltar
          </button>
          <button
            v-if="podeAvancarPerguntas"
            type="button"
            class="btn btn-continuar btn-grande"
            :style="{ background: corCategoria }"
            @click="avancarParaIdentificacao"
          >
            Continuar
            <ArrowRight :size="15" />
          </button>
        </footer>
      </template>
      <!-- ==================== ETAPA 2 — IDENTIFICAÇÃO ==================== -->
      <template v-else-if="passo === 2 && categoriaSelecionada">
        <header class="etapa-head">
          <div class="etapa-topo">
            <button type="button" class="btn-ghost" @click="voltarPerguntas">
              <ArrowLeft :size="14" />
              Voltar
            </button>
            <span class="badge-cat" :style="{ background: corCategoria }">{{ categoriaSelecionada.nome }}</span>
          </div>
          <h1>Identificação</h1>
          <p class="etapa-sub">Informe seus dados para concluir o chamado.</p>
        </header>

        <div class="resumo-pills" aria-label="Resumo do chamado">
          <span v-for="pill in resumoPills" :key="pill" class="pill">{{ pill }}</span>
        </div>

        <form novalidate @submit.prevent="enviar">
          <div v-if="erroEnvio" class="erro-envio" role="alert">
            <AlertTriangle :size="16" />
            <p>{{ erroEnvio }}</p>
          </div>

          <section class="card bloco">
            <div class="field">
              <label for="f-nome">Nome completo *</label>
              <input
                id="f-nome"
                v-model="ident.nome"
                class="input"
                :class="{ inv: erros.nome }"
                type="text"
                placeholder="Ex.: Maria Silva"
                :aria-invalid="!!erros.nome"
              />
              <p v-if="erros.nome" class="erro-campo">{{ erros.nome }}</p>
            </div>
            <div class="field">
              <label for="f-cargo">Cargo/Função *</label>
              <select id="f-cargo" v-model="ident.cargo" class="select-input" :class="{ inv: erros.cargo }" :aria-invalid="!!erros.cargo">
                <option value="" disabled>— Selecione —</option>
                <option v-for="c in CARGOS" :key="c" :value="c">{{ c }}</option>
              </select>
              <p v-if="erros.cargo" class="erro-campo">{{ erros.cargo }}</p>
            </div>
            <div class="field">
              <label for="f-email">E-mail institucional *</label>
              <input
                id="f-email"
                v-model="ident.email"
                class="input"
                :class="{ inv: erros.email }"
                type="email"
                placeholder="nome@educacao.sp.gov.br"
                :aria-invalid="!!erros.email"
              />
              <p v-if="erros.email" class="erro-campo">{{ erros.email }}</p>
            </div>
            <div class="field">
              <label for="f-escola">Escola/Unidade *</label>
              <select id="f-escola" v-model="ident.escola" class="select-input" :class="{ inv: erros.escola }" :disabled="carregandoEscolas" :aria-invalid="!!erros.escola">
                <option value="" disabled>— Selecione a escola —</option>
                <option v-for="e in escolas" :key="e" :value="e">{{ e }}</option>
              </select>
              <p v-if="erros.escola" class="erro-campo">{{ erros.escola }}</p>
            </div>
          </section>

          <section class="card bloco">
            <div class="field">
              <label for="f-desc">Descrição adicional <span class="opcional">(opcional)</span></label>
              <textarea
                id="f-desc"
                v-model="ident.descricaoAdicional"
                class="input textarea"
                rows="4"
                placeholder="Algo mais que a equipe deva saber?"
              ></textarea>
            </div>

            <div class="field">
              <span id="lbl-urgencia" class="label-urgencia">Urgência *</span>
              <div class="urgencias" role="radiogroup" aria-labelledby="lbl-urgencia">
                <button
                  v-for="u in URGENCIAS"
                  :key="u"
                  type="button"
                  class="urgencia"
                  :class="[u.toLowerCase().replace('é', 'e'), { sel: ident.urgencia === u }]"
                  role="radio"
                  :aria-checked="ident.urgencia === u"
                  @click="ident.urgencia = u"
                >
                  {{ u }}
                  <small v-if="u === 'Alta'">(impacta o funcionamento)</small>
                </button>
              </div>
              <p v-if="erros.urgencia" class="erro-campo">{{ erros.urgencia }}</p>
            </div>

            <div class="field">
              <label for="anexo">
                Anexo
                <span v-if="exigeAnexo" class="anexo-req">(obrigatório — fotos dos locais)</span>
                <span v-else class="opcional">(opcional — print ou foto do problema, máx. 10 MB)</span>
              </label>
              <input id="anexo" type="file" class="input arquivo" accept="image/*,.pdf" @change="onAnexoChange" />
              <p v-if="erros.anexo" class="erro-campo">{{ erros.anexo }}</p>
              <div v-if="anexo" class="anexo-info">
                <Paperclip :size="14" />
                <span>{{ anexo.name }} ({{ formatarTamanho(anexo.size) }})</span>
                <button type="button" class="anexo-remover" @click="removerAnexo">remover</button>
              </div>
            </div>
          </section>

          <footer class="acoes-rodape">
            <button type="button" class="btn btn-outline" @click="voltarPerguntas">
              <ArrowLeft :size="15" />
              Voltar
            </button>
            <button type="submit" class="btn btn-primary btn-grande" :disabled="enviando">
              <Loader2 v-if="enviando" class="spin" :size="16" />
              <Send v-else :size="16" />
              {{ enviando ? 'Enviando...' : 'Enviar chamado' }}
            </button>
          </footer>
        </form>
      </template>

      <!-- ==================== ETAPA 3 — SUCESSO ==================== -->
      <div v-else-if="passo === 3" class="card sucesso">
        <div class="selo"><CheckCircle2 :size="34" :stroke-width="2.2" /></div>
        <h2>Chamado registrado!</h2>
        <p class="sucesso-sub">Seu protocolo é:</p>
        <div class="protocolo-linha">
          <div class="protocolo-chip">{{ protocolo }}</div>
          <button type="button" class="btn btn-outline btn-copiar" @click="copiarProtocolo">
            <component :is="protocoloCopiado ? CheckCircle2 : Copy" :size="15" />
            {{ protocoloCopiado ? 'Copiado!' : 'Copiar' }}
          </button>
        </div>
        <p class="sucesso-dica">
          Guarde este número. A equipe do SETEC foi notificada e entrará em contato com a sua unidade.
        </p>
        <div class="sucesso-acoes">
          <RouterLink to="/consulta" class="btn btn-primary btn-grande">
            <Search :size="15" />
            Acompanhar chamado
          </RouterLink>
          <button type="button" class="btn btn-outline btn-grande" @click="novoChamado">Abrir outro chamado</button>
        </div>
      </div>
      </div>
    </main>

    <footer class="leg-rodape">
      SETEC · Unidade Regional de Ensino Leste 3 · Governo do Estado de São Paulo
    </footer>
  </div>
</template>

<style scoped>
.wiz-page {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* ---------- home ---------- */

.eyebrow {
  font-size: 11.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--blue);
  font-weight: 700;
  margin: 0 0 6px;
}

.home-head h1,
.etapa-head h1 {
  color: #16222e;
  font-size: 26px;
}

.home-sub,
.etapa-sub {
  color: #5a6b7a;
  font-size: 14px;
  margin: 6px 0 0;
  max-width: 60ch;
}

.home-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.cat-card {
  text-align: left;
  border-left: 4px solid var(--blue);
  background: var(--surface);
  border-top: 1px solid var(--border);
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: 14px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.cat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.cat-icone {
  display: inline-flex;
}

.cat-nome {
  font-size: 14.5px;
}

.cat-desc {
  color: var(--text-muted);
  font-size: 12.5px;
  line-height: 1.45;
}

.cat-link {
  font-size: 12px;
  font-weight: 600;
  color: var(--blue);
  margin-top: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.contato {
  background: var(--sidebar-bg);
  color: #fff;
  padding: 16px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.contato-info h2 {
  color: #9fc3e8;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0 0 3px;
}

.contato-nome {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.contato-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: #bfdaee;
}

.contato-acoes {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: rgb(255 255 255 / 0.07);
  border: 1px solid rgb(255 255 255 / 0.3);
}

.btn-pill:hover {
  background: rgb(255 255 255 / 0.16);
}
/* ---------- etapas ---------- */

.etapa-lista {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.etapa-head {
  margin-bottom: 2px;
}

.etapa-topo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #134e8c;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid #dde6ee;
  background: #ffffff;
}

.btn-ghost:hover {
  background: #e7f1fa;
}

.badge-cat {
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 10px;
  border-radius: 999px;
}

.bloco {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bloco-titulo {
  font-size: 14.5px;
}

.req {
  color: var(--red);
}

.bloco-ajuda {
  margin: 0;
  color: var(--text-muted);
  font-size: 12.5px;
}

.opcoes {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.opcao {
  border: 1.5px solid var(--border-strong);
  border-radius: var(--radius-sm);
  padding: 11px 14px;
  text-align: left;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--surface);
  transition: border-color 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
}

.opcao:hover {
  border-color: var(--blue);
  box-shadow: var(--shadow-sm);
  background: var(--surface-muted);
}

.opcao-radio {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  flex-shrink: 0;
  transition: border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;
}

.opcao.sel {
  border-color: var(--cat-cor, var(--blue));
  background: var(--surface-muted);
  background: color-mix(in srgb, var(--cat-cor, var(--blue)) 8%, var(--surface));
}

.opcao.sel .opcao-radio {
  border-color: var(--cat-cor, var(--blue));
  background: var(--cat-cor, var(--blue));
  box-shadow: inset 0 0 0 3px var(--surface);
}

/* Caixa de texto livre da pseudo-opção "Outro (descrever)" */
.outro-box {
  margin-top: 10px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
}

.outro-box label {
  display: block;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.alerta {
  margin-top: 10px;
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 13px;
}

.alerta .alerta-corpo {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.alerta p {
  margin: 0;
}

.alerta.info {
  background: var(--blue-soft);
  color: #1e3a8a;
}

.alerta.aviso {
  background: var(--yellow-soft);
  color: #92400e;
}

.alerta-link {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.7);
  font-weight: 700;
}

.alerta-acoes {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.alerta-voltar {
  padding: 6px 10px;
  font-size: 12px;
}

.erro-envio {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--red-soft);
  color: var(--red);
  font-weight: 600;
  font-size: 13px;
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  margin-bottom: 14px;
}

.erro-envio p {
  margin: 0;
}

.textarea {
  resize: vertical;
  min-height: 110px;
}

.erro-campo {
  margin: 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--red);
}

.inv {
  border-color: var(--red) !important;
}

.anexo-req {
  color: var(--red);
  font-weight: 700;
}

.anexo-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--text-secondary);
  background: var(--surface-muted);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
}

.anexo-remover {
  margin-left: auto;
  color: var(--red);
  font-size: 12px;
  font-weight: 600;
  text-decoration: underline;
}

.resumo-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pill {
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
}

.acoes-rodape {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.btn-grande {
  padding: 12px 20px;
  min-width: 220px;
  justify-content: center;
  font-size: 15px;
}

.btn-continuar {
  color: #fff;
}

.urgencias {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.urgencia {
  border: 1.5px solid var(--border-strong);
  background: var(--surface);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: transform 0.08s ease, border-color 0.12s ease, box-shadow 0.12s ease;
}

.urgencia:hover {
  box-shadow: var(--shadow-sm);
}

.urgencia.baixa.sel {
  background: var(--green-soft);
  border-color: var(--green);
  color: var(--green);
}

.urgencia.media.sel {
  background: var(--yellow-soft);
  border-color: var(--yellow);
  color: var(--yellow);
}

.urgencia.alta.sel {
  background: var(--red-soft);
  border-color: var(--red);
  color: var(--red);
}

.urgencia small {
  color: var(--text-muted);
  font-size: 11.5px;
}

.dupla {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.tripla {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;
}

@media (max-width: 640px) {
  .dupla,
  .tripla,
  .urgencias {
    grid-template-columns: 1fr;
  }
  .home-grid {
    grid-template-columns: 1fr;
  }
}

/* ---------- estados ---------- */

.estado,
.aviso {
  padding: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--text-secondary);
}

.aviso {
  color: var(--red);
  font-weight: 500;
}

.estado p,
.aviso p {
  margin: 0;
}


.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ---------- sucesso ---------- */

.sucesso {
  padding: 40px 28px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.selo {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--green-soft);
  color: var(--green);
  margin-bottom: 8px;
}

.sucesso h2 {
  font-size: 22px;
}

.sucesso-sub {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.protocolo-linha {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.protocolo-chip {
  background: var(--blue-soft);
  color: #1d4ed8;
  font-weight: 800;
  font-size: 20px;
  letter-spacing: 0.03em;
  padding: 10px 18px;
  border-radius: 999px;
  margin: 6px 0 2px;
}

.btn-copiar {
  padding: 8px 14px;
}

.sucesso-dica {
  margin: 0 0 14px;
  color: var(--text-muted);
  font-size: 13px;
  max-width: 46ch;
}

.sucesso-acoes {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.opcional {
  font-weight: 400;
  color: var(--text-muted);
}

.label-urgencia {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.arquivo {
  padding: 8px 12px;
}

.bloco-info {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--blue);
  background: var(--blue-soft);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
}

.bloco-info.neutro {
  color: var(--text-secondary);
  background: var(--surface-muted);
}

/* ---------- Shell no padrão do formulário antigo ---------- */

/* Loading de página inteira: nada renderiza até as perguntas carregarem */
.boot-loading {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  background: #f5f8fb;
  color: #0b3d6b;
  font-weight: 600;
  font-size: 14px;
}

.leg-app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f8fb;
}

.leg-topo {
  background: #ffffff;
  border-bottom: 1px solid #dde6ee;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.leg-logo {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  flex-shrink: 0;
}

.leg-topo-org {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  min-width: 0;
}

.leg-topo-org small {
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #5a6b7a;
  font-weight: 600;
}

.leg-topo-org strong {
  font-size: 14px;
  font-weight: 700;
  color: #0b3d6b;
}

.leg-main {
  flex: 1;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 28px 20px 60px;
}

.leg-rodape {
  text-align: center;
  padding: 16px;
  font-size: 12px;
  color: #5a6b7a;
  border-top: 1px solid #dde6ee;
  background: #ffffff;
}

/* Busca de chamado por protocolo */
.busca-chamado {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  padding: 16px 18px;
}

.busca-info {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--blue);
  min-width: 0;
}

.busca-info h2 {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.busca-info p {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: var(--text-muted);
}

.busca-grupo {
  display: flex;
  flex-shrink: 0;
}

.busca-grupo input {
  border: 1.5px solid var(--border-strong);
  border-right: none;
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  padding: 10px 12px;
  font-size: 13.5px;
  font-family: inherit;
  min-width: 220px;
  color: var(--text-primary);
  background: var(--surface);
}

.busca-grupo input:focus {
  outline: none;
  border-color: var(--blue);
  box-shadow: 0 0 0 3px var(--blue-soft);
  position: relative;
  z-index: 1;
}

.busca-grupo button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  border: 1.5px solid var(--blue);
  background: var(--blue);
  color: #fff;
  font-size: 13.5px;
  font-weight: 700;
  font-family: inherit;
}

.busca-grupo button:disabled {
  background: #9fb8cc;
  border-color: #9fb8cc;
  cursor: not-allowed;
}

.busca-grupo button:not(:disabled):hover {
  filter: brightness(1.08);
}

@media (max-width: 640px) {
  .busca-chamado {
    flex-direction: column;
    align-items: stretch;
  }
  .busca-grupo {
    flex-direction: column;
  }
  .busca-grupo input {
    min-width: 0;
    border-right: 1.5px solid var(--border-strong);
    border-bottom: none;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  }
  .busca-grupo button {
    justify-content: center;
    border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  }
  .contato {
    flex-direction: column;
    align-items: stretch;
  }
  .contato-acoes .btn-pill {
    flex: 1;
    justify-content: center;
  }
  .leg-logo {
    width: 42px;
    height: 42px;
  }
}
</style>