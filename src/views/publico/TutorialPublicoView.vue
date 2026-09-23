<script setup lang="ts">
/**
 * Tutorial público (/tutorial/:id) — leitura SEM autenticação, para
 * compartilhar guias com usuários fora do sistema (escolas, professores).
 * Espelha o visual do detalhe interno, sem ações administrativas.
 */
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { AxiosError } from 'axios'
import { Eye, Link2, Paperclip, SearchX } from '@lucide/vue'
import PublicoLayout from '@/components/publico/PublicoLayout.vue'
import { linkPublicoTutorial, obterTutorialPublico, type TutorialPublico } from '@/api/publico'
import { formatDateTime } from '@/utils/format'

const route = useRoute()

const tutorial = ref<TutorialPublico | null>(null)
const carregando = ref(true)
const naoEncontrado = ref(false)
const linkCopiado = ref(false)

async function carregar() {
  carregando.value = true
  naoEncontrado.value = false
  try {
    tutorial.value = await obterTutorialPublico(String(route.params.id || ''))
  } catch (e) {
    tutorial.value = null
    naoEncontrado.value = (e as AxiosError).response?.status === 404
  } finally {
    carregando.value = false
  }
}

async function copiarLink() {
  if (!tutorial.value) return
  try {
    await navigator.clipboard.writeText(linkPublicoTutorial(tutorial.value.id))
    linkCopiado.value = true
    setTimeout(() => (linkCopiado.value = false), 2500)
  } catch {
    /* clipboard indisponível (contexto não seguro) — usuário copia pela barra do navegador */
  }
}

onMounted(carregar)
</script>

<template>
  <PublicoLayout>
    <div v-if="carregando" class="card pub-card estado-central">Carregando tutorial...</div>

    <div v-else-if="!tutorial" class="card pub-card estado-central">
      <SearchX :size="26" />
      <strong>{{ naoEncontrado ? 'Tutorial não encontrado.' : 'Não foi possível carregar o tutorial.' }}</strong>
      <span v-if="naoEncontrado">Confira o link recebido ou peça um novo para a equipe de TI.</span>
      <span v-else>Verifique sua conexão e tente novamente.</span>
    </div>

    <template v-else>
      <article class="card pub-card">
        <div class="head-top">
          <span class="cat-chip">
            <span class="chip-dot" :style="{ background: tutorial.categoria.cor || '#081a33' }" />
            {{ tutorial.categoria.nome }}
          </span>
          <button class="btn-copiar" type="button" @click="copiarLink">
            <Link2 :size="14" />
            {{ linkCopiado ? 'Link copiado!' : 'Copiar link' }}
          </button>
        </div>

        <h1>{{ tutorial.titulo }}</h1>
        <p v-if="tutorial.subtitulo" class="subtitulo">{{ tutorial.subtitulo }}</p>

        <div class="meta">
          <span>{{ tutorial.criadoPor }}</span>
          <span class="sep">•</span>
          <span>{{ formatDateTime(tutorial.createdAt) }}</span>
          <span class="sep">•</span>
          <span class="meta-icone">
            <Eye :size="14" />
            {{ tutorial.visualizacoes }} visualizações
          </span>
        </div>

        <p class="conteudo">{{ tutorial.conteudo }}</p>

        <div v-if="tutorial.anexos.length" class="anexos">
          <h3>Anexos ({{ tutorial.anexos.length }})</h3>
          <ul class="anexos-lista">
            <li v-for="a in tutorial.anexos" :key="a.id">
              <Paperclip :size="15" />
              <a :href="a.url" target="_blank" rel="noopener" class="anexo-link">{{ a.nome }}</a>
              <span v-if="a.tipo" class="anexo-tipo">{{ a.tipo }}</span>
            </li>
          </ul>
        </div>
      </article>
    </template>
  </PublicoLayout>
</template>

<style scoped>
.pub-card {
  padding: 24px 26px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.estado-central {
  align-items: center;
  text-align: center;
  padding: 44px 20px;
  color: var(--text-muted);
  font-size: 13.5px;
}

.estado-central strong {
  color: var(--text-secondary);
  font-size: 14.5px;
}

.head-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.cat-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.btn-copiar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s ease;
}

.btn-copiar:hover {
  background: var(--surface-muted);
}

.pub-card h1 {
  font-size: 21px;
  line-height: 1.3;
}

.subtitulo {
  margin: 0;
  font-size: 14.5px;
  color: var(--text-muted);
}

.meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12.5px;
  color: var(--text-muted);
}

.sep {
  color: var(--border-strong);
}

.meta-icone {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.conteudo {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.65;
  color: var(--text-secondary);
  white-space: pre-wrap;
}

.anexos h3 {
  font-size: 14px;
  margin-bottom: 10px;
}

.anexos-lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.anexos-lista li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
}

.anexo-link {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
  color: var(--blue);
}

.anexo-link:hover {
  text-decoration: underline;
}

.anexo-tipo {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}
</style>
