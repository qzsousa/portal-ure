<script setup lang="ts">
import { computed, ref } from 'vue'
import { AxiosError } from 'axios'
import { Heart, Loader2, Paperclip, Search, SearchX, Send, Star } from '@lucide/vue'
import PublicoLayout from '@/components/publico/PublicoLayout.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import {
  avaliarChamadoPorProtocolo,
  consultarChamadoPorProtocolo,
  type ChamadoPublico,
} from '@/api/publico'
import { rotuloStatusChamado } from '@/api/chamados'

const protocolo = ref('')
const buscando = ref(false)
const erro = ref('')
const resultado = ref<ChamadoPublico | null>(null)

const resolvido = computed(() => resultado.value?.status === 'RESOLVIDO')

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
    await avaliarChamadoPorProtocolo(resultado.value.protocolo, {
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
  buscando.value = true
  try {
    resultado.value = await consultarChamadoPorProtocolo(p)
  } catch (e) {
    const err = e as AxiosError<{ message?: string }>
    if (err.response?.status === 404) {
      erro.value = 'Chamado não encontrado. Confira o número do protocolo e tente novamente.'
    } else {
      erro.value = 'Não foi possível consultar agora. Verifique sua conexão e tente novamente.'
    }
  } finally {
    buscando.value = false
  }
}

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
      <p>Informe o número de protocolo que você recebeu ao abrir o chamado para acompanhar o andamento.</p>
    </header>

    <div class="card busca-card">
      <form class="busca-form" @submit.prevent="buscar">
        <input
          v-model="protocolo"
          class="input busca-input"
          type="text"
          placeholder="Ex.: CH-20260101-0001"
          @keyup.enter="buscar"
        />
        <button type="submit" class="btn btn-primary" :disabled="buscando">
          <Loader2 v-if="buscando" class="spin" :size="16" />
          <Search v-else :size="16" />
          {{ buscando ? 'Buscando...' : 'Consultar' }}
        </button>
      </form>
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
  color: #fff;
  font-size: 26px;
}

.cabecalho p {
  margin: 6px 0 0;
  color: rgb(255 255 255 / 0.7);
  font-size: 14px;
  max-width: 60ch;
}

.busca-card {
  padding: 18px;
}

.busca-form {
  display: flex;
  gap: 10px;
}

.busca-input {
  flex: 1;
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
  gap: 12px;
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
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
  color: rgb(255 255 255 / 0.65);
}

.ajuda-link {
  color: var(--brand-gold);
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
</style>
