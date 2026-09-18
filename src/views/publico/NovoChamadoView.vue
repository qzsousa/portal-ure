<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { AxiosError } from 'axios'
import {
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  Paperclip,
  Search,
  Send,
} from '@lucide/vue'
import PublicoLayout from '@/components/publico/PublicoLayout.vue'
import { useUiStore } from '@/stores/ui'
import {
  criarChamadoPublico,
  listarCategoriasEquipamento,
  listarEscolasPublico,
  listarMarcasEquipamento,
  listarModelosEquipamento,
  type NovoChamadoPayload,
} from '@/api/publico'

const ui = useUiStore()

/** Opção especial "digitar manualmente" (mesma ideia do formulário antigo). */
const OUTRO = '__OUTRO__'
const TAMANHO_MAX_ANEXO = 10 * 1024 * 1024 // 10 MB
/** Urgências — textos EXATOS do formulário público antigo. */
const URGENCIAS = ['Baixa', 'Média', 'Alta']

const escolas = ref<string[]>([])
const categorias = ref<string[]>([])
const marcas = ref<string[]>([])
const modelos = ref<string[]>([])
const carregandoListas = ref(true)

const form = reactive({
  unidade: '',
  solicitante: '',
  funcao: '',
  categoria: '',
  marca: '',
  modelo: '',
  descricao: '',
  urgencia: '',
  email: '',
})
const customMarca = ref('')
const customModelo = ref('')
const anexo = ref<File | null>(null)

const erros = reactive<Record<string, string>>({})
const enviando = ref(false)
const protocoloSucesso = ref('')
const copiado = ref(false)

/* ---------- listas remotas ---------- */

onMounted(async () => {
  try {
    const [esc, cat] = await Promise.all([listarEscolasPublico(), listarCategoriasEquipamento()])
    escolas.value = esc
    categorias.value = cat
  } catch {
    ui.error('Não foi possível carregar as listas. Recarregue a página.')
  } finally {
    carregandoListas.value = false
  }
})

watch(
  () => form.categoria,
  async (categoria) => {
    form.marca = ''
    form.modelo = ''
    customMarca.value = ''
    customModelo.value = ''
    marcas.value = []
    modelos.value = []
    if (!categoria) return
    try {
      marcas.value = await listarMarcasEquipamento(categoria)
    } catch {
      marcas.value = []
    }
  },
)

watch(
  () => form.marca,
  async (marca) => {
    form.modelo = ''
    customModelo.value = ''
    modelos.value = []
    if (!form.categoria || !marca || marca === OUTRO) return
    try {
      modelos.value = await listarModelosEquipamento(form.categoria, marca)
    } catch {
      modelos.value = []
    }
  },
)

/* ---------- tipo final ---------- */

const tipoFinal = computed(() => {
  const marca = form.marca === OUTRO ? customMarca.value.trim() : form.marca
  const modelo = form.modelo === OUTRO ? customModelo.value.trim() : form.modelo
  return [form.categoria, marca, modelo].filter(Boolean).join(' - ')
})

/* ---------- anexo ---------- */

function onAnexoChange(e: Event) {
  erros.anexo = ''
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] || null
  if (file && file.size > TAMANHO_MAX_ANEXO) {
    anexo.value = null
    input.value = ''
    erros.anexo = 'O arquivo é muito grande. O tamanho máximo é 10 MB.'
    return
  }
  anexo.value = file
}

function removerAnexo() {
  anexo.value = null
  const input = document.getElementById('anexo') as HTMLInputElement | null
  if (input) input.value = ''
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/* ---------- validação / envio ---------- */

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validar(): boolean {
  Object.keys(erros).forEach((k) => delete erros[k])
  if (!form.unidade) erros.unidade = 'Selecione a unidade escolar.'
  if (!form.solicitante.trim()) erros.solicitante = 'Informe o nome do solicitante.'
  if (!form.categoria) erros.categoria = 'Selecione o tipo de problema.'
  else if (form.marca === OUTRO && !customMarca.value.trim()) erros.marca = 'Digite a marca do equipamento.'
  else if (form.modelo === OUTRO && !customModelo.value.trim()) erros.modelo = 'Digite o modelo do equipamento.'
  if (!form.descricao.trim()) erros.descricao = 'Descreva o problema com o máximo de detalhes.'
  if (!form.urgencia) erros.urgencia = 'Selecione a urgência.'
  if (form.email.trim() && !emailValido(form.email.trim())) erros.email = 'Informe um e-mail válido (ex.: nome@educacao.sp.gov.br).'
  return Object.keys(erros).length === 0
}

async function enviar() {
  if (enviando.value) return
  if (!validar()) return

  enviando.value = true
  try {
    const payload: NovoChamadoPayload = {
      unidade: form.unidade,
      solicitante: form.solicitante.trim(),
      tipo: tipoFinal.value,
      descricao: form.descricao.trim(),
      urgencia: form.urgencia,
    }
    if (form.funcao.trim()) payload.funcao = form.funcao.trim()
    if (form.email.trim()) payload.email = form.email.trim()
    if (anexo.value) {
      payload.anexoBase64 = await fileToBase64(anexo.value)
      payload.anexoNome = anexo.value.name
      payload.anexoTipo = anexo.value.type
    }

    const chamado = await criarChamadoPublico(payload)
    protocoloSucesso.value = chamado.protocolo
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e) {
    const err = e as AxiosError<{ message?: string }>
    if (err.response?.status === 413) {
      ui.error('O anexo é muito grande para ser enviado. Tente um arquivo menor.')
    } else {
      ui.error(err.response?.data?.message || 'Não foi possível enviar o chamado. Tente novamente.')
    }
  } finally {
    enviando.value = false
  }
}

async function copiarProtocolo() {
  try {
    await navigator.clipboard.writeText(protocoloSucesso.value)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = protocoloSucesso.value
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  copiado.value = true
  ui.success('Protocolo copiado!')
  window.setTimeout(() => (copiado.value = false), 2500)
}

function novoChamado() {
  protocoloSucesso.value = ''
  form.unidade = ''
  form.solicitante = ''
  form.funcao = ''
  form.categoria = ''
  form.marca = ''
  form.modelo = ''
  form.descricao = ''
  form.urgencia = ''
  form.email = ''
  customMarca.value = ''
  customModelo.value = ''
  anexo.value = null
  Object.keys(erros).forEach((k) => delete erros[k])
}
</script>

<template>
  <PublicoLayout>
    <!-- ===== Sucesso ===== -->
    <div v-if="protocoloSucesso" class="card sucesso">
      <div class="selo"><CheckCircle2 :size="30" :stroke-width="2" /></div>
      <h2>Chamado registrado!</h2>
      <p class="sucesso-sub">Anote o número do protocolo — ele é o comprovante da sua solicitação:</p>
      <div class="protocolo-box">
        <strong class="protocolo-num">{{ protocoloSucesso }}</strong>
        <button type="button" class="btn btn-outline btn-copiar" @click="copiarProtocolo">
          <component :is="copiado ? Check : Copy" :size="15" />
          {{ copiado ? 'Copiado!' : 'Copiar' }}
        </button>
      </div>
      <p class="sucesso-dica">A equipe de tecnologia (SETEC) foi notificada e vai atender o seu chamado.</p>
      <div class="sucesso-acoes">
        <RouterLink to="/consulta" class="btn btn-primary">
          <Search :size="15" />
          Acompanhar chamado
        </RouterLink>
        <button type="button" class="btn btn-outline" @click="novoChamado">Abrir outro chamado</button>
      </div>
    </div>

    <!-- ===== Formulário ===== -->
    <template v-else>
      <header class="cabecalho">
        <h1>Abrir um chamado</h1>
        <p>
          Relate o problema de tecnologia da sua escola. A equipe do SETEC (URE Leste 3) recebe o
          chamado na hora e entra em contato.
        </p>
      </header>

      <form class="card form" novalidate @submit.prevent="enviar">
        <div class="field">
          <label for="unidade">Unidade escolar *</label>
          <select id="unidade" v-model="form.unidade" class="select-input" :disabled="carregandoListas">
            <option value="" disabled>— Selecione a escola —</option>
            <option v-for="e in escolas" :key="e" :value="e">{{ e }}</option>
          </select>
          <p v-if="erros.unidade" class="erro-campo">{{ erros.unidade }}</p>
        </div>

        <div class="dupla">
          <div class="field">
            <label for="solicitante">Seu nome completo *</label>
            <input id="solicitante" v-model="form.solicitante" class="input" type="text" placeholder="Ex.: Maria Silva" />
            <p v-if="erros.solicitante" class="erro-campo">{{ erros.solicitante }}</p>
          </div>
          <div class="field">
            <label for="funcao">Função <span class="opcional">(opcional)</span></label>
            <input id="funcao" v-model="form.funcao" class="input" type="text" placeholder="Ex.: Diretor, Secretário..." />
          </div>
        </div>

        <fieldset class="grupo">
          <legend>Tipo de problema *</legend>
          <div class="tripla">
            <div class="field">
              <label for="categoria">Categoria *</label>
              <select id="categoria" v-model="form.categoria" class="select-input" :disabled="carregandoListas">
                <option value="" disabled>— Selecione —</option>
                <option v-for="c in categorias" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
            <div class="field">
              <label for="marca">Marca <span class="opcional">(opcional)</span></label>
              <select id="marca" v-model="form.marca" class="select-input" :disabled="!form.categoria">
                <option value="">— Selecione —</option>
                <option v-for="m in marcas" :key="m" :value="m">{{ m }}</option>
                <option v-if="form.categoria" :value="OUTRO">Outra (digitar manualmente)</option>
              </select>
            </div>
            <div class="field">
              <label for="modelo">Modelo <span class="opcional">(opcional)</span></label>
              <select id="modelo" v-model="form.modelo" class="select-input" :disabled="!form.marca || form.marca === OUTRO">
                <option value="">— Selecione —</option>
                <option v-for="m in modelos" :key="m" :value="m">{{ m }}</option>
                <option v-if="form.marca && form.marca !== OUTRO" :value="OUTRO">Outro (digitar manualmente)</option>
              </select>
            </div>
          </div>
          <div v-if="form.marca === OUTRO" class="dupla">
            <div class="field">
              <label for="custom-marca">Qual é a marca? *</label>
              <input id="custom-marca" v-model="customMarca" class="input" type="text" placeholder="Digite a marca" />
              <p v-if="erros.marca" class="erro-campo">{{ erros.marca }}</p>
            </div>
            <div class="field">
              <label for="custom-modelo">Qual é o modelo?</label>
              <input id="custom-modelo" v-model="customModelo" class="input" type="text" placeholder="Digite o modelo (opcional)" />
            </div>
          </div>
          <div v-else-if="form.modelo === OUTRO" class="field">
            <label for="custom-modelo2">Qual é o modelo? *</label>
            <input id="custom-modelo2" v-model="customModelo" class="input" type="text" placeholder="Digite o modelo" />
            <p v-if="erros.modelo" class="erro-campo">{{ erros.modelo }}</p>
          </div>
          <p v-if="erros.categoria" class="erro-campo">{{ erros.categoria }}</p>
          <p v-if="tipoFinal" class="tipo-preview">
            <FileText :size="14" /> Será registrado como: <strong>{{ tipoFinal }}</strong>
          </p>
        </fieldset>

        <div class="field">
          <label for="descricao">Descrição do problema *</label>
          <textarea
            id="descricao"
            v-model="form.descricao"
            class="input textarea"
            rows="5"
            placeholder="Conte o que está acontecendo: onde é, desde quando, quantos equipamentos são afetados..."
          ></textarea>
          <p v-if="erros.descricao" class="erro-campo">{{ erros.descricao }}</p>
        </div>

        <div class="dupla">
          <div class="field">
            <label for="urgencia">Urgência *</label>
            <select id="urgencia" v-model="form.urgencia" class="select-input">
              <option value="" disabled>— Selecione a urgência —</option>
              <option v-for="u in URGENCIAS" :key="u" :value="u">{{ u }}</option>
            </select>
            <p v-if="erros.urgencia" class="erro-campo">{{ erros.urgencia }}</p>
          </div>
          <div class="field">
            <label for="email">E-mail <span class="opcional">(opcional)</span></label>
            <input id="email" v-model="form.email" class="input" type="email" placeholder="nome@educacao.sp.gov.br" />
            <p v-if="erros.email" class="erro-campo">{{ erros.email }}</p>
            <p v-else class="dica">Se informado, você recebe o protocolo e atualizações por e-mail.</p>
          </div>
        </div>

        <div class="field">
          <label for="anexo">Anexo <span class="opcional">(opcional — foto ou print do problema, máx. 10 MB)</span></label>
          <input id="anexo" type="file" class="input arquivo" accept="image/*,.pdf" @change="onAnexoChange" />
          <p v-if="erros.anexo" class="erro-campo">{{ erros.anexo }}</p>
          <div v-if="anexo" class="anexo-info">
            <Paperclip :size="14" />
            <span>{{ anexo.name }} ({{ formatarTamanho(anexo.size) }})</span>
            <button type="button" class="anexo-remover" @click="removerAnexo">remover</button>
          </div>
        </div>

        <button type="submit" class="btn btn-gold btn-enviar" :disabled="enviando || carregandoListas">
          <Loader2 v-if="enviando" class="spin" :size="16" />
          <Send v-else :size="16" />
          {{ enviando ? 'Enviando...' : 'Enviar chamado' }}
        </button>
      </form>
    </template>
  </PublicoLayout>
</template>

<style scoped>
.cabecalho {
  margin-bottom: 20px;
}

.cabecalho h1 {
  color: #fff;
  font-size: 26px;
}

.cabecalho p {
  margin: 6px 0 0;
  color: rgb(255 255 255 / 0.7);
  font-size: 14px;
  max-width: 60ch;
}

.form {
  padding: 26px 26px 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
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
  .tripla {
    grid-template-columns: 1fr;
  }
}

.grupo {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 16px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.grupo legend {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 0 6px;
}

.opcional {
  font-weight: 400;
  color: var(--text-muted);
}

.textarea {
  resize: vertical;
  min-height: 110px;
}

.dica {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.erro-campo {
  margin: 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--red);
}

.tipo-preview {
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

.arquivo {
  padding: 8px 12px;
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

.btn-enviar {
  justify-content: center;
  padding: 13px;
  font-size: 15px;
}

/* ---------- sucesso ---------- */

.sucesso {
  padding: 40px 28px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.selo {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--green-soft);
  color: var(--green);
  margin-bottom: 16px;
}

.sucesso h2 {
  font-size: 22px;
}

.sucesso-sub {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.protocolo-box {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  margin: 20px 0 12px;
}

.protocolo-num {
  background: var(--sidebar-bg);
  color: var(--brand-gold);
  font-size: 20px;
  letter-spacing: 0.04em;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
}

.btn-copiar {
  padding: 8px 14px;
}

.sucesso-dica {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
}

.sucesso-acoes {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 24px;
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
