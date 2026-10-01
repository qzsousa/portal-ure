<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { AxiosError } from 'axios'
import { Heart, Loader2, Mail, MessageSquareText, Paperclip, Search, SearchX, Send, Star } from '@lucide/vue'
import PublicoLayout from '@/components/publico/PublicoLayout.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import {
  avaliarChamadoPorProtocolo,
  consultarChamadoPorProtocolo,
  type ChamadoPublico,
} from '@/api/publico'
import { rotuloStatusChamado } from '@/api/chamados'
import { AUTO_REFRESH_MS, useAutoRefresh } from '@/composables/useAutoRefresh'

const protocolo = ref('')
/** E-mail usado na abertura do chamado — a segunda credencial da consulta. */
const email = ref('')
const buscando = ref(false)
const erro = ref('')
const erroEmail = ref('')
const resultado = ref<ChamadoPublico | null>(null)

/** E-mail já validado desta consulta (reutilizado no polling e na avaliação). */
const emailConsultado = ref('')

const resolvido = computed(() => resultado.value?.status === 'RESOLVIDO')

function emailValido(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

/** Última mensagem é uma PERGUNTA da matriz e o chamado aguarda resposta. */
const aguardandoResposta = computed(() => {
  const msgs = resultado.value?.mensagens
  return resultado.value?.status === 'COMUNICADO' && !!msgs?.length && msgs[msgs.length - 1]?.tipo === 'PERGUNTA'
})

/* ---------- Avaliação do atendimento ---------- */

const nota = ref(0)
const notaHover = ref(0)
const comentario = ref('')
const enviandoAvaliacao = ref(false)
const erroAvaliacao = ref('')
/** Nota enviada nesta sessão (estado "obrigado"). */
const avaliacaoEnviada = ref(0)

const notaExibida = computed(() => notaHover.value || nota.value)

async function enviarAvaliacao() {
  if (!resultado.value || enviandoAvaliacao.value) return
  if (nota.value < 1) {
    erroAvaliacao.value = 'Escolha uma nota de 1 a 5 estrelas.'
    return
  }
  erroAvaliacao.value = ''
  enviandoAvaliacao.value = true
  try {
    await avaliarChamadoPorProtocolo(resultado.value.protocolo, emailConsultado.value, {
      nota: nota.value,
      comentario: comentario.value.trim() || undefined,
    })
    avaliacaoEnviada.value = nota.value
  } catch (e) {
    const err = e as AxiosError
    if (err.response?.status === 409) {
      erroAvaliacao.value = 'Este chamado já recebeu uma avaliação. Obrigado pelo retorno!'
    } else if (err.response?.status === 400) {
      erroAvaliacao.value = 'Este chamado ainda não está disponível para avaliação.'
    } else {
      erroAvaliacao.value = 'Não foi possível enviar sua avaliação agora. Tente novamente.'
    }
  } finally {
    enviandoAvaliacao.value = false
  }
}

async function buscar() {
  erro.value = ''
  erroEmail.value = ''
  resultado.value = null
  nota.value = 0
  notaHover.value = 0
  comentario.value = ''
  erroAvaliacao.value = ''
  avaliacaoEnviada.value = 0
  const p = protocolo.value.trim()
  if (!p) {
    erro.value = 'Informe o número do protocolo.'
    return
  }
  const e = email.value.trim()
  if (!e) {
    erroEmail.value = 'Informe o e-mail usado na abertura do chamado.'
    return
  }
  if (!emailValido(e)) {
    erroEmail.value = 'Informe um e-mail válido (ex.: nome@educacao.sp.gov.br).'
    return
  }
  buscando.value = true
  try {
    resultado.value = await consultarChamadoPorProtocolo(p, e)
    emailConsultado.value = e
  } catch (err) {
    const ax = err as AxiosError<{ message?: string }>
    if (ax.response?.status === 404) {
      // Mesma mensagem do backend: não dizemos qual dos dois dados está errado.
      erro.value = 'Chamado não encontrado. Confira o número do protocolo e o e-mail usados na abertura.'
    } else if (ax.response?.status === 400) {
      erro.value = 'Informe o protocolo e o e-mail para consultar o chamado.'
    } else {
      erro.value = 'Não foi possível consultar agora. Verifique sua conexão e tente novamente.'
    }
  } finally {
    buscando.value = false
  }
}

/**
 * Reconsulta silenciosa: enquanto um resultado está na tela, o status do
 * chamado é atualizado sozinho — sem limpar o formulário de avaliação.
 * Reusa o e-mail que já abriu a consulta (trocar o e-mail exige nova busca).
 */
async function reconsultar() {
  const p = protocolo.value.trim()
  if (!p || !resultado.value || buscando.value) return
  try {
    resultado.value = await consultarChamadoPorProtocolo(p, emailConsultado.value || email.value)
  } catch {
    /* falhas de polling são silenciosas */
  }
}

useAutoRefresh(reconsultar, AUTO_REFRESH_MS.rapido)

/** Prefill via ?protocolo=CH-...&email=... (link vindo da tela de abertura de chamado). */
const route = useRoute()
onMounted(() => {
  const q = String(route.query.protocolo || '').trim()
  const e = String(route.query.email || '').trim()
  if (e) email.value = e
  if (q) {
    protocolo.value = q
    if (e) void buscar()
  }
})

function formatarData(ts: string | null | undefined): string {
  if (!ts) return '—'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<template>
  <PublicoLayout>
    <header class="cabecalho">
      <h1>Consultar chamado</h1>
      <p>
        Informe o número de protocolo <strong>e o e-mail</strong> que você usou na abertura do chamado para
        acompanhar o andamento.
      </p>
    </header>

    <div class="card busca-card">
      <form class="busca-form" @submit.prevent="buscar">
        <div class="busca-campo">
          <label for="busca-protocolo">Protocolo</label>
          <input
            id="busca-protocolo"
            v-model="protocolo"
            class="input busca-input"
            type="text"
            placeholder="Ex.: CH-20260101-0001"
            autocomplete="off"
            @keyup.enter="buscar"
          />
        </div>
        <div class="busca-campo">
          <label for="busca-email">E-mail usado na abertura</label>
          <input
            id="busca-email"
            v-model="email"
            class="input busca-input"
            :class="{ inv: erroEmail }"
            type="email"
            placeholder="nome@educacao.sp.gov.br"
            autocomplete="email"
            :aria-invalid="!!erroEmail"
          />
          <p v-if="erroEmail" class="busca-erro-campo">{{ erroEmail }}</p>
        </div>
        <button type="submit" class="btn btn-primary busca-btn" :disabled="buscando">
          <Loader2 v-if="buscando" class="spin" :size="16" />
          <Search v-else :size="16" />
          {{ buscando ? 'Buscando...' : 'Consultar' }}
        </button>
      </form>
      <p class="busca-dica">
        <Mail :size="13" />
        Por segurança, o chamado só abre para quem o abriu: o e-mail precisa ser o mesmo informado no formulário.
      </p>
      <p v-if="erro" class="busca-erro"><SearchX :size="15" /> {{ erro }}</p>
    </div>

    <div v-if="resultado" class="card resultado">
      <div class="resultado-topo">
        <div>
          <span class="r-label">Protocolo</span>
          <strong class="r-protocolo">{{ resultado.protocolo }}</strong>
        </div>
        <StatusPill :status="rotuloStatusChamado(resultado.status)" />
      </div>

      <dl class="r-grid">
        <div class="r-item">
          <dt>Unidade</dt>
          <dd>{{ resultado.unidade }}</dd>
        </div>
        <div class="r-item">
          <dt>Solicitante</dt>
          <dd>{{ resultado.solicitante }}</dd>
        </div>
        <div class="r-item">
          <dt>Tipo de problema</dt>
          <dd>{{ resultado.tipo }}</dd>
        </div>
        <div class="r-item">
          <dt>Aberto em</dt>
          <dd>{{ formatarData(resultado.timestamp) }}</dd>
        </div>
        <div class="r-item">
          <dt>Última atualização</dt>
          <dd>{{ formatarData(resultado.ultimaAtualizacao) }}</dd>
        </div>
        <div v-if="resultado.anexoUrl" class="r-item">
          <dt>Anexo</dt>
          <dd>
            <a :href="resultado.anexoUrl" target="_blank" rel="noopener" class="r-link">
              <Paperclip :size="13" /> Ver anexo
            </a>
          </dd>
        </div>
      </dl>

      <div class="r-bloco">
        <h3>O que foi relatado</h3>
        <p>{{ resultado.descricao }}</p>
      </div>

      <div v-if="resultado.descricaoResolucao" class="r-bloco r-resolucao">
        <h3>Resposta da equipe</h3>
        <p>{{ resultado.descricaoResolucao }}</p>
      </div>

      <!-- ===== Conversa com a matriz (perguntas "Aguardando resposta") ===== -->
      <section v-if="resultado.mensagens?.length" class="conversa">
        <h3 class="conversa-titulo">
          <MessageSquareText :size="16" />
          Conversa com a matriz
        </h3>
        <div v-if="aguardandoResposta" class="conversa-alerta">
          <strong>A matriz fez uma pergunta e aguarda sua resposta.</strong>
          Para responder, acesse o portal com o usuário da sua unidade ou fale com o SETEC.
        </div>
        <ol class="thread">
          <li
            v-for="m in resultado.mensagens"
            :key="m.id"
            class="msg"
            :class="m.tipo === 'PERGUNTA' ? 'msg-matriz' : 'msg-unidade'"
          >
            <header class="msg-topo">
              <strong>{{ m.tipo === 'PERGUNTA' ? 'Matriz (SETEC)' : `Você — ${m.autorNome}` }}</strong>
              <time>{{ formatarData(m.createdAt) }}</time>
            </header>
            <p class="msg-texto">{{ m.texto }}</p>
            <ul v-if="m.anexos?.length" class="msg-anexos">
              <li v-for="a in m.anexos" :key="a.url">
                <a :href="a.url" target="_blank" rel="noopener" class="r-link">
                  <Paperclip :size="12" /> {{ a.nome }}
                </a>
              </li>
            </ul>
          </li>
        </ol>
      </section>

      <!-- ===== Avaliação do atendimento (somente chamados resolvidos) ===== -->
      <section v-if="resolvido" class="avaliacao">
        <!-- Obrigado (recém-enviada nesta sessão) -->
        <template v-if="avaliacaoEnviada">
          <div class="avaliacao-obrigado">
            <Heart :size="20" />
            <div>
              <h3>Obrigado pela sua avaliação!</h3>
              <p>Seu retorno ajuda a equipe de tecnologia a melhorar o atendimento às escolas.</p>
            </div>
          </div>
          <div class="estrelas readonly" aria-label="Sua nota">
            <Star
              v-for="i in 5"
              :key="i"
              :size="26"
              :fill="i <= avaliacaoEnviada ? '#f5b921' : 'none'"
              :color="i <= avaliacaoEnviada ? '#f5b921' : '#cbd5e1'"
            />
          </div>
        </template>

        <!-- Já avaliado anteriormente (somente leitura) -->
        <template v-else-if="resultado.avaliacao">
          <h3 class="avaliacao-titulo">Sua avaliação</h3>
          <div class="estrelas readonly" aria-label="Nota atribuída">
            <Star
              v-for="i in 5"
              :key="i"
              :size="26"
              :fill="i <= resultado.avaliacao.nota ? '#f5b921' : 'none'"
              :color="i <= resultado.avaliacao.nota ? '#f5b921' : '#cbd5e1'"
            />
          </div>
          <p v-if="resultado.avaliacao.comentario" class="avaliacao-comentario">
            "{{ resultado.avaliacao.comentario }}"
          </p>
        </template>

        <!-- Formulário de avaliação -->
        <template v-else>
          <h3 class="avaliacao-titulo">Avalie o atendimento</h3>
          <p class="avaliacao-sub">O seu chamado foi resolvido. Como foi o atendimento da nossa equipe?</p>
          <div class="estrelas" role="radiogroup" aria-label="Nota de 1 a 5 estrelas">
            <button
              v-for="i in 5"
              :key="i"
              type="button"
              class="estrela"
              :aria-label="`${i} ${i === 1 ? 'estrela' : 'estrelas'}`"
              @click="nota = i"
              @mouseenter="notaHover = i"
              @mouseleave="notaHover = 0"
            >
              <Star
                :size="30"
                :fill="i <= notaExibida ? '#f5b921' : 'none'"
                :color="i <= notaExibida ? '#f5b921' : '#cbd5e1'"
              />
            </button>
          </div>
          <div class="field">
            <label for="comentario-avaliacao">
              Comentário <span class="opcional">(opcional)</span>
            </label>
            <textarea
              id="comentario-avaliacao"
              v-model="comentario"
              class="input textarea"
              rows="3"
              placeholder="Conte como foi o atendimento (opcional)..."
            ></textarea>
          </div>
          <p v-if="erroAvaliacao" class="erro-campo">{{ erroAvaliacao }}</p>
          <button
            type="button"
            class="btn btn-gold"
            :disabled="enviandoAvaliacao || nota < 1"
            @click="enviarAvaliacao"
          >
            <Loader2 v-if="enviandoAvaliacao" class="spin" :size="16" />
            <Send v-else :size="16" />
            {{ enviandoAvaliacao ? 'Enviando...' : 'Enviar avaliação' }}
          </button>
        </template>
      </section>
    </div>

    <p class="ajuda">
      Ainda não abriu um chamado?
      <RouterLink to="/chamado/novo" class="ajuda-link">Abrir um chamado</RouterLink>
    </p>
  </PublicoLayout>
</template>

<style scoped>
.cabecalho {
  margin-bottom: 20px;
}

.cabecalho h1 {
  color: var(--text-primary);
  font-size: 26px;
}

.cabecalho p {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
  max-width: 60ch;
}

.busca-card {
  padding: 18px;
}

.busca-form {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.busca-campo {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
  min-width: 0;
}

.busca-campo label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
}

.busca-input {
  min-width: 0;
}

.busca-btn {
  flex-shrink: 0;
  margin-top: 22px;
}

.busca-dica {
  margin: 12px 0 0;
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  color: var(--text-muted);
}

.busca-erro-campo {
  margin: 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--red);
}

.busca-erro {
  margin: 12px 0 0;
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  color: var(--red);
  background: var(--red-soft);
  border-radius: var(--radius-sm);
  padding: 9px 12px;
}

.resultado {
  margin-top: 16px;
  padding: 22px;
}

.resultado-topo {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.r-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.r-protocolo {
  font-size: 18px;
  letter-spacing: 0.03em;
}

.r-grid {
  margin: 0;
  padding: 16px 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  gap: 14px;
}

.r-item dt {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 3px;
}

.r-item dd {
  margin: 0;
  font-size: 14px;
  color: var(--text-primary);
}

.r-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--blue);
  font-weight: 600;
}

.r-link:hover {
  text-decoration: underline;
}

.r-bloco {
  border-top: 1px solid var(--border);
  padding-top: 14px;
  margin-top: 4px;
}

.r-bloco h3 {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.r-bloco p {
  margin: 0;
  font-size: 14px;
  color: var(--text-primary);
  white-space: pre-wrap;
}

.r-resolucao {
  background: var(--green-soft);
  border: 1px solid var(--green);
  border-radius: var(--radius-sm);
  padding: 14px 16px;
  margin-top: 16px;
}

/* ---------- Avaliação ---------- */

.avaliacao {
  border-top: 1px solid var(--border);
  padding-top: 20px;
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: flex-start;
}

.avaliacao-titulo {
  font-size: 15px;
}

.avaliacao-sub {
  margin: -6px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.estrelas {
  display: flex;
  gap: 6px;
}

.estrela {
  padding: 2px;
  border-radius: 6px;
  transition: transform 0.08s ease;
}

.estrela:hover {
  transform: scale(1.12);
}

.estrelas.readonly {
  pointer-events: none;
}

.avaliacao-comentario {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
  background: var(--surface-muted);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  white-space: pre-wrap;
}

.avaliacao-obrigado {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: var(--green);
}

.avaliacao-obrigado h3 {
  font-size: 15px;
  color: var(--text-primary);
}

.avaliacao-obrigado p {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.avaliacao .textarea {
  resize: vertical;
  min-height: 80px;
}

.avaliacao .field {
  width: 100%;
}

.avaliacao .opcional {
  font-weight: 400;
  color: var(--text-muted);
}

.avaliacao .erro-campo {
  margin: 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--red);
}

.ajuda {
  margin: 22px 0 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

.ajuda-link {
  color: var(--blue);
  font-weight: 600;
}

.ajuda-link:hover {
  text-decoration: underline;
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .busca-form {
    flex-direction: column;
  }
  .busca-btn {
    width: 100%;
    justify-content: center;
    margin-top: 4px;
  }
  .resultado-topo {
    flex-direction: column;
    align-items: flex-start;
  }
}

/* ---------- Conversa com a matriz ---------- */
.conversa {
  margin-top: 16px;
}

.conversa-titulo {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 10px;
}

.conversa-alerta {
  background: var(--blue-soft);
  border: 1px solid #c0dcf0;
  color: #0b3d6b;
  border-radius: var(--radius-sm);
  padding: 10px 13px;
  font-size: 13px;
  line-height: 1.5;
  margin: 0 0 12px;
}

.conversa-alerta strong {
  display: block;
}

.thread {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.msg {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 13px;
  font-size: 13.5px;
}

.msg-matriz {
  background: #fdf7ea;
  border-color: #f0d49a;
  border-left: 3px solid var(--brand-gold);
}

.msg-unidade {
  background: var(--surface-muted);
  border-left: 3px solid var(--blue);
}

.msg-topo {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.msg-topo strong {
  font-size: 12px;
  color: var(--text-secondary);
}

.msg-topo time {
  font-size: 11.5px;
  color: var(--text-muted);
}

.msg-texto {
  margin: 0;
  white-space: pre-wrap;
  color: var(--text-primary);
  line-height: 1.55;
}

.msg-anexos {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
}

.msg-anexos li {
  font-size: 12.5px;
}
</style>
