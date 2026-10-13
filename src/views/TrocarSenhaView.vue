<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiError } from '@/utils/apiError'
import { Check, Eye, EyeOff, KeyRound, Loader2, X } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({ senhaAtual: '', novaSenha: '', confirmar: '' })
const erro = ref('')
const carregando = ref(false)
const mostrarNovaSenha = ref(false)
const mostrarConfirmacao = ref(false)

/**
 * São TRÊS situações diferentes nesta tela, e a pessoa não sabe dizer qual é.
 *
 * A tela antiga decidia tudo por `primeiroLogin`, e quem tinha recebido senha
 * provisória da Matriz caía em "Trocar senha" com o campo "Senha atual" — que
 * é justamente a senha que essa pessoa NÃO tem na mão: ela tem a senha nova,
 * temporária. O campo pedia a senha velha esquecida.
 *
 * Agora os dois sinais da store separam os casos, porque eles são diferentes na
 * origem e iguais na consequência (`src/stores/auth.ts`):
 *
 *  - `senhaProvisoria`      → a senha ATUAL foi gerada pela Matriz agora;
 *  - `mustChangePassword`   → precisa trocar antes de usar o sistema; se não há
 *                            senha provisória, é o primeiro acesso;
 *  - nenhum dos dois        → troca normal, a pessoa sabe a senha atual.
 */
type Fluxo = 'primeiroAcesso' | 'provisoria' | 'troca'

const fluxo = computed<Fluxo>(() => {
  if (auth.senhaProvisoria) return 'provisoria'
  if (auth.mustChangePassword) return 'primeiroAcesso'
  return 'troca'
})

/**
 * Nos dois fluxos forçados o campo "senha atual" NÃO EXISTE.
 *
 * A pessoa não tem senha antiga para digitar — ela tem a senha nova, que a
 * Matriz acabou de entregar — e o servidor também não a conferiria: `/change-password`
 * só valida `senhaAtual` quando a pessoa tem senha definitiva
 * (`backend/src/routes/auth.ts`). Pedir o campo seria pedir algo que não tem
 * resposta certa e que ninguém conferiria. Teria dois campos que parecem
 * idênticos e o primeiro não decide nada.
 */
const mostrarCampoAtual = computed(() => fluxo.value === 'troca')

const TEXTOS: Record<Fluxo, { titulo: string; dica: string }> = {
  primeiroAcesso: {
    titulo: 'Defina sua senha',
    dica: 'Este é seu primeiro acesso. Crie uma senha definitiva para continuar.',
  },
  provisoria: {
    titulo: 'Trocar senha provisória',
    dica: 'A Matriz acabou de gerar uma senha provisória para você. Crie agora a sua senha definitiva.',
  },
  troca: {
    titulo: 'Trocar senha',
    dica: 'Após trocar a senha, você precisará entrar novamente.',
  },
}

/** Só o fluxo de troca normal tem senha atual — nos forçados o campo sai. */
const TEXTO_TROCA = {
  rotulo: 'Senha atual',
  dica: 'A senha definitiva que você usa hoje para entrar.',
  vazio: 'Informe sua senha atual.',
}

const texto = computed(() => TEXTOS[fluxo.value])

/**
 * Política de senha, as MESMAS cinco regras do backend.
 *
 * Avaliadas aqui para dar retorno em tempo real, mas quem decide é o servidor:
 * passar por esta barra não garante que a troca seja aceita.
 */
const REQUISITOS = [
  { id: 'tamanho', rotulo: 'Pelo menos 8 caracteres', ok: (s: string) => s.length >= 8 },
  { id: 'maiuscula', rotulo: 'Uma letra maiúscula', ok: (s: string) => /[A-Z]/.test(s) },
  { id: 'minuscula', rotulo: 'Uma letra minúscula', ok: (s: string) => /[a-z]/.test(s) },
  { id: 'numero', rotulo: 'Um número', ok: (s: string) => /[0-9]/.test(s) },
  { id: 'especial', rotulo: 'Um caractere especial', ok: (s: string) => /[^A-Za-z0-9]/.test(s) },
]

const requisitos = computed(() =>
  REQUISITOS.map((r) => ({ id: r.id, rotulo: r.rotulo, ok: r.ok(form.novaSenha) })),
)
const atendidos = computed(() => requisitos.value.filter((r) => r.ok).length)
const requisitosOk = computed(() => atendidos.value === REQUISITOS.length)

async function submit() {
  erro.value = ''
  // A senha atual só é exigida no fluxo de troca normal — nos forçados o campo
  // nem existe, e o servidor também não a conferiria. Vai vazia de propósito.
  if (mostrarCampoAtual.value && !form.senhaAtual) {
    erro.value = TEXTO_TROCA.vazio
    return
  }
  if (!requisitosOk.value) {
    const faltando = requisitos.value.filter((r) => !r.ok).map((r) => r.rotulo.toLowerCase())
    erro.value = `A senha nova ainda não cumpre: ${faltando.join(', ')}.`
    return
  }
  if (form.novaSenha !== form.confirmar) {
    erro.value = 'A confirmação não confere com a nova senha.'
    return
  }
  carregando.value = true
  try {
    await auth.changePassword({
      senhaAtual: mostrarCampoAtual.value ? form.senhaAtual : '',
      novaSenha: form.novaSenha,
    })
    router.push({ name: 'login' })
  } catch (e) {
    erro.value = apiError(e, 'Não foi possível trocar a senha.')
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <div class="page-center">
    <div class="card senha-card">
      <h1>{{ texto.titulo }}</h1>
      <p class="hint">{{ texto.dica }}</p>

      <form class="senha-form" @submit.prevent="submit">
        <!-- Só no fluxo de troca normal. Nos forçados o campo sai: não há
             senha antiga para digitar, e o servidor não a conferiria. -->
        <div v-if="mostrarCampoAtual" class="field">
          <label for="atual">{{ TEXTO_TROCA.rotulo }}</label>
          <input
            id="atual"
            v-model="form.senhaAtual"
            class="input"
            type="password"
            autocomplete="current-password"
            required
          />
          <small class="field-hint">{{ TEXTO_TROCA.dica }}</small>
        </div>

        <div class="field">
          <label for="nova">Nova senha</label>
          <div class="input-senha-wrap">
            <input
              id="nova"
              v-model="form.novaSenha"
              class="input input-senha"
              :type="mostrarNovaSenha ? 'text' : 'password'"
              autocomplete="new-password"
              required
            />
            <button
              type="button"
              class="btn-olho"
              :aria-label="mostrarNovaSenha ? 'Ocultar senha' : 'Mostrar senha'"
              :aria-pressed="mostrarNovaSenha"
              :title="mostrarNovaSenha ? 'Ocultar senha' : 'Mostrar senha'"
              @click="mostrarNovaSenha = !mostrarNovaSenha"
            >
              <span class="olho-icone" :class="{ visivel: mostrarNovaSenha }">
                <EyeOff v-if="mostrarNovaSenha" :size="16" />
                <Eye v-else :size="16" />
              </span>
            </button>
          </div>
        </div>

        <!-- Barra de requisitos: em tempo real, um pedaço por regra. -->
        <div class="forca" :class="{ completa: requisitosOk }">
          <div class="forca-topo">
            <span class="forca-rotulo">Requisitos da senha</span>
            <span class="forca-contagem">{{ atendidos }} de {{ REQUISITOS.length }}</span>
          </div>
          <div
            class="forca-barra"
            role="progressbar"
            aria-label="Requisitos da senha já atendidos"
            aria-valuemin="0"
            :aria-valuemax="REQUISITOS.length"
            :aria-valuenow="atendidos"
          >
            <span
              v-for="r in requisitos"
              :key="r.id"
              class="forca-trecho"
              :class="{ ok: r.ok }"
            />
          </div>
          <ul class="requisitos">
            <li v-for="r in requisitos" :key="r.id" class="requisito" :class="{ ok: r.ok }">
              <Check v-if="r.ok" :size="13" />
              <X v-else :size="13" />
              {{ r.rotulo }}
            </li>
          </ul>
        </div>

        <div class="field">
          <label for="confirmar">Confirmar nova senha</label>
          <div class="input-senha-wrap">
            <input
              id="confirmar"
              v-model="form.confirmar"
              class="input input-senha"
              :type="mostrarConfirmacao ? 'text' : 'password'"
              autocomplete="new-password"
              required
            />
            <button
              type="button"
              class="btn-olho"
              :aria-label="mostrarConfirmacao ? 'Ocultar senha' : 'Mostrar senha'"
              :aria-pressed="mostrarConfirmacao"
              :title="mostrarConfirmacao ? 'Ocultar senha' : 'Mostrar senha'"
              @click="mostrarConfirmacao = !mostrarConfirmacao"
            >
              <span class="olho-icone" :class="{ visivel: mostrarConfirmacao }">
                <EyeOff v-if="mostrarConfirmacao" :size="16" />
                <Eye v-else :size="16" />
              </span>
            </button>
          </div>
        </div>

        <p v-if="erro" class="form-erro">{{ erro }}</p>

        <button
          class="btn btn-gold senha-submit"
          type="submit"
          :disabled="carregando || !requisitosOk"
        >
          <Loader2 v-if="carregando" class="spin" :size="16" />
          <KeyRound v-else :size="16" />
          Salvar nova senha
        </button>
        <small v-if="!requisitosOk" class="submit-aviso">
          O botão só libera quando os {{ REQUISITOS.length }} requisitos forem atendidos.
        </small>
      </form>
    </div>
  </div>
</template>

<style scoped>
.page-center {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: linear-gradient(160deg, #081a33 0%, #0a2140 45%, #061429 100%);
}

.senha-card {
  width: 100%;
  max-width: 420px;
  padding: 32px;
}

.senha-card h1 {
  font-size: 20px;
  margin-bottom: 6px;
}

.hint {
  margin: 0 0 20px;
  font-size: 13px;
  color: var(--text-secondary);
}

.senha-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-hint {
  display: block;
  margin-top: 6px;
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--text-muted);
}

/* Botão do olho: mesmo padrão da tela de login. */
.input-senha-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-senha {
  padding-right: 42px;
}

.btn-olho {
  position: absolute;
  right: 6px;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.btn-olho:hover {
  background: var(--surface-muted);
  color: var(--text-primary);
}

.olho-icone {
  display: grid;
  place-items: center;
  transition:
    transform 0.25s ease,
    opacity 0.15s ease;
}

.olho-icone.visivel {
  transform: rotate(180deg);
}

/* ---------- Barra de requisitos ---------- */

.forca {
  padding: 12px 13px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--surface-muted);
  background: var(--surface-muted);
}

.forca.completa {
  border-color: color-mix(in srgb, var(--green) 45%, transparent);
  background: color-mix(in srgb, var(--green-soft) 55%, transparent);
}

.forca-topo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.forca-rotulo {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-secondary);
}

.forca-contagem {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.forca.completa .forca-contagem {
  color: var(--green);
}

.forca-barra {
  display: flex;
  gap: 4px;
}

.forca-trecho {
  flex: 1;
  height: 4px;
  border-radius: 999px;
  background: var(--border);
  transition: background 0.2s ease;
}

.forca-trecho.ok {
  background: var(--green);
}

.requisitos {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.requisito {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--text-muted);
}

.requisito.ok {
  color: var(--green);
}

.form-erro {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--red);
  background: var(--red-soft);
  border-radius: var(--radius-sm);
  padding: 9px 12px;
}

.senha-submit {
  justify-content: center;
}

.submit-aviso {
  margin: -6px 0 0;
  text-align: center;
  font-size: 11.5px;
  color: var(--text-muted);
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