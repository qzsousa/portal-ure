<template>
  <div class="apple-page">
    <header class="apple-topo">
      <div class="apple-topo-inner">
        <div class="apple-topo-brand">
          <img src="/logo-ure.png" alt="Brasão da URE Leste 3" class="apple-logo" />
          <div class="apple-topo-org">
            <small>Governo do Estado de São Paulo</small>
            <strong>SETEC — Unidade Regional de Ensino Leste 3</strong>
          </div>
        </div>
        <RouterLink to="/chamado/novo" class="apple-topo-link">
          <span>Formulário clássico</span>
          <ArrowRight :size="14" />
        </RouterLink>
      </div>
    </header>

    <main class="apple-main">
      <div class="apple-chat">
        <header class="apple-head">
          <div class="apple-brand">
            <div class="apple-avatar">
              <img src="/logoCafeIA.png" alt="CaféIA" class="apple-avatar-logo" />
            </div>
            <div class="apple-brand-text">
              <strong>CaféIA</strong>
              <small>Assistente de chamados · URE Leste 3</small>
            </div>
          </div>
          <div class="apple-head-right">
            <span class="apple-status-dot" aria-hidden="true"></span>
            <span class="apple-modelo">{{ modeloIa }}</span>
            <button class="apple-nova-btn" type="button" @click="novaConversa" title="Nova conversa">Nova</button>
          </div>
        </header>

        <div class="apple-stream" ref="chatBox">
          <Transition name="rise">
            <div v-if="!mensagens.length" class="apple-welcome">
              <div class="apple-welcome-icon">
                <img src="/logoCafeIA.png" alt="CaféIA" class="apple-welcome-logo" />
              </div>
              <h2>Olá! Eu sou a CaféIA.</h2>
              <p>Conte o que está acontecendo e eu te ajudo a abrir um chamado, passo a passo.</p>
              <div class="apple-chips">
                <button v-for="s in sugestoes" :key="s" class="apple-chip" @click="perguntar(s)">
                  <Sparkles :size="13" />
                  {{ s }}
                </button>
              </div>
            </div>
          </Transition>

          <TransitionGroup name="msg" tag="div" class="apple-stream-inner">
            <article v-for="(m, i) in mensagens" :key="i" class="apple-msg" :class="m.role">
              <div class="apple-ava" :class="m.role">
                <span v-if="m.role === 'user'">{{ inicialUsuario }}</span>
                <img v-else class="apple-ava-logo" src="/logoCafeIA.png" alt="" />
              </div>
              <div class="apple-body">
                <span class="apple-name">{{ m.role === 'user' ? 'Você' : 'CaféIA' }}</span>
                <div class="apple-bubble" v-html="formatarTexto(m.content)"></div>
              </div>
            </article>
          </TransitionGroup>

          <Transition name="msg">
            <article v-if="enviando" class="apple-msg assistant">
              <div class="apple-ava assistant">
                <img class="apple-ava-logo" src="/logoCafeIA.png" alt="" />
              </div>
              <div class="apple-body">
                <span class="apple-name">CaféIA</span>
                <div class="apple-bubble typing">
                  <span class="dot-wave"><i></i><i></i><i></i></span>
                  <span class="typing-note">consultando…</span>
                </div>
              </div>
            </article>
          </Transition>
        </div>

        <!-- Formulário de identificação (modal) -->
        <div v-if="mostrarForm" class="form-modal-backdrop">
          <div class="apple-form-inline">
          <h3 class="form-title">Identificação</h3>
          <div class="form-row">
            <label>Escola/Unidade *</label>
            <select v-model="formEscola" class="form-select" :disabled="carregandoEscolasForm">
              <option value="" disabled>{{ carregandoEscolasForm ? 'Carregando...' : '— Selecione a escola —' }}</option>
              <option v-for="e in escolasForm" :key="e" :value="e">{{ e }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>Cargo/Função *</label>
            <select v-model="formCargo" class="form-select">
              <option value="" disabled>— Selecione —</option>
              <option v-for="c in CARGOS_FORM" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>Urgência *</label>
            <select v-model="formUrgencia" class="form-select">
              <option value="" disabled>— Selecione —</option>
              <option v-for="u in URGENCIAS_FORM" :key="u" :value="u">{{ u }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>Nome completo (opcional se já informado)</label>
            <input v-model="formNome" class="form-input" type="text" placeholder="Ex.: Maria Silva" />
          </div>
          <div class="form-row">
            <label>E-mail institucional *</label>
            <input v-model="formEmail" class="form-input" type="email" placeholder="nome@educacao.sp.gov.br" />
          </div>
          <div class="form-actions">
            <button type="button" class="form-cancel" @click="mostrarForm = false">Cancelar</button>
            <button type="button" class="form-submit" @click="enviarFormIdentificacao" :disabled="!formEscola || !formCargo || !formUrgencia || !formEmail.trim()">Enviar</button>
           </div>
         </div>
        </div>

         <form class="apple-composer" @submit.prevent="enviar">
          <div class="apple-composer-field">
            <Sparkles :size="16" class="apple-composer-icon" />
            <textarea
              v-model="entrada"
              class="apple-composer-input"
              placeholder="Descreva o problema ou peça para abrir um chamado… (Enter envia, Ctrl+Enter pula linha)"
              :disabled="enviando"
              rows="1"
              @keydown="onComposerKeydown"
              @input="autoResizeComposer"
            ></textarea>
          </div>
          <button class="apple-send" type="submit" :disabled="enviando || !entrada.trim()" aria-label="Enviar">
            <Send :size="17" />
          </button>
        </form>
        <p class="apple-aviso">Nunca informe senhas. A CaféIA não solicita nem armazena senhas.</p>
      </div>
    </main>

    <footer class="apple-rodape">
      <span>SETEC · Unidade Regional de Ensino Leste 3</span>
      <span class="apple-rodape-sep">·</span>
      <span>Governo do Estado de São Paulo</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight, Send, Sparkles } from '@lucide/vue'
import {
  chamarIAPublico,
  listarEscolasPublico,
  getFormularioPublico,
  listarCategoriasEquipamento,
  listarMarcasEquipamento,
  listarModelosEquipamento,
  consultarChamadoPorProtocolo,
  criarChamadoPublico,
  type NovoChamadoPayload,
  type FormularioCategoria,
} from '@/api/publico'

interface Msg { role: 'user' | 'assistant' | 'tool'; content: string; reasoning_content?: string | null }

const STORAGE_KEY = 'cafeia_publico_conversa'
const mensagens = ref<Msg[]>([])
const entrada = ref('')
const enviando = ref(false)
const chatBox = ref<HTMLElement | null>(null)

// Formulário de identificação inline
const mostrarForm = ref(false)
const escolasForm = ref<string[]>([])
const formEscola = ref('')
const formCargo = ref('')
const formUrgencia = ref('')
const formNome = ref('')
const formEmail = ref('')
const carregandoEscolasForm = ref(false)

const CARGOS_FORM = ['Professor', 'Coordenador Pedagógico', 'Diretor', 'Vice-Diretor', 'Secretário', 'Outro']
const URGENCIAS_FORM = ['Baixa', 'Média', 'Alta']

// Carrega conversa salva
try {
  const salvo = localStorage.getItem(STORAGE_KEY)
  if (salvo) {
    const parsed = JSON.parse(salvo)
    if (Array.isArray(parsed)) mensagens.value = parsed
  }
} catch { /* ignore */ }

// Salva conversa com debounce
let saveTimer: ReturnType<typeof setTimeout> | null = null
watch(mensagens, (v) => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)) } catch { /* ignore */ }
  }, 500)
}, { deep: true })
const inicialUsuario = 'V'
const modeloIa = 'CaféIA'

const sugestoes = [
  'Quero abrir um chamado de rede',
  'Um equipamento está quebrado',
  'Problema com o PortalNet',
  'Esqueci minha senha do sistema',
]

function formatarTexto(txt: string) {
  const esc = txt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // Botões de opção: [[opção1|opção2|opção3]] vira grupo de botões clicáveis.
  const withOpts = esc.replace(/\[\[(.+?)\]\]/g, (_m, inner) => {
    if (inner.trim() === 'FORM') {
      return '<div class="form-placeholder">Formulário de identificação</div>' +
        '<button type="button" class="form-reopen-btn" data-action="reopen-form">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>' +
        'Abrir formulário</button>'
    }
    const opts = String(inner).split('|').map((s) => s.trim()).filter(Boolean)
    if (!opts.length) return ''
    return '<div class="opt-label">Escolha uma opção:</div><div class="opt-group">' + opts.map((o) =>
      `<button type="button" class="opt-btn" data-opt="${o.replace(/"/g, '&quot;')}">${o}</button>`
    ).join('') + '</div>'
  })
  return withOpts.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')
}

function rolarParaBaixo() {
  nextTick(() => {
    if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight
  })
}

function perguntar(texto: string) {
  entrada.value = texto
  enviar()
}

function novaConversa() {
  mensagens.value = []
  entrada.value = ''
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

function enviarFormIdentificacao() {
  const partes = [`Escola: ${formEscola.value}`, `Cargo: ${formCargo.value}`, `Urgência: ${formUrgencia.value}`]
  if (formNome.value.trim()) partes.push(`Nome: ${formNome.value.trim()}`)
  partes.push(`E-mail: ${formEmail.value.trim()}`)
  const texto = `Identificação: ${partes.join(', ')}`
  mostrarForm.value = false
  formEscola.value = ''
  formCargo.value = ''
  formUrgencia.value = ''
  formNome.value = ''
  formEmail.value = ''
  entrada.value = texto
  enviar()
}

function onComposerKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.shiftKey)) {
    // pula de linha
    e.preventDefault()
    const ta = e.target as HTMLTextAreaElement
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const val = entrada.value
    entrada.value = val.slice(0, start) + '\n' + val.slice(end)
    nextTick(() => {
      ta.selectionStart = ta.selectionEnd = start + 1
    })
    return
  }
  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    enviar()
  }
}

function autoResizeComposer(e: Event) {
  const ta = e.target as HTMLTextAreaElement
  ta.style.height = 'auto'
  ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
}

const tools: any[] = [
  {
    type: 'function',
    function: {
      name: 'listar_escolas',
      description: 'Lista as escolas/unidades disponíveis para abertura de chamado.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_formulario',
      description: 'Retorna o formulário público de abertura de chamado: categorias e perguntas (com condicionais). Use para saber quais perguntas fazer ao usuário conforme a categoria escolhida.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_categorias_equipamento',
      description: 'Lista categorias de equipamento (ex.: Computador, Impressora).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_marcas_equipamento',
      description: 'Lista marcas de uma categoria de equipamento.',
      parameters: {
        type: 'object',
        properties: { categoria: { type: 'string', description: 'Categoria do equipamento' } },
        required: ['categoria'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_modelos_equipamento',
      description: 'Lista modelos de uma categoria+marca de equipamento.',
      parameters: {
        type: 'object',
        properties: {
          categoria: { type: 'string', description: 'Categoria' },
          marca: { type: 'string', description: 'Marca' },
        },
        required: ['categoria', 'marca'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_chamado',
      description: 'Cria o chamado público. Chame SOMENTE quando tiver todos os dados obrigatórios: unidade, solicitante, funcao, tipo, descricao, urgencia, email. Retorna protocolo.',
      parameters: {
        type: 'object',
        properties: {
          unidade: { type: 'string', description: 'Escola/unidade' },
          solicitante: { type: 'string', description: 'Nome completo' },
          funcao: { type: 'string', description: 'Cargo/função' },
          tipo: { type: 'string', description: 'Tipo do chamado (categoria - resposta principal)' },
          descricao: { type: 'string', description: 'Descrição detalhada' },
          urgencia: { type: 'string', description: 'Baixa | Média | Alta' },
          email: { type: 'string', description: 'E-mail institucional' },
          categoriaChave: { type: 'string', description: 'Chave da categoria (rede, equipamento, sistemas, email)' },
        },
        required: ['unidade', 'solicitante', 'funcao', 'tipo', 'descricao', 'urgencia', 'email'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_protocolo',
      description: 'Consulta um chamado já aberto por protocolo + e-mail.',
      parameters: {
        type: 'object',
        properties: {
          protocolo: { type: 'string', description: 'Protocolo do chamado' },
          email: { type: 'string', description: 'E-mail usado na abertura' },
        },
        required: ['protocolo', 'email'],
      },
    },
  },
]

async function executarTool(nome: string, args: any) {
  if (nome === 'listar_escolas') {
    const lista = await listarEscolasPublico()
    return { escolas: lista }
  }
  if (nome === 'get_formulario') {
    const f: FormularioCategoria[] = await getFormularioPublico()
    return { categorias: f.map((c) => ({ chave: c.chave, nome: c.nome, descricao: c.descricao, perguntas: c.perguntas })) }
  }
  if (nome === 'listar_categorias_equipamento') {
    const lista = await listarCategoriasEquipamento()
    return { categorias: lista }
  }
  if (nome === 'listar_marcas_equipamento') {
    const lista = await listarMarcasEquipamento(String(args.categoria || ''))
    return { marcas: lista }
  }
  if (nome === 'listar_modelos_equipamento') {
    const lista = await listarModelosEquipamento(String(args.categoria || ''), String(args.marca || ''))
    return { modelos: lista }
  }
  if (nome === 'criar_chamado') {
    const payload: NovoChamadoPayload = {
      unidade: String(args.unidade),
      solicitante: String(args.solicitante),
      funcao: String(args.funcao || ''),
      tipo: String(args.tipo),
      descricao: String(args.descricao),
      urgencia: String(args.urgencia),
      email: String(args.email),
      categoriaChave: args.categoriaChave ? String(args.categoriaChave) : undefined,
    }
    const chamado = await criarChamadoPublico(payload)
    return { protocolo: chamado.protocolo, status: chamado.status, mensagem: 'Chamado criado com sucesso.' }
  }
  if (nome === 'consultar_protocolo') {
    const c = await consultarChamadoPorProtocolo(String(args.protocolo), String(args.email))
    return { protocolo: c.protocolo, status: c.status, tipo: c.tipo, unidade: c.unidade, descricao: c.descricao }
  }
  return { erro: 'tool desconhecida' }
}

async function enviar() {
  if (enviando.value) return
  if (!entrada.value.trim()) return

  const texto = entrada.value.trim()
  mensagens.value.push({ role: 'user', content: texto })
  entrada.value = ''
  enviando.value = true
  rolarParaBaixo()

  const msgs: any[] = [
    {
      role: 'system',
      content:
        'Você é a CaféIA, assistente virtual da URE Leste 3 (SETEC) para abertura de chamados. ' +
        'Responda em português, de forma cordial, clara e objetiva. Seja concisa: evite turnos desnecessários. ' +
        'Seu objetivo é ajudar o usuário a abrir um chamado de suporte. ' +
        'IMPORTANTE: responda APENAS sobre abertura de chamados, problemas de suporte (rede, equipamento, sistemas, e-mail) ' +
        'e acompanhamento de chamados. Se o usuário perguntar sobre programação, matemática, curiosidades ou qualquer outro assunto, ' +
        'recuse educadamente e redirecione para abertura de chamado. Exemplo: "Sou assistente de chamados da URE Leste 3. ' +
        'Posso ajudar apenas com abertura e acompanhamento de chamados. Me conte o problema de suporte." ' +
        'NÃO responda perguntas fora do escopo, mesmo que saiba a resposta. ' +
        'FLUXO RÁPIDO: ' +
        '1) Identifique a categoria a partir da descrição do usuário. ' +
        '2) Se o usuário já informou uma resposta (ex.: "PortalNet", "SEI", "Lentidão"), NÃO pergunte de novo — use a resposta. ' +
        '3) Chame get_formulario para obter as perguntas da categoria. ' +
        '4) Primeiro, pergunte APENAS a primeira pergunta obrigatória da categoria (via botões [[...]]), ' +
        '   SOMENTE se o usuário não tiver informado a resposta. ' +
        '   NÃO mostre perguntas condicionais nem as demais até o usuário responder. ' +
        '5) Após a resposta, pergunte as perguntas condicionadas (se aplicáveis) + as demais perguntas obrigatórias, ' +
        '   em um único turno, com campos/botões. ' +
        '6) Para equipamento, colete categoria/marca/modelo via tools (listar_categorias_equipamento etc.), ' +
        '   NÃO invente a lista de categorias. Use botões [[...]] para as opções. ' +
        '7) Para identificação, use o marcador [[FORM]] sozinho na mensagem. O sistema exibirá um formulário ' +
        '   com campos de escola, cargo, urgência, nome e e-mail. NÃO liste as escolas como botões. ' +
        '   OBS: se a categoria já coletou o nome (ex.: PortalNet coleta "Nome completo do servidor"), ' +
        '   o campo nome do formulário é opcional — não peça de novo. ' +
        '8) Monte um resumo e peça UMA ÚNICA confirmação (botões Confirmar / Editar). ' +
        '9) Chame criar_chamado e informe o protocolo e o link /consulta. ' +
        'BOTÕES: sempre que houver opções (escolas, cargo, urgência, categorias, sistemas, problemas), ' +
        'renderize-as no formato [[opção1|opção2|opção3]]. O usuário clicará e a opção será enviada. ' +
        'Nunca peça nem aceite senhas. Valide o e-mail (formato nome@dominio). ' +
        'Use as tools para obter listas (escolas, categorias, marcas, modelos, formulário). ' +
        'NÃO crie o chamado sem todos os campos obrigatórios. ' +
        'Se o usuário quiser acompanhar um chamado existente, use consultar_protocolo.',
    },
    ...mensagens.value.slice(-10).map((m: any) => ({ role: m.role, content: m.content, reasoning_content: m.reasoning_content ?? undefined })),
  ]

  async function perguntarAoBackend(): Promise<{ conteudo: string; reasoning: string | null }> {
    const res: any = await chamarIAPublico({
      messages: msgs,
      tools,
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 4000,
    })

    const choice = res?.choices?.[0]
    const message = choice?.message
    if (!message) throw new Error('Resposta sem message')

    if (choice.finish_reason === 'tool_calls' && message.tool_calls?.length) {
      msgs.push(message)
      for (const tc of message.tool_calls) {
        let args: any = {}
        try { args = JSON.parse(tc.function.arguments || '{}') } catch { args = {} }
        const result = await executarTool(tc.function.name, args)
        msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
      }
      return perguntarAoBackend()
    }

    const conteudo = message.content || ''
    if (!conteudo.trim()) throw new Error('Resposta vazia')
    return { conteudo, reasoning: message.reasoning_content ?? message.reasoning ?? null }
  }

  let resposta = 'Não foi possível obter resposta. Tente novamente.'
  let reasoningFinal: string | null = null
  let erroFinal = ''
  try {
    const r = await perguntarAoBackend()
    resposta = r.conteudo
    reasoningFinal = r.reasoning
  } catch (e: any) {
    erroFinal = String(e?.message || e)
    console.error('[CaféIA] falhou', e)
  }
  if (erroFinal) {
    let texto = 'Não foi possível obter resposta. Tente novamente.'
    if (erroFinal.includes('429')) texto = 'Muitas requisições. Aguarde alguns segundos e envie novamente.'
    else if (erroFinal.includes('413')) texto = 'A pergunta gerou muitos dados. Tente ser mais específico.'
    else if (erroFinal.includes('404')) texto = 'Modelo indisponível no momento. Tente novamente.'
    mensagens.value.push({ role: 'assistant', content: texto, reasoning_content: null })
  } else {
    mensagens.value.push({ role: 'assistant', content: resposta, reasoning_content: reasoningFinal })
    // Detecta [[FORM]] e exibe formulário inline
    if (resposta.includes('[[FORM]]')) {
      mostrarForm.value = true
      if (!escolasForm.value.length && !carregandoEscolasForm.value) {
        carregandoEscolasForm.value = true
        listarEscolasPublico().then((l) => { escolasForm.value = l }).finally(() => { carregandoEscolasForm.value = false })
      }
    }
  }
  rolarParaBaixo()
  enviando.value = false
}

watch(entrada, (v) => {
  if (!v) {
    const ta = document.querySelector('.apple-composer-input') as HTMLTextAreaElement | null
    if (ta) ta.style.height = 'auto'
  }
})

onMounted(() => {
  if (chatBox.value) {
    chatBox.value.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const reopenBtn = target.closest('.form-reopen-btn') as HTMLElement | null
      if (reopenBtn) {
        mostrarForm.value = true
        if (!escolasForm.value.length && !carregandoEscolasForm.value) {
          carregandoEscolasForm.value = true
          listarEscolasPublico().then((l) => { escolasForm.value = l }).finally(() => { carregandoEscolasForm.value = false })
        }
        return
      }
      const btn = target.closest('.opt-btn') as HTMLElement | null
      if (!btn) return
      const opt = btn.getAttribute('data-opt')
      if (!opt) return
      // desabilita o grupo após clique
      const group = btn.closest('.opt-group')
      if (group) group.classList.add('used')
      perguntar(opt)
    })
  }
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Manrope:wght@400;500;600;700&display=swap');

/* Apple-inspired design, CafeIA identity */

:root {
  --apple-bg: #f6efe8;
  --apple-card: #ffffff;
  --apple-text: #241a14;
  --apple-text-secondary: #6f5c50;
  --apple-blue: #a9714b;
  --apple-blue-hover: #c98a5e;
  --apple-border: #e6dbd0;
  --apple-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
  --apple-shadow-lg: 0 8px 40px rgba(0, 0, 0, 0.08);
  --apple-radius: 18px;
  --apple-radius-sm: 12px;
  --apple-radius-pill: 980px;
}

.apple-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--apple-bg);
  font-family: "Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  color: var(--apple-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Topo */
.apple-topo {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.apple-topo-inner {
  max-width: 980px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 24px;
  height: 52px;
}
.apple-topo-brand { display: flex; align-items: center; gap: 10px; }
.apple-logo {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  object-fit: contain;
}
.apple-topo-org { display: flex; flex-direction: column; line-height: 1.1; }
.apple-topo-org small {
  font-size: 10px;
  color: var(--apple-text-secondary);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  font-weight: 500;
}
.apple-topo-org strong {
  font-size: 13px;
  color: var(--apple-text);
  font-weight: 600;
  letter-spacing: -0.01em;
}
.apple-topo-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border-radius: var(--apple-radius-pill);
  background: rgba(0, 0, 0, 0.05);
  color: var(--apple-text);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.2s ease;
  border: none;
}
.apple-topo-link:hover { background: rgba(0, 0, 0, 0.08); }

/* Main / Chat */
.apple-main {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 40px 20px 24px;
}
.apple-chat {
  width: 100%;
  max-width: 780px;
  background: var(--apple-card);
  border-radius: var(--apple-radius);
  box-shadow: var(--apple-shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: calc(100vh - 140px);
  animation: apple-rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* Head */
.apple-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.apple-brand { display: flex; align-items: center; gap: 12px; }
.apple-avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid var(--apple-border);
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 4px;
}
.apple-avatar-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.apple-brand-text { display: flex; flex-direction: column; line-height: 1.2; }
.apple-brand-text strong {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 20px;
  color: var(--apple-text);
  font-weight: 700;
  letter-spacing: -0.02em;
}
.apple-welcome h2 {
  font-family: 'Fraunces', Georgia, serif;
}
.apple-brand-text small {
  font-size: 12px;
  color: var(--apple-text-secondary);
  margin-top: 2px;
  font-weight: 400;
}
.apple-head-right { display: flex; align-items: center; gap: 10px; }
.apple-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3fa34d;
}
.apple-modelo {
  font-size: 11px;
  color: var(--apple-text-secondary);
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 4px 10px;
  border-radius: var(--apple-radius-pill);
  background: rgba(0, 0, 0, 0.04);
  font-weight: 500;
}
.apple-nova-btn {
  padding: 6px 12px;
  border-radius: var(--apple-radius-pill);
  border: 1px solid #e6dbd0;
  background: #fff;
  color: #241a14;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s ease;
}
.apple-nova-btn:hover {
  background: #a9714b;
  color: #fff;
  border-color: #a9714b;
}

/* Stream */
.apple-stream {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px 24px 12px;
  scroll-behavior: smooth;
}
.apple-stream::-webkit-scrollbar { width: 6px; }
.apple-stream::-webkit-scrollbar-track { background: transparent; }
.apple-stream::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 99px;
}
.apple-stream-inner { display: flex; flex-direction: column; gap: 16px; }

/* Welcome */
.apple-welcome {
  max-width: 480px;
  margin: auto;
  padding: 48px 0 24px;
  text-align: center;
  animation: apple-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.apple-stream:has(.apple-welcome) { display: flex; flex-direction: column; }
.apple-welcome-icon {
  width: 72px;
  height: 72px;
  margin: 0 auto 20px;
  border-radius: 20px;
  background: #fff;
  border: 1px solid var(--apple-border);
  display: grid;
  place-items: center;
  box-shadow: 0 8px 24px rgba(169, 113, 75, 0.15);
  overflow: hidden;
  padding: 8px;
}
.apple-welcome-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.apple-welcome h2 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 700;
  color: var(--apple-text);
  letter-spacing: -0.03em;
}
.apple-welcome p {
  margin: 0 auto 28px;
  font-size: 15px;
  line-height: 1.5;
  color: var(--apple-text-secondary);
  max-width: 360px;
  font-weight: 400;
}
.apple-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.apple-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: var(--apple-radius-pill);
  border: 1px solid var(--apple-border);
  background: var(--apple-card);
  color: var(--apple-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  animation: apple-rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.apple-chip:hover {
  background: var(--apple-blue);
  color: #fff;
  border-color: var(--apple-blue);
  transform: scale(1.02);
}
.apple-chip:active { transform: scale(0.98); }

/* Mensagens */
.apple-msg {
  display: flex;
  gap: 10px;
  max-width: 80%;
  animation: apple-rise 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.apple-msg.user { align-self: flex-end; flex-direction: row-reverse; }
.apple-msg.assistant { align-self: flex-start; }

.apple-ava {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 600;
  margin-top: 4px;
  overflow: hidden;
}
.apple-ava.user {
  background: var(--apple-blue);
  color: #fff;
}
.apple-ava.assistant {
  background: linear-gradient(135deg, #a9714b, #e0a876);
  color: #fff;
  padding: 4px;
}
.apple-ava-logo { width: 100%; height: 100%; object-fit: contain; border-radius: 6px; }

.apple-body { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.apple-msg.user .apple-body { align-items: flex-end; }
.apple-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--apple-text-secondary);
  letter-spacing: 0.01em;
}

.apple-bubble {
  padding: 12px 16px;
  border-radius: 18px;
  font-size: 15px;
  line-height: 1.5;
  background: #f0e8df;
  color: #241a14;
  border: 1px solid #e6dbd0;
  transition: background 0.2s ease;
}
.apple-msg.assistant .apple-bubble { border-bottom-left-radius: 6px; }
.apple-msg.user .apple-bubble {
  background: var(--apple-blue);
  color: #fff;
  border-bottom-right-radius: 6px;
}
.apple-bubble :deep(strong) { font-weight: 600; }
.apple-msg.user .apple-bubble :deep(strong) { color: #fff; }

.apple-bubble.typing { display: flex; align-items: center; gap: 8px; }
.typing-note { font-size: 13px; color: var(--apple-text-secondary); }
.dot-wave { display: inline-flex; gap: 3px; }
.dot-wave i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--apple-text-secondary);
  animation: apple-bounce 1.2s infinite;
}
.dot-wave i:nth-child(2) { animation-delay: 0.15s; }
.dot-wave i:nth-child(3) { animation-delay: 0.3s; }

/* Composer */
.apple-composer {
  display: flex;
  gap: 8px;
  padding: 12px 20px 16px;
  align-items: flex-end;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
.apple-composer-field {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 14px;
  background: #fff;
  border: 1px solid #e6dbd0;
  border-radius: 20px;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}
.apple-composer-field:focus-within {
  background: #fff;
  box-shadow: 0 0 0 3px rgba(169, 113, 75, 0.2);
}
.apple-composer-icon { color: var(--apple-text-secondary); flex-shrink: 0; margin-bottom: 6px; }
.apple-composer-input {
  flex: 1;
  border: 0;
  outline: none;
  padding: 6px 0;
  font-size: 15px;
  background: transparent;
  color: var(--apple-text);
  font-family: inherit;
  resize: none;
  max-height: 120px;
  overflow-y: auto;
  line-height: 1.4;
}
.apple-composer-input::placeholder { color: var(--apple-text-secondary); }
.apple-send {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 0;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: #fff;
  background: var(--apple-blue);
  transition: all 0.2s ease;
  flex-shrink: 0;
}
.apple-send:hover:not(:disabled) { background: var(--apple-blue-hover); transform: scale(1.05); }
.apple-send:active:not(:disabled) { transform: scale(0.95); }
.apple-send:disabled { opacity: 0.3; cursor: not-allowed; }

.apple-aviso {
  text-align: center;
  font-size: 11px;
  color: var(--apple-text-secondary);
  padding: 0 20px 12px;
  margin: 0;
}

/* Formulário modal de identificação */
.form-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 20px;
}
.apple-form-inline {
  width: 100%;
  max-width: 420px;
  max-height: 80vh;
  overflow-y: auto;
  padding: 24px;
  background: #fff;
  border: 1px solid #e6dbd0;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}
.form-title {
  font-size: 14px;
  font-weight: 700;
  color: #241a14;
  margin: 0 0 4px;
}
.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.form-row label {
  font-size: 12px;
  font-weight: 600;
  color: #6f5c50;
}
.form-select, .form-input {
  padding: 10px 12px;
  border: 1px solid #e6dbd0;
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
  color: #241a14;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.form-select:focus, .form-input:focus {
  border-color: #a9714b;
  box-shadow: 0 0 0 3px rgba(169, 113, 75, 0.15);
}
.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 4px;
}
.form-cancel {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #e6dbd0;
  background: #fff;
  color: #241a14;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.form-submit {
  padding: 8px 20px;
  border-radius: 8px;
  border: 0;
  background: #a9714b;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.2s ease;
}
.form-submit:hover:not(:disabled) { background: #c98a5e; }
.form-submit:disabled { opacity: 0.4; cursor: not-allowed; }
.form-placeholder {
  font-size: 13px;
  color: #6f5c50;
  font-style: italic;
  padding: 8px 0;
}
.form-reopen-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 10px 20px;
  border-radius: 10px;
  border: 1px solid #a9714b;
  background: #a9714b;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.2s ease, transform 0.12s ease;
}
.form-reopen-btn:hover { background: #c98a5e; transform: translateY(-1px); }
.form-reopen-btn:active { transform: translateY(0); }
.form-reopen-btn svg { flex-shrink: 0; }

/* Footer */
.apple-rodape {
  text-align: center;
  font-size: 12px;
  color: var(--apple-text-secondary);
  padding: 16px 24px;
  font-weight: 400;
}

/* Botões de opção */
.opt-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--apple-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 8px;
  margin-bottom: 6px;
}
.opt-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}
.opt-group.used .opt-btn {
  pointer-events: none;
  opacity: 0.5;
}
.opt-btn {
  padding: 12px 16px;
  border-radius: var(--apple-radius-sm);
  border: 1px solid var(--apple-border);
  background: var(--apple-card);
  color: var(--apple-text);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  width: 100%;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}
.opt-btn:hover {
  background: var(--apple-blue);
  color: #fff;
  border-color: var(--apple-blue);
  transform: scale(1.01);
}
.opt-btn:active { transform: scale(0.99); }

/* Motion */
@keyframes apple-rise {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: none; }
}
@keyframes apple-bounce {
  0%, 70%, 100% { transform: translateY(0); opacity: 0.4; }
  35% { transform: translateY(-4px); opacity: 1; }
}

.msg-enter-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.msg-enter-from { opacity: 0; transform: translateY(8px); }
.rise-enter-active { transition: opacity 0.4s ease, transform 0.4s ease; }
.rise-enter-from { opacity: 0; transform: translateY(8px) scale(0.98); }

@media (max-width: 640px) {
  .apple-chat { height: calc(100vh - 100px); border-radius: 0; }
  .apple-msg { max-width: 92%; }
  .apple-topo-inner { padding: 10px 16px; }
}
</style>
