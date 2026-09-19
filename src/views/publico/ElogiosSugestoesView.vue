<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { CheckCircle2, Heart, Lightbulb, Loader2, Send } from '@lucide/vue'
import PublicoLayout from '@/components/publico/PublicoLayout.vue'
import { useUiStore } from '@/stores/ui'
import {
  enviarFeedbackPublico,
  listarEscolasPublico,
  type NovoFeedbackPayload,
  type TipoFeedback,
} from '@/api/publico'

const ui = useUiStore()

const tipo = ref<TipoFeedback>('ELOGIO')
const form = reactive({ nome: '', unidade: '', mensagem: '' })

const escolas = ref<string[]>([])
const carregandoEscolas = ref(true)
const erro = ref('')
const enviando = ref(false)
const enviado = ref(false)

onMounted(async () => {
  try {
    escolas.value = await listarEscolasPublico()
  } catch {
    ui.error('Não foi possível carregar a lista de escolas.')
  } finally {
    carregandoEscolas.value = false
  }
})

async function enviar() {
  if (enviando.value) return
  erro.value = ''
  if (form.mensagem.trim().length < 3) {
    erro.value = 'Escreva sua mensagem (mínimo de 3 caracteres).'
    return
  }

  enviando.value = true
  try {
    const payload: NovoFeedbackPayload = {
      tipo: tipo.value,
      mensagem: form.mensagem.trim(),
    }
    if (form.nome.trim()) payload.nome = form.nome.trim()
    if (form.unidade) payload.unidade = form.unidade

    await enviarFeedbackPublico(payload)
    enviado.value = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch {
    ui.error('Não foi possível enviar agora. Tente novamente em instantes.')
  } finally {
    enviando.value = false
  }
}

function enviarOutra() {
  enviado.value = false
  form.nome = ''
  form.unidade = ''
  form.mensagem = ''
  erro.value = ''
}
</script>

<template>
  <PublicoLayout>
    <!-- ===== Sucesso ===== -->
    <div v-if="enviado" class="card sucesso">
      <div class="selo"><CheckCircle2 :size="30" :stroke-width="2" /></div>
      <h2>{{ tipo === 'ELOGIO' ? 'Elogio enviado!' : 'Sugestão enviada!' }}</h2>
      <p class="sucesso-sub">
        Obrigado pelo seu retorno — ele ajuda a equipe de tecnologia da URE Leste 3 a atender
        cada vez melhor as escolas da região.
      </p>
      <button type="button" class="btn btn-outline" @click="enviarOutra">Enviar outra mensagem</button>
    </div>

    <!-- ===== Formulário ===== -->
    <template v-else>
      <header class="cabecalho">
        <h1>Elogios e sugestões</h1>
        <p>
          Gostou do atendimento ou tem uma ideia para melhorarmos? Conte para a gente — sua
          opinião chega diretamente à equipe de tecnologia (SETEC).
        </p>
      </header>

      <form class="card form" novalidate @submit.prevent="enviar">
        <div class="tipo-switch" role="radiogroup" aria-label="Tipo de mensagem">
          <button
            type="button"
            class="tipo-btn elogio"
            :class="{ ativo: tipo === 'ELOGIO' }"
            @click="tipo = 'ELOGIO'"
          >
            <Heart :size="20" />
            <span>
              <strong>Elogio</strong>
              <small>Reconhecer um bom atendimento</small>
            </span>
          </button>
          <button
            type="button"
            class="tipo-btn sugestao"
            :class="{ ativo: tipo === 'SUGESTAO' }"
            @click="tipo = 'SUGESTAO'"
          >
            <Lightbulb :size="20" />
            <span>
              <strong>Sugestão</strong>
              <small>Propor uma melhoria</small>
            </span>
          </button>
        </div>

        <div class="dupla">
          <div class="field">
            <label for="nome">Seu nome <span class="opcional">(opcional)</span></label>
            <input id="nome" v-model="form.nome" class="input" type="text" placeholder="Ex.: Maria Silva" />
          </div>
          <div class="field">
            <label for="unidade">Unidade escolar <span class="opcional">(opcional)</span></label>
            <select id="unidade" v-model="form.unidade" class="select-input" :disabled="carregandoEscolas">
              <option value="">{{ carregandoEscolas ? 'Carregando...' : '— Selecione a escola —' }}</option>
              <option v-for="e in escolas" :key="e" :value="e">{{ e }}</option>
            </select>
          </div>
        </div>

        <div class="field">
          <label for="mensagem">Mensagem *</label>
          <textarea
            id="mensagem"
            v-model="form.mensagem"
            class="input textarea"
            rows="5"
            :placeholder="
              tipo === 'ELOGIO'
                ? 'Conte o que aconteceu e quem atendeu você...'
                : 'Descreva sua sugestão com o máximo de detalhes...'
            "
          ></textarea>
          <p v-if="erro" class="erro-campo">{{ erro }}</p>
        </div>

        <button type="submit" class="btn btn-gold btn-enviar" :disabled="enviando">
          <Loader2 v-if="enviando" class="spin" :size="16" />
          <Send v-else :size="16" />
          {{ enviando ? 'Enviando...' : 'Enviar mensagem' }}
        </button>
      </form>

      <p class="ajuda">
        Precisa de suporte técnico?
        <RouterLink to="/chamado/novo" class="ajuda-link">Abrir um chamado</RouterLink>
      </p>
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

/* ---------- alternador Elogio / Sugestão ---------- */

.tipo-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 560px) {
  .tipo-switch {
    grid-template-columns: 1fr;
  }
}

.tipo-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-secondary);
  text-align: left;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.tipo-btn span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tipo-btn strong {
  font-size: 14px;
}

.tipo-btn small {
  font-size: 12px;
  color: var(--text-muted);
}

.tipo-btn.elogio.ativo {
  border-color: var(--green);
  background: var(--green-soft);
  color: var(--green);
  box-shadow: 0 0 0 3px rgb(22 163 74 / 0.12);
}

.tipo-btn.elogio.ativo small {
  color: var(--green);
}

.tipo-btn.sugestao.ativo {
  border-color: var(--blue);
  background: var(--blue-soft);
  color: var(--blue);
  box-shadow: 0 0 0 3px rgb(37 99 235 / 0.12);
}

.tipo-btn.sugestao.ativo small {
  color: var(--blue);
}

/* ---------- campos ---------- */

.dupla {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

@media (max-width: 640px) {
  .dupla {
    grid-template-columns: 1fr;
  }
}

.opcional {
  font-weight: 400;
  color: var(--text-muted);
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
  max-width: 46ch;
}

.sucesso .btn {
  margin-top: 24px;
}

/* ---------- rodapé auxiliar ---------- */

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
