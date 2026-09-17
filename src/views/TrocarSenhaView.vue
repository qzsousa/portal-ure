<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiError } from '@/utils/apiError'
import { KeyRound, Loader2 } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({ senhaAtual: '', novaSenha: '', confirmar: '' })
const erro = ref('')
const carregando = ref(false)

const primeiroAcesso = computed(() => auth.user?.primeiroLogin === true)

function validarForca(senha: string): string | null {
  if (senha.length < 8) return 'Mínimo de 8 caracteres.'
  if (!/[A-Z]/.test(senha)) return 'Inclua pelo menos uma letra maiúscula.'
  if (!/[a-z]/.test(senha)) return 'Inclua pelo menos uma letra minúscula.'
  if (!/[0-9]/.test(senha)) return 'Inclua pelo menos um número.'
  if (!/[^A-Za-z0-9]/.test(senha)) return 'Inclua pelo menos um caractere especial.'
  return null
}

async function submit() {
  erro.value = ''
  // O backend exige senhaAtual preenchida mesmo no primeiro acesso
  // (ela só é *conferida* quando não é primeiro login).
  if (!form.senhaAtual) {
    erro.value = primeiroAcesso.value
      ? 'Informe a senha temporária recebida.'
      : 'Informe sua senha atual.'
    return
  }
  const problema = validarForca(form.novaSenha)
  if (problema) {
    erro.value = problema
    return
  }
  if (form.novaSenha !== form.confirmar) {
    erro.value = 'A confirmação não confere com a nova senha.'
    return
  }
  carregando.value = true
  try {
    await auth.changePassword({ senhaAtual: form.senhaAtual, novaSenha: form.novaSenha })
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
      <h1>{{ primeiroAcesso ? 'Defina sua senha' : 'Trocar senha' }}</h1>
      <p class="hint">
        {{
          primeiroAcesso
            ? 'Este é seu primeiro acesso. Crie uma senha definitiva para continuar.'
            : 'Após trocar a senha, você precisará entrar novamente.'
        }}
      </p>

      <form class="senha-form" @submit.prevent="submit">
        <div class="field">
          <label for="atual">{{ primeiroAcesso ? 'Senha temporária recebida' : 'Senha atual' }}</label>
          <input
            id="atual"
            v-model="form.senhaAtual"
            class="input"
            type="password"
            autocomplete="current-password"
            required
          />
        </div>

        <div class="field">
          <label for="nova">Nova senha</label>
          <input
            id="nova"
            v-model="form.novaSenha"
            class="input"
            type="password"
            autocomplete="new-password"
            required
          />
          <small class="field-hint">Mín. 8 caracteres, com maiúscula, minúscula, número e símbolo.</small>
        </div>

        <div class="field">
          <label for="confirmar">Confirmar nova senha</label>
          <input
            id="confirmar"
            v-model="form.confirmar"
            class="input"
            type="password"
            autocomplete="new-password"
            required
          />
        </div>

        <p v-if="erro" class="form-erro">{{ erro }}</p>

        <button class="btn btn-gold senha-submit" type="submit" :disabled="carregando">
          <Loader2 v-if="carregando" class="spin" :size="16" />
          <KeyRound v-else :size="16" />
          Salvar nova senha
        </button>
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
  font-size: 11.5px;
  color: var(--text-muted);
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

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
