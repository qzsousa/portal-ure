<template>
  <div class="chat-shell" :class="{ collapsed: !historyOpen }">
    <aside class="rail">
      <button class="rail-toggle" @click="historyOpen = !historyOpen" :title="historyOpen ? 'Recolher historico' : 'Expandir historico'">
        <component :is="historyOpen ? PanelLeftClose : PanelLeftOpen" :size="16" />
      </button>
      <Transition name="fade-slide">
        <div v-if="historyOpen" class="rail-body">
          <header class="rail-head">
<div class="brand">
              <img class="brand-logo" src="/logoCafeIA.png" alt="CafeIA" />
              <div class="brand-text">
                <strong>Caf&eacute;IA</strong>
                <small>Portal URE Leste 3</small>
              </div>
            </div>
            <button class="new-btn" @click="novaConversa">
              <Plus :size="15" /> Nova
            </button>
          </header>

          <div class="rail-list">
            <button
              v-for="c in conversas"
              :key="c.id"
              class="conv"
              :class="{ active: c.id === convId }"
              @click="selecionarConv(c.id)"
            >
              <MessageSquare :size="14" class="conv-icon" />
              <span class="conv-body">
                <span class="conv-title">{{ c.title }}</span>
                <span class="conv-meta">{{ quando(c.atualizado) }}</span>
              </span>
              <span
                class="conv-del"
                title="Excluir conversa"
                @click.stop="excluirConversa(c.id)"
              >
                <Trash2 :size="13" />
              </span>
            </button>
            <p v-if="!conversas.length" class="rail-empty">Nenhuma conversa salva</p>
          </div>

          <footer class="rail-foot">
            <button class="refresh-btn" @click="recarregar" :disabled="carregandoDados">
              <RefreshCw :size="14" :class="{ spin: carregandoDados }" />
              {{ carregandoDados ? 'Carregando...' : 'Atualizar dados' }}
            </button>
          </footer>
        </div>
      </Transition>
    </aside>

    <section class="stage">
      <header class="stage-head">
        <div class="stage-title">
          <h1>Caf&eacute;IA</h1>
          <p>Assistente de chamados e equipamentos</p>
        </div>

      </header>

      <div v-if="status" class="stage-status">
        <Loader2 v-if="carregandoDados" :size="13" class="spin" />
        <CheckCircle2 v-else :size="13" />
        {{ status }}
      </div>

      <div class="stream" ref="chatBox">
<div v-if="!mensagens.length" class="welcome">
          <div class="welcome-cup" aria-hidden="true">
            <img class="cup-logo" src="/logoCafeIA.png" alt="" />
          </div>
          <h2>Ola, {{ nomeUsuario }}</h2>
          <p v-if="carregandoDados" class="brewing">
            Espere um pouco, o cafe ja esta passando!
            <span class="dot-wave"><i></i><i></i><i></i></span>
          </p>
          <p v-else>Pergunte sobre chamados, equipamentos, tecnicos e escolas. Eu consulto os dois banco de dados do portal.</p>
          <div class="chips" v-if="!carregandoDados">
            <button v-for="s in sugestoes" :key="s" class="chip" @click="perguntar(s)">{{ s }}</button>
          </div>
        </div>

        <TransitionGroup name="msg" tag="div" class="stream-inner">
          <article v-for="(m, i) in mensagens" :key="i" class="msg" :class="m.role">
            <div class="who-avatar" :class="m.role">
              <span v-if="m.role === 'user'">{{ inicialUsuario }}</span>
              <img v-else class="ava-logo" src="/logoCafeIA.png" alt="" />
            </div>
            <div class="who-body">
              <span class="who-name">{{ m.role === 'user' ? nomeUsuario : 'Caf&eacute;IA' }}</span>
              <div class="bubble" v-html="formatarTexto(m.content)"></div>
            </div>
          </article>
        </TransitionGroup>

        <Transition name="msg">
          <article v-if="enviando" class="msg assistant">
            <div class="who-avatar assistant"><img class="ava-logo" src="/logoCafeIA.png" alt="" /></div>
            <div class="who-body">
              <span class="who-name">Caf&eacute;IA</span>
              <div class="bubble typing">
                <span class="dot-wave"><i></i><i></i><i></i></span>
                <span class="typing-note">consultando os backends</span>
              </div>
            </div>
          </article>
        </Transition>
      </div>

      <form class="composer" @submit.prevent="enviar">
        <div class="composer-field">
          <Sparkles :size="16" class="composer-icon" />
          <input
            v-model="entrada"
            placeholder="Ex.: quais escolas tem mais chamados abertos?"
            :disabled="enviando"
          />
        </div>
        <button class="send" type="submit" :disabled="enviando || !entrada.trim()" title="Enviar">
          <Send :size="17" />
        </button>
      </form>
    </section>
  </div>
</template>
<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import {
  CheckCircle2,
  Loader2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
} from '@lucide/vue'
import { listarChamados } from '@/api/chamados'
import { listarUsuarios } from '@/api/usuarios'
import { listarEquipamentosGlobal } from '@/api/sce'
import { useAuthStore } from '@/stores/auth'
import { useContextoIA } from '@/composables/useContextoIA'

interface Msg { role: 'user' | 'assistant' | 'tool'; content: string }

const auth = useAuthStore()
const { resumo, carregando: carregandoDados, status, carregar, recarregar: recarregarBase } = useContextoIA()
const nomeUsuario = (auth.user?.nome || 'Usuario').split(' ')[0]
const inicialUsuario = nomeUsuario.charAt(0).toUpperCase()
const mensagens = ref<Msg[]>([])
const entrada = ref('')
const enviando = ref(false)
const chatBox = ref<HTMLElement | null>(null)
const historyOpen = ref(true)
const sugestoes = [
  'Quais escolas tem mais chamados abertos?',
  'Qual tecnico mais resolveu chamados?',
  'Escolas com mais equipamentos disponiveis',
  'Quantos chamados tem em aberto?',
]

interface Conv { id: string; title: string; mensagens: Msg[]; atualizado: number }

const conversas = ref<Conv[]>([])
const convId = ref<string>('')

function carregarHistorico() {
  try {
    const raw = localStorage.getItem('chat-conversas')
    if (raw) conversas.value = JSON.parse(raw) as Conv[]
  } catch { conversas.value = [] }
  if (!conversas.value.length) novaConversa()
  else {
    convId.value = conversas.value.slice().sort((a, b) => b.atualizado - a.atualizado)[0].id
    const c = conversas.value.find((x) => x.id === convId.value)
    if (c) mensagens.value = Array.isArray(c.mensagens) ? c.mensagens : []
  }
}
function salvarHistorico() {
  localStorage.setItem('chat-conversas', JSON.stringify(conversas.value))
}
function novaConversa() {
  const c: Conv = { id: String(Date.now()), title: 'Nova conversa', mensagens: [], atualizado: Date.now() }
  conversas.value.unshift(c)
  convId.value = c.id
  mensagens.value = []
  salvarHistorico()
}
function selecionarConv(id?: string) {
  if (id) convId.value = id
  const c = conversas.value.find((x) => x.id === convId.value)
  if (c) mensagens.value = Array.isArray(c.mensagens) ? [...c.mensagens] : []
}

watch(mensagens, (v) => {
  const c = conversas.value.find((x) => x.id === convId.value)
  if (!c) return
  c.mensagens = v
  c.atualizado = Date.now()
  if (c.title === 'Nova conversa' && v.length) c.title = v[0].content.slice(0, 30)
  salvarHistorico()
}, { deep: true })

function formatarTexto(txt: string) {
  const esc = txt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}
function rolarParaBaixo() {
  nextTick(() => {
    if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight
  })
}

function quando(ts: number) {
  const d = new Date(ts)
  const hoje = new Date()
  const mesmoDia = d.toDateString() === hoje.toDateString()
  return mesmoDia
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function perguntar(texto: string) {
  entrada.value = texto
  enviar()
}

function excluirConversa(id: string) {
  const i = conversas.value.findIndex((c) => c.id === id)
  if (i === -1) return
  conversas.value.splice(i, 1)
  if (!conversas.value.length) {
    novaConversa()
  } else if (convId.value === id) {
    const primeira = conversas.value.slice().sort((a, b) => b.atualizado - a.atualizado)[0]
    selecionarConv(primeira.id)
  }
  salvarHistorico()
}

const tools: any[] = [
  {
    type: 'function',
    function: {
      name: 'listar_chamados',
      description: 'Lista chamados com filtro por status e unidade (escola).',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Status do chamado (ex.: ABERTO, RESOLVIDO)' },
          unidade: { type: 'string', description: 'Nome (ou parte) da escola/unidade' },
          limite: { type: 'number', description: 'Quantidade (max 100)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_equipamentos',
      description: 'Lista equipamentos com filtro por status e unidade (escola).',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Status do equipamento' },
          unidade: { type: 'string', description: 'Nome (ou parte) da escola/unidade' },
          limite: { type: 'number', description: 'Quantidade (max 100)' },
        },
        required: [],
      },
    },
  },
{
    type: 'function',
    function: {
      name: 'resumo_chamados',
      description:
        'Conta chamados agregando por tipo, status e unidade. Filtros opcionais por responsavel (tecnico), status e unidade. Use SEMPRE para perguntas do tipo "quais tipos o tecnico X resolveu", "quantos chamados por tipo", "tipos mais comum".',
      parameters: {
        type: 'object',
        properties: {
          responsavel: { type: 'string', description: 'Nome do tecnico responsavel' },
          status: { type: 'string', description: 'Ex.: ABERTO, RESOLVIDO' },
          unidade: { type: 'string', description: 'Nome (ou parte) da escola' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resumo_equipamentos',
      description:
        'Conta equipamentos agregando por status, categoria, modelo e unidade. Filtros opcionais por status e unidade. Use para perguntas do tipo "quantos quebrados tem", "que modelo mais existe", "categoria mais comum".',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Ex.: Disponivel, Quebrado, Em Manutencao' },
          unidade: { type: 'string', description: 'Nome (ou parte) da escola' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_tecnicos',
      description: 'Lista técnicos cadastrados e as escolas (filial) que atendem.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
]

async function executarTool(nome: string, args: any) {
  if (nome === 'listar_chamados') {
    const r: any = await listarChamados({ status: args.status, unidade: args.unidade, page: 1, limit: Math.min(args.limite || 50, 100) })
    const dados = (r.data || []).map((c: any) => ({ protocolo: c.protocolo, tipo: c.tipo, status: c.status, unidade: c.unidade, urgencia: c.urgencia, responsavel: c.responsavel, abertura: c.timestamp, descricao: c.descricao?.slice(0, 200) }))
    return { total: r.meta?.total ?? r.data?.length, dados }
  }
  if (nome === 'listar_equipamentos') {
    const r: any = await listarEquipamentosGlobal({ status: args.status, unidade: args.unidade, limite: Math.min(args.limite || 20, 20), offset: 0 })
    const dadosEq = (r.data || []).map((e: any) => ({ id: e.id, categoria: e.categoria, marca: e.marca, modelo: e.modelo, status: e.status, unidade: e.unidade, patrimonio: e.patrimonio }))
    return { total: r.total, dados: dadosEq }
  }
  if (nome === 'consultar_tecnicos') {
    const lista: any[] = []
    let pu = 1
    while (pu < 40) {
      const ru: any = await listarUsuarios({ page: pu, limit: 100 })
      const arr = ru.data || []
      if (!arr.length) break
      for (const u of arr) {
        if (u.nivel === 'TECNICO') lista.push({ nome: u.nome, escolas: u.filial })
      }
      pu++
      if (arr.length < 100) break
    }
    return { tecnicos: lista }
  }
  if (nome === 'resumo_chamados') {
    const porTipo: Record<string, number> = {}
    const porStatus: Record<string, number> = {}
    const porUnidade: Record<string, number> = {}
    const porTecnico: Record<string, number> = {}
    const filtroResp = args.responsavel ? String(args.responsavel).toLowerCase() : ''
    const filtroStatus = args.status ? String(args.status).toUpperCase() : ''
    const filtroUnidade = args.unidade ? String(args.unidade).toLowerCase() : ''
    let total = 0
    let page = 1
    let paginas = 0
    while (paginas < 40) {
      const r: any = await listarChamados({ page, limit: 100 })
      const arr = r.data || []
      if (!arr.length) break
      for (const c of arr) {
        if (filtroResp && !String(c.responsavel || '').toLowerCase().includes(filtroResp)) continue
        if (filtroStatus && String(c.status || '').toUpperCase() !== filtroStatus) continue
        if (filtroUnidade && !String(c.unidade || '').toLowerCase().includes(filtroUnidade)) continue
        total++
        const tipo = c.tipo || 'sem tipo'
        const status = c.status || 'sem status'
        const unidade = c.unidade || 'sem unidade'
        porTipo[tipo] = (porTipo[tipo] || 0) + 1
        porStatus[status] = (porStatus[status] || 0) + 1
        porUnidade[unidade] = (porUnidade[unidade] || 0) + 1
        if (c.responsavel) porTecnico[c.responsavel] = (porTecnico[c.responsavel] || 0) + 1
      }
      page++
      paginas++
      if (arr.length < 100) break
    }
    const ordenar = (o: Record<string, number>) =>
      Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]))
    return { total, porTipo: ordenar(porTipo), porStatus: ordenar(porStatus), porUnidade: ordenar(porUnidade), porTecnico: ordenar(porTecnico) }
  }

  if (nome === 'resumo_equipamentos') {
    const porStatus: Record<string, number> = {}
    const porCategoria: Record<string, number> = {}
    const porModelo: Record<string, number> = {}
    const porUnidade: Record<string, number> = {}
    const filtroStatus = args.status ? String(args.status).toLowerCase() : ''
    const filtroUnidade = args.unidade ? String(args.unidade).toLowerCase() : ''
    let total = 0
    let off = 0
    let paginas = 0
    while (paginas < 60) {
      const r: any = await listarEquipamentosGlobal({ limite: 500, offset: off })
      const arr = r.data || []
      if (!arr.length) break
      for (const e of arr) {
        if (filtroStatus && !String(e.status || '').toLowerCase().includes(filtroStatus)) continue
        if (filtroUnidade && !String(e.unidade || '').toLowerCase().includes(filtroUnidade)) continue
        total++
        const st = e.status || 'sem status'
        const cat = e.categoria || 'sem categoria'
        const mod = [e.marca, e.modelo].filter(Boolean).join(' ') || 'sem modelo'
        const uni = e.unidade || 'sem unidade'
        porStatus[st] = (porStatus[st] || 0) + 1
        porCategoria[cat] = (porCategoria[cat] || 0) + 1
        porModelo[mod] = (porModelo[mod] || 0) + 1
        porUnidade[uni] = (porUnidade[uni] || 0) + 1
      }
      off += 500
      paginas++
      if (arr.length < 500) break
    }
    const ordenar = (o: Record<string, number>) =>
      Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]))
    return { total, porStatus: ordenar(porStatus), porCategoria: ordenar(porCategoria), porModelo: ordenar(porModelo), porUnidade: ordenar(porUnidade) }
  }

  return { erro: 'tool desconhecida' }
}

async function enviar() {
  if (enviando.value) return
  if (!entrada.value.trim()) return
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  const groqKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined
  const nvidiaKey = import.meta.env.VITE_NVIDIA_API_KEY as string | undefined
  const nvidiaModel = (import.meta.env.VITE_NVIDIA_MODEL as string | undefined) || 'z-ai/glm-5.3-flash'
  if (!geminiKey && !groqKey && !nvidiaKey) {
    status.value = 'Nenhuma API de IA configurada.'
    return
  }
  if (!resumo.value) await carregar()

  const texto = entrada.value.trim()
  entrada.value = ''
  mensagens.value.push({ role: 'user', content: texto })
  rolarParaBaixo()
  enviando.value = true

  const systemText = 'Voce e um assistente do Portal URE Leste 3. Responda em portugues, de forma concisa e objetiva. Use as tools para TODO detalhe que nao esteja no resumo - elas consultam a base inteira dos dois backends (chamados e equipamentos). Para saber qual tecnico atende uma escola use a lista de tecnicos cadastrados; para contar tipos/categorias/status use resumo_chamados e resumo_equipamentos; para ver registros use listar_chamados e listar_equipamentos. NUNCA diga que nao tem acesso a um dado antes de chamar a tool correspondente. Resumo:\n' + resumo.value

  async function tentarGemini(): Promise<string> {
    if (!geminiKey) throw new Error('sem gemini')
    const geminiTools = [{ functionDeclarations: tools.map((t: any) => t.function) }]
    let contents: any[] = [{ role: 'user', parts: [{ text: texto }] }]
    for (let step = 0; step < 5; step++) {
      let res: any = null
      for (let tent = 0; tent < 3; tent++) {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemText }] },
            contents,
            tools: geminiTools,
            generationConfig: { temperature: 0.2 },
          }),
        })
        if (res.ok) break
        if (res.status === 429 && tent < 2) { await new Promise((r) => setTimeout(r, 8000)); continue }
        const t = await res.text(); throw new Error(`${res.status} ${t}`)
      }
      const data = await res.json()
      const parts = data?.candidates?.[0]?.content?.parts || []
      const calls = parts.filter((p: any) => p.functionCall)
      if (calls.length) {
        contents.push({ role: 'model', parts })
        const respParts: any[] = []
        for (const c of calls) {
          const r = await executarTool(c.functionCall.name, c.functionCall.args || {})
          respParts.push({ functionResponse: { name: c.functionCall.name, response: r } })
        }
        contents.push({ role: 'user', parts: respParts })
        continue
      }
      const txt = parts.map((p: any) => p.text || '').join('\n').trim()
      if (txt) return txt
      throw new Error('Gemini sem resposta')
    }
    throw new Error('Gemini loop excedido')
  }

  async function tentarOpenAI(nome: string, base: string, modelo: string, key: string): Promise<string> {
    const msgs: any[] = [
      { role: 'system', content: 'Voce e um assistente do Portal URE Leste 3. Responda em portugues, de forma concisa e objetiva. Use as tools para TODO detalhe que nao esteja no resumo - elas consultam a base inteira dos dois backends. Para contar tipos/categorias/status use resumo_chamados e resumo_equipamentos; para ver registros use listar_chamados e listar_equipamentos. NUNCA diga que nao tem acesso a um dado antes de chamar a tool correspondente. Resumo:\n' + resumo.value },
      ...mensagens.value.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    ]
    for (let step = 0; step < 4; step++) {
      let res: any = null
      for (let tent = 0; tent < 3; tent++) {
        res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelo, messages: msgs, tools, tool_choice: 'auto', temperature: 0.2, max_tokens: 4000 }),
        })
        if (res.ok) break
        if (res.status === 429 && tent < 2) { await new Promise((r) => setTimeout(r, 8000)); continue }
        const t = await res.text(); throw new Error(`${res.status} ${t}`)
      }
      const choice = (await res.json())?.choices?.[0]
      const message = choice?.message
      if (!message) throw new Error(`${nome} sem resposta`)
      if (choice.finish_reason === 'tool_calls' && message.tool_calls?.length) {
        msgs.push(message)
        for (const tc of message.tool_calls) {
          let args: any = {}
          try { args = JSON.parse(tc.function.arguments || '{}') } catch { args = {} }
          const result = await executarTool(tc.function.name, args)
          msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
        }
        continue
      }
      return message.content || message.reasoning_content || message.reasoning || 'Sem resposta.'
    }
    throw new Error(`${nome} loop excedido`)
  }

  let resposta = 'Sem resposta.'
  let erroFinal = ''
  const provedores: Array<() => Promise<string>> = []
  if (nvidiaKey) provedores.push(() => tentarOpenAI('NVIDIA', 'https://integrate.api.nvidia.com/v1', nvidiaModel, nvidiaKey))
  if (geminiKey) provedores.push(() => tentarGemini())
  if (groqKey) provedores.push(() => tentarOpenAI('Groq', 'https://api.groq.com/openai/v1', 'openai/gpt-oss-20b', groqKey))

  for (const tentar of provedores) {
    try {
      resposta = await tentar()
      erroFinal = ''
      break
    } catch (e: any) {
      erroFinal = String(e?.message || e)
    }
  }
  if (!provedores.length) erroFinal = 'sem provedor configurado'

  if (erroFinal) {
    const msg = erroFinal
    let texto = 'Nï¿½o foi possï¿½vel obter resposta. Tente novamente.'
    if (msg.includes('429')) texto = 'Limite de requisiï¿½ï¿½es da IA atingido. Aguarde alguns segundos e envie novamente.'
    else if (msg.includes('413')) texto = 'A pergunta gerou muitos dados. Tente ser mais especï¿½fico.'
    else if (msg.includes('404')) texto = 'Modelo da IA indisponï¿½vel. Verifique a configuraï¿½ï¿½o.'
    mensagens.value.push({ role: 'assistant', content: texto })
  } else {
    mensagens.value.push({ role: 'assistant', content: resposta })
  }
  rolarParaBaixo()
  enviando.value = false
}

function recarregar() {
  carregarHistorico()
  recarregarBase()
}

carregar()
</script>

<style scoped>
:root {
  --cafe-900: #1c1410;
  --cafe-800: #2a1d16;
  --cafe-700: #3b2a20;
  --cafe-500: #a9714b;
  --cafe-400: #c98a5e;
  --creme: #f6efe8;
  --papel: #fbf8f4;
  --tinta: #241a14;
  --tinta-suave: #6f5c50;
  --borda: #e6dbd0;
}

.chat-shell {
  display: grid;
  grid-template-columns: 272px 1fr;
  height: calc(100vh - 92px);
  border-radius: 18px;
  overflow: hidden;
  background: var(--papel);
  border: 1px solid var(--borda);
  box-shadow: 0 24px 60px -32px rgba(44, 30, 22, .45);
  font-family: 'Segoe UI', 'Helvetica Neue', system-ui, sans-serif;
  color: var(--tinta);
  transition: grid-template-columns .32s cubic-bezier(.4, 0, .2, 1);
}
.chat-shell.collapsed {
  grid-template-columns: 52px 1fr;
}

/* ---------- Rail / historico ---------- */
.rail {
  background:
    radial-gradient(120% 70% at 50% 0%, rgba(201, 138, 94, .38), transparent 62%),
    radial-gradient(90% 60% at 100% 100%, rgba(107, 68, 44, .5), transparent 60%),
    linear-gradient(165deg, #6b4429 0%, #54341f 45%, #3d2617 100%);
  color: #f0e2d6;
  display: flex;
  position: relative;
  border-right: 1px solid rgba(255, 255, 255, .07);
}
.collapsed .rail { justify-content: flex-start; }
.rail-toggle {
  position: absolute;
  top: 16px;
  right: -13px;
  z-index: 3;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, .3);
  background: #fdf6ef;
  color: #54341f;
  display: grid;
  place-items: center;
  cursor: pointer;
  opacity: 0;
  transform: scale(.85);
  transition: opacity .2s, transform .2s, background .15s;
}
.chat-shell:hover .rail-toggle { opacity: 1; transform: scale(1); }
.rail-toggle:hover { background: var(--cafe-500); }
.rail-body {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  padding: 16px 14px;
  gap: 14px;
}
.rail-head { display: flex; flex-direction: column; gap: 12px; padding-right: 6px; }
.brand { display: flex; align-items: center; gap: 10px; }
.brand-logo {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  object-fit: contain;
  background: #fdf6ef;
  padding: 3px;
  box-shadow: 0 6px 16px -6px rgba(0, 0, 0, .8), 0 0 0 1px rgba(255, 255, 255, .16);
  animation: float 5.5s ease-in-out infinite;
}
.brand-text { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
.brand strong { display: block; font-size: 15px; color: #fdf6ef; letter-spacing: .01em; }
.brand small { display: block; font-size: 11px; color: #e2c8b2; }
.new-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 10px;
  border: 1px dashed rgba(255, 255, 255, .3);
  border-radius: 10px;
  background: rgba(255, 255, 255, .06);
  color: #f4e7dc;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: background .16s, border-color .16s, transform .1s;
}
.new-btn:hover { background: rgba(255, 255, 255, .12); border-color: rgba(255, 255, 255, .35); }
.new-btn:active { transform: scale(.98); }
.rail-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; padding-right: 4px; }
.rail-empty { font-size: 12px; color: #dcc0a8; text-align: center; padding: 20px 8px; }
.conv {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #f2e4d8;
  cursor: pointer;
  text-align: left;
  position: relative;
  transition: background .15s;
}
.conv:hover { background: rgba(255, 255, 255, .12); }
.conv.active {
  background: linear-gradient(90deg, rgba(224, 168, 118, .38), rgba(201, 138, 94, .12));
  box-shadow: inset 0 0 0 1px rgba(201, 138, 94, .45);
}
.conv.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 3px;
  height: 0;
  border-radius: 0 3px 3px 0;
  background: linear-gradient(180deg, var(--cafe-400), #e0a876);
  transform: translateY(-50%);
  animation: bar-in .35s cubic-bezier(.2, .8, .3, 1) forwards;
}
@keyframes bar-in { to { height: 60%; } }
.conv-icon { opacity: .6; flex-shrink: 0; }
.conv.active .conv-icon { opacity: 1; color: var(--cafe-400); }
.conv-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.conv-title { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.conv-meta { font-size: 10.5px; color: #dcc0a8; }
.conv-del {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  opacity: 0;
  color: #d7b6a4;
  transition: opacity .15s, background .15s, color .15s;
}
.conv:hover .conv-del { opacity: 1; }
.conv-del:hover { background: rgba(220, 80, 60, .22); color: #ffb4a2; }
.rail-foot { padding-top: 4px; border-top: 1px solid rgba(255, 255, 255, .08); }
.refresh-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, .1);
  background: rgba(255, 255, 255, .05);
  color: #ddc7b8;
  font-size: 12.5px;
  cursor: pointer;
  transition: background .15s;
}
.refresh-btn:hover:not(:disabled) { background: rgba(255, 255, 255, .16); }
.refresh-btn:disabled { opacity: .55; cursor: progress; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ---------- Stage ---------- */
.stage {
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
  isolation: isolate;
  background:
    radial-gradient(90% 60% at 100% 0%, rgba(201, 138, 94, .16), transparent 60%),
    radial-gradient(70% 50% at 0% 100%, rgba(169, 113, 75, .14), transparent 62%),
    linear-gradient(180deg, #fffdfb, var(--papel));
}
.stage::before,
.stage::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  filter: blur(58px);
  opacity: .5;
  z-index: -1;
  pointer-events: none;
}
.stage::before {
  width: 340px;
  height: 340px;
  top: -120px;
  right: -80px;
  background: radial-gradient(circle, rgba(224, 168, 118, .55), transparent 68%);
  animation: drift-a 22s ease-in-out infinite;
}
.stage::after {
  width: 300px;
  height: 300px;
  bottom: -130px;
  left: -70px;
  background: radial-gradient(circle, rgba(169, 113, 75, .45), transparent 68%);
  animation: drift-b 26s ease-in-out infinite;
}
@keyframes drift-a {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-60px, 50px) scale(1.15); }
  66% { transform: translate(30px, -40px) scale(.92); }
}
@keyframes drift-b {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(70px, -60px) scale(1.2); }
}

/* grão sutil sobre o papel */
.stage-head::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .5;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='.05'/%3E%3C/svg%3E");
}
.stage-head { position: relative; }
.stage-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 26px;
  background: linear-gradient(180deg, #fff, rgba(255, 255, 255, 0));
  border-bottom: 1px solid var(--borda);
}
.stage-title h1 {
  margin: 0;
  font-size: 19px;
  letter-spacing: -.01em;
  color: var(--cafe-900);
}
.stage-title p { margin: 2px 0 0; font-size: 12px; color: var(--tinta-suave); }
.stage-status {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 26px;
  font-size: 11.5px;
  color: var(--tinta-suave);
  background: var(--creme);
  border-bottom: 1px solid var(--borda);
}

.stream {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 22px 26px 8px;
  scroll-behavior: smooth;
}
.stream-inner { display: flex; flex-direction: column; gap: 18px; }

.welcome {
  max-width: 560px;
  margin: auto;
  padding: 30px 0;
  text-align: center;
  animation: rise .6s cubic-bezier(.2, .7, .3, 1) both;
}
.stream:has(.welcome) { display: flex; flex-direction: column; }
.welcome-cup {
  width: 66px;
  height: 66px;
  margin: 0 auto 16px;
  padding: 5px;
  border-radius: 20px;
  background: #fff;
  border: 1px solid var(--borda);
  box-shadow: 0 18px 30px -18px rgba(44, 30, 22, .8);
  animation: float 4.5s ease-in-out infinite;
}
.cup-logo { width: 100%; height: 100%; object-fit: contain; }
.welcome h2 { margin: 0 0 6px; font-size: 21px; color: var(--cafe-900); }
.welcome p { margin: 0 auto 22px; font-size: 13.5px; line-height: 1.6; color: var(--tinta-suave); max-width: 400px; }
.welcome p.brewing {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  flex-wrap: wrap;
  color: var(--cafe-700);
  font-weight: 600;
  font-size: 14.5px;
  margin-bottom: 22px;
}
.welcome p.brewing .dot-wave i { background: var(--cafe-500); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.chip {
  position: relative;
  overflow: hidden;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--borda);
  background: #fff;
  color: var(--cafe-800);
  font-size: 12.5px;
  cursor: pointer;
  transition: transform .14s, box-shadow .18s, border-color .18s, color .18s;
}
.chip::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 30%, rgba(224, 168, 118, .55), transparent 70%);
  transform: translateX(-120%);
  transition: transform .55s ease;
}
.chip:hover { transform: translateY(-3px); border-color: var(--cafe-400); color: var(--cafe-900); box-shadow: 0 14px 22px -14px rgba(44, 30, 22, .7); }
.chip:hover::after { transform: translateX(120%); }
.chip:nth-child(1) { animation-delay: .05s; }
.chip:nth-child(2) { animation-delay: .12s; }
.chip:nth-child(3) { animation-delay: .19s; }
.chip:nth-child(4) { animation-delay: .26s; }
.chips .chip { animation: rise .5s cubic-bezier(.2, .7, .3, 1) both; }

.msg { display: flex; gap: 12px; max-width: 82%; }
.msg.user { align-self: flex-end; flex-direction: row-reverse; }
.msg.assistant { align-self: flex-start; }
.who-avatar {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 700;
  margin-top: 18px;
}
.who-avatar.user { background: var(--cafe-800); color: #f6ece4; }
.who-avatar.assistant {
  position: relative;
  padding: 3px;
  background: #fff;
  border: 1px solid var(--borda);
  box-shadow: 0 8px 18px -10px rgba(169, 113, 75, .9);
}
.ava-logo { width: 100%; height: 100%; object-fit: contain; }
.who-avatar.assistant::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 14px;
  background: conic-gradient(from 0deg, transparent, rgba(224, 168, 118, .85), transparent 55%);
  z-index: -1;
  animation: spin-mark 3.6s linear infinite;
}
.who-body { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.msg.user .who-body { align-items: flex-end; }
.who-name { font-size: 11px; font-weight: 700; color: #5b463a; letter-spacing: .03em; text-transform: uppercase; }
.msg.user .who-name { color: #7a5c48; }
.bubble {
  padding: 12px 15px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.6;
  background: linear-gradient(160deg, #ffffff, #fdf6f0);
  border: 1px solid var(--borda);
  box-shadow: 0 10px 24px -20px rgba(44, 30, 22, .6);
  transition: box-shadow .2s, transform .2s, border-color .2s;
}
.msg.assistant:hover .bubble {
  transform: translateY(-2px);
  border-color: var(--cafe-400);
  box-shadow: 0 18px 32px -22px rgba(44, 30, 22, .75);
}
.msg.assistant .bubble { border-top-left-radius: 5px; }
.msg.user .bubble {
  background: linear-gradient(140deg, #4a2f1e, #35210f);
  color: #ffffff;
  border: 1px solid #2a1a0e;
  border-top-right-radius: 5px;
}
.msg.user .bubble .text { color: #ffffff; }
.bubble :deep(strong) { font-weight: 700; color: var(--cafe-700); }
.msg.user .bubble :deep(strong) { color: #ffd9b0; }
.msg.user .bubble :deep(strong) { color: #ffe3c4; }

.typing { display: flex; align-items: center; gap: 10px; }
.dot-wave { display: inline-flex; gap: 4px; }
.dot-wave i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--cafe-500);
  animation: bounce 1.1s infinite;
}
.dot-wave i:nth-child(2) { animation-delay: .15s; }
.dot-wave i:nth-child(3) { animation-delay: .3s; }
@keyframes bounce {
  0%, 70%, 100% { transform: translateY(0); opacity: .45; }
  35% { transform: translateY(-5px); opacity: 1; }
}
.typing-note { font-size: 12px; color: var(--tinta-suave); font-style: italic; }

.composer {
  display: flex;
  gap: 10px;
  padding: 14px 26px 18px;
  background: linear-gradient(0deg, var(--papel) 60%, rgba(251, 248, 244, 0));
}
.composer-field {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  background: #fff;
  border: 1px solid var(--borda);
  border-radius: 14px;
  transition: border-color .16s, box-shadow .16s;
}
.composer-field:focus-within {
  border-color: var(--cafe-400);
  box-shadow: 0 0 0 4px rgba(201, 138, 94, .15);
}
.composer-icon { color: var(--cafe-400); flex-shrink: 0; }
.composer-field input {
  flex: 1;
  border: 0;
  outline: none;
  padding: 13px 0;
  font-size: 14px;
  background: transparent;
  color: var(--tinta);
}
.composer-field input::placeholder { color: #b6a396; }
.send {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  border: 0;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: #fbf3ec;
  background: linear-gradient(140deg, var(--cafe-500), var(--cafe-800));
  box-shadow: 0 14px 26px -16px rgba(44, 30, 22, .9);
  transition: transform .12s, box-shadow .16s, opacity .16s;
}
.send { position: relative; overflow: hidden; }
.send::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, .45), transparent 65%);
  transform: translateX(-130%);
  animation: sheen 3.4s ease-in-out infinite;
}
@keyframes sheen {
  0%, 55% { transform: translateX(-130%); }
  85%, 100% { transform: translateX(130%); }
}
.send:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 20px 30px -18px rgba(44, 30, 22, .95); }
.send:active:not(:disabled) { transform: translateY(0); }
.send:disabled { opacity: .4; cursor: not-allowed; box-shadow: none; }

/* ---------- Motion ---------- */
@keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-9px); }
}

/* scrollbar quente */
.rail-list::-webkit-scrollbar,
.stream::-webkit-scrollbar { width: 9px; }
.rail-list::-webkit-scrollbar-track,
.stream::-webkit-scrollbar-track { background: transparent; }
.rail-list::-webkit-scrollbar-thumb,
.stream::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, var(--cafe-400), var(--cafe-500));
  border-radius: 99px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.stream::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #dcb896, var(--cafe-400)); }
.fade-slide-enter-active, .fade-slide-leave-active { transition: opacity .22s, transform .22s; }
.fade-slide-enter-from, .fade-slide-leave-to { opacity: 0; transform: translateX(-10px); }
.msg-enter-active { transition: opacity .26s, transform .26s; }
.msg-enter-from { opacity: 0; transform: translateY(10px); }

@media (max-width: 900px) {
  .chat-shell { grid-template-columns: 52px 1fr; }
  .rail-body { display: none; }
  }
</style>



















