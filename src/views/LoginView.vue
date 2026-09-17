<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AxiosError } from 'axios'
import { BookOpen, Loader2, Lock, Mail } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const form = reactive({ email: '', senha: '' })
const erro = ref('')
const carregando = ref(false)

async function submit() {
  erro.value = ''
  if (!form.email.trim() || !form.senha) {
    erro.value = 'Informe e-mail e senha.'
    return
  }
  carregando.value = true
  try {
    const res = await auth.login({ email: form.email.trim().toLowerCase(), senha: form.senha })
    if (res.primeiroLogin) {
      router.push({ name: 'trocar-senha' })
      return
    }
    const redirect = (route.query.redirect as string) || '/painel'
    router.push(redirect)
  } catch (e) {
    const err = e as AxiosError<{ message?: string }>
    erro.value = err.response?.data?.message || 'Não foi possível entrar. Tente novamente.'
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-brand">
        <div class="brand-icon">
          <BookOpen :size="30" :stroke-width="1.8" />
        </div>
        <h1>PORTAL URE LESTE 3</h1>
        <p>Chamados e Equipamentos em um só lugar</p>
      </div>

      <form class="login-form" @submit.prevent="submit">
        <div class="field">
          <label for="email">E-mail</label>
          <div class="input-icon">
            <Mail :size="16" />
            <input
              id="email"
              v-model="form.email"
              class="input"
              type="email"
              placeholder="seu.email@educacao.sp.gov.br"
              autocomplete="username"
              required
            />
          </div>
        </div>

        <div class="field">
          <label for="senha">Senha</label>
          <div class="input-icon">
            <Lock :size="16" />
            <input
              id="senha"
              v-model="form.senha"
              class="input"
              type="password"
              placeholder="••••••••"
              autocomplete="current-password"
              required
            />
          </div>
        </div>

        <p v-if="erro" class="login-error">{{ erro }}</p>

        <button class="btn btn-gold login-submit" type="submit" :disabled="carregando">
          <Loader2 v-if="carregando" class="spin" :size="17" />
          {{ carregando ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>

      <footer class="login-footer">
        <em>Tecnologia a serviço da educação</em>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(1200px 600px at 80% -10%, rgb(245 185 33 / 0.12), transparent 60%),
    linear-gradient(160deg, #081a33 0%, #0a2140 45%, #061429 100%);
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 36px 32px 24px;
}

.login-brand {
  text-align: center;
  margin-bottom: 26px;
}

.brand-icon {
  width: 60px;
  height: 60px;
  margin: 0 auto 14px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: var(--sidebar-bg);
  color: var(--brand-gold);
}

.login-brand h1 {
  font-size: 19px;
  letter-spacing: 0.03em;
}

.login-brand p {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text-muted);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-icon {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon > svg {
  position: absolute;
  left: 12px;
  color: var(--text-muted);
  pointer-events: none;
}

.input-icon .input {
  padding-left: 38px;
}

.login-error {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--red);
  background: var(--red-soft);
  border-radius: var(--radius-sm);
  padding: 9px 12px;
}

.login-submit {
  justify-content: center;
  padding: 12px;
  font-size: 15px;
}

.login-footer {
  margin-top: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

.login-footer em {
  font-family: Georgia, 'Times New Roman', serif;
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
