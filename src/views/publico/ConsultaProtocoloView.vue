<script setup lang="ts">
import { ref } from 'vue'
import { AxiosError } from 'axios'
import { Loader2, Paperclip, Search, SearchX } from '@lucide/vue'
import PublicoLayout from '@/components/publico/PublicoLayout.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import { consultarChamadoPorProtocolo, type ChamadoPublico } from '@/api/publico'
import { rotuloStatusChamado } from '@/api/chamados'

const protocolo = ref('')
const buscando = ref(false)
const erro = ref('')
const resultado = ref<ChamadoPublico | null>(null)

async function buscar() {
  erro.value = ''
  resultado.value = null
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
