<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AxiosError } from 'axios'
import { CheckCircle2, Clock, Eye, EyeOff, Laptop, Loader2, Lock, Mail, Wrench } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const form = reactive({ email: '', senha: '' })
const erro = ref('')
const carregando = ref(false)
const mostrarSenha = ref(false)
const capsAtivo = ref(false)
const emailInput = ref<HTMLInputElement | null>(null)
const senhaInput = ref<HTMLInputElement | null>(null)

/* Tremor do cartão quando o login falha: a classe precisa sair e voltar para
 * a animação recomeçar (trocá-la direto não reinicia o @keyframes). */
const tremerErro = ref(false)
let timerTremer: number | undefined

function sacudirErro() {
  window.clearTimeout(timerTremer)
  tremerErro.value = false
  requestAnimationFrame(() => {
    tremerErro.value = true
    timerTremer = window.setTimeout(() => (tremerErro.value = false), 500)
  })
}

/** `getModifierState('CapsLock')` só existe em eventos de teclado. */
function checarCaps(e: KeyboardEvent) {
  capsAtivo.value = e.getModifierState?.('CapsLock') ?? false
}

async function alternarSenha() {
  mostrarSenha.value = !mostrarSenha.value
  await nextTick()
  senhaInput.value?.focus()
}

async function submit() {
  erro.value = ''
  if (!form.email.trim() || !form.senha) {
    erro.value = 'Informe e-mail e senha.'
    sacudirErro()
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
    sacudirErro()
  } finally {
    carregando.value = false
  }
}

// Evita o primeiro "clique" do usuário cair num campo vazio.
onMounted(() => emailInput.value?.focus())
</script>

<template>
  <div class="login-page">
    <!-- Camada decorativa: blobs que derivam devagar + malha discreta. -->
    <div class="login-bg" aria-hidden="true">
      <span class="blob blob-gold" />
      <span class="blob blob-blue" />
      <span class="blob blob-cyan" />
      <span class="malha" />
    </div>

    <main class="login-shell">
      <!-- Coluna de apresentação (só em telas largas). -->
      <section class="login-hero">
        <div class="hero-marca">
          <img class="hero-logo" src="/logo-ure.png" alt="Brasão da URE Leste 3" />
          <div class="hero-marca-texto">
            <strong>PORTAL URE LESTE 3</strong>
            <span>Unidade Regional de Ensino</span>
          </div>
        </div>

        <h2 class="hero-titulo">
          Chamados e equipamentos<br />
          em um só lugar.
        </h2>

        <ul class="hero-lista">
          <li style="--i: 0">
            <Wrench :size="17" />
            <span>Chamados técnicos com acompanhamento por protocolo</span>
          </li>
          <li style="--i: 1">
            <Laptop :size="17" />
            <span>Inventário de equipamentos de todas as escolas</span>
          </li>
          <li style="--i: 2">
            <CheckCircle2 :size="17" />
            <span>Avaliação do atendimento pela própria escola</span>
          </li>
        </ul>
      </section>

      <!-- Coluna do formulário. -->
      <div class="login-col">
        <div class="login-card" :class="{ 'treme': tremerErro }">
          <!-- Marca compacta: só aparece quando a coluna hero some. -->
          <div class="card-marca">
            <img class="card-logo" src="/logo-ure.png" alt="Brasão da URE Leste 3" />
            <div>
              <strong>PORTAL URE LESTE 3</strong>
              <span>Chamados e Equipamentos em um só lugar</span>
            </div>
          </div>

          <form class="login-form" @submit.prevent="submit">
            <div class="field">
              <label for="email">E-mail</label>
              <div class="input-icon">
                <Mail :size="16" />
                <input
                  id="email"
                  ref="emailInput"
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
                  ref="senhaInput"
                  v-model="form.senha"
                  class="input input-senha"
                  :type="mostrarSenha ? 'text' : 'password'"
                  placeholder="••••••••"
                  autocomplete="current-password"
                  required
                  @keydown="checarCaps"
                  @keyup="checarCaps"
                  @blur="capsAtivo = false"
                />
                <button
                  type="button"
                  class="btn-olho"
                  :aria-label="mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'"
                  :aria-pressed="mostrarSenha"
                  :title="mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'"
                  @click="alternarSenha"
                >
                  <span class="olho-icone" :class="{ visivel: mostrarSenha }">
                    <EyeOff v-if="mostrarSenha" :size="16" />
                    <Eye v-else :size="16" />
                  </span>
                </button>
              </div>
              <Transition name="aviso">
                <p v-if="capsAtivo" class="login-caps">
                  <Clock :size="13" />
                  Caps Lock está ligado
                </p>
              </Transition>
            </div>

            <Transition name="erro">
              <p v-if="erro" class="login-error">{{ erro }}</p>
            </Transition>

            <button class="btn btn-gold login-submit" type="submit" :disabled="carregando">
              <span class="submit-conteudo">
                <Loader2 v-if="carregando" class="spin" :size="17" />
                {{ carregando ? 'Entrando...' : 'Entrar' }}
              </span>
            </button>
          </form>

          <footer class="login-footer">
            <em>Tecnologia a serviço da educação</em>
          </footer>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ============================================================
   Fundo: o gradiente base continua sendo o azul-marinho da marca,
   mas com três blobs coloridos derivando por baixo da malha.
   ============================================================ */

.login-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  overflow: hidden;
  background:
    radial-gradient(1200px 600px at 80% -10%, rgb(245 185 33 / 0.12), transparent 60%),
    linear-gradient(160deg, #081a33 0%, #0a2140 45%, #061429 100%);
}

.login-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  opacity: 0.5;
}

.blob-gold {
  width: 380px;
  height: 380px;
  top: -120px;
  right: -60px;
  background: rgb(245 185 33 / 0.3);
  animation: derivar-a 22s ease-in-out infinite alternate;
}

.blob-blue {
  width: 460px;
  height: 460px;
  bottom: -180px;
  left: -120px;
  background: rgb(37 99 235 / 0.32);
  animation: derivar-b 28s ease-in-out infinite alternate;
}

.blob-cyan {
  width: 300px;
  height: 300px;
  top: 45%;
  left: 55%;
  background: rgb(56 189 248 / 0.18);
  animation: derivar-c 34s ease-in-out infinite alternate;
}

/* Malha de 1px, quase invisível — dá textura sem competir com o conteúdo. */
.malha {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgb(255 255 255 / 0.028) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 255 255 / 0.028) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, #000 30%, transparent 75%);
}

@keyframes derivar-a {
  to {
    transform: translate3d(-70px, 90px, 0) scale(1.18);
  }
}

@keyframes derivar-b {
  to {
    transform: translate3d(90px, -70px, 0) scale(1.12);
  }
}

@keyframes derivar-c {
  to {
    transform: translate3d(-120px, -50px, 0) scale(0.85);
  }
}

/* ============================================================
   Layout em duas colunas
   ============================================================ */

.login-shell {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 980px;
  display: grid;
  grid-template-columns: 1fr 420px;
  align-items: center;
  gap: 56px;
}

/* ---------- Coluna hero ---------- */

.login-hero {
  color: #fff;
}

.hero-marca {
  display: flex;
  align-items: center;
  gap: 13px;
  margin-bottom: 34px;
  animation: entrar 0.5s ease both;
}

.hero-logo {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.18);
}

.hero-marca-texto {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.hero-marca-texto strong {
  font-size: 14.5px;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.hero-marca-texto span {
  font-size: 12px;
  color: rgb(255 255 255 / 0.6);
}

.hero-titulo {
  margin: 0 0 30px;
  font-size: 34px;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.015em;
  color: #fff;
  animation: entrar 0.5s 0.08s ease both;
}

.hero-lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.hero-lista li {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: rgb(255 255 255 / 0.82);
  animation: entrar 0.5s calc(0.16s + var(--i) * 0.09s) ease both;
}

.hero-lista svg {
  color: var(--brand-gold);
  flex-shrink: 0;
}

@keyframes entrar {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
}

/* ---------- Coluna do formulário ---------- */

.login-col {
  display: flex;
  justify-content: center;
}

.login-card {
  width: 100%;
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 34px 32px 22px;
  animation: entrar-card 0.55s ease both;
}

@keyframes entrar-card {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.97);
  }
}

.card-marca {
  display: none;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.card-logo {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  flex-shrink: 0;
}

.card-marca strong {
  display: block;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.03em;
}

.card-marca span {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 1px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---------- Campos ---------- */

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
  transition: color 0.15s ease;
}

.input-icon:focus-within > svg {
  color: var(--blue);
}

.input-icon .input {
  padding-left: 38px;
}

.input-senha {
  padding-right: 42px;
}

.input-senha:focus {
  padding-right: 42px;
}

/* Botão do olho: a troca de ícone gira e entrana em vez de piscar. */
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

.login-caps {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--yellow);
}

/* ---------- Mensagens ---------- */

.login-error {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--red);
  background: var(--red-soft);
  border-radius: var(--radius-sm);
  padding: 9px 12px;
}

/* Tremor curto: comunica a falha sem enjoar. */
.login-card.treme {
  animation: tremer 0.45s ease;
}

@keyframes tremer {
  10%,
  90% {
    transform: translateX(-2px);
  }
  20%,
  80% {
    transform: translateX(4px);
  }
  30%,
  50%,
  70% {
    transform: translateX(-7px);
  }
  40%,
  60% {
    transform: translateX(7px);
  }
}

.erro-enter-active,
.aviso-enter-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.erro-leave-active,
.aviso-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.erro-enter-from,
.erro-leave-to,
.aviso-enter-from,
.aviso-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ---------- Botão ---------- */

.login-submit {
  position: relative;
  justify-content: center;
  padding: 12px;
  font-size: 15px;
  overflow: hidden;
  box-shadow: 0 4px 14px rgb(245 185 33 / 0.28);
  transition:
    background 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.05s ease;
}

.login-submit:hover:not(:disabled) {
  box-shadow: 0 6px 20px rgb(245 185 33 / 0.42);
}

/* Brilho que atravessa o botão ao passar o mouse. */
.login-submit::after {
  content: '';
  position: absolute;
  top: 0;
  left: -60%;
  width: 45%;
  height: 100%;
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 0.45), transparent);
  transform: skewX(-18deg);
  transition: left 0.55s ease;
}

.login-submit:hover:not(:disabled)::after {
  left: 115%;
}

.submit-conteudo {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.login-footer {
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
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

/* ============================================================
   Responsivo
   ============================================================ */

@media (max-width: 979px) {
  .login-shell {
    max-width: 420px;
    grid-template-columns: 1fr;
  }

  .login-hero {
    display: none;
  }

  .card-marca {
    display: flex;
  }
}

@media (max-width: 480px) {
  .login-page {
    padding: 16px;
  }

  .login-card {
    padding: 26px 20px 18px;
  }

  .hero-titulo {
    font-size: 27px;
  }
}

/* Quem pede menos movimento não recebe nada dele. */
@media (prefers-reduced-motion: reduce) {
  .blob,
  .hero-marca,
  .hero-titulo,
  .hero-lista li,
  .login-card {
    animation: none !important;
  }

  .olho-icone,
  .erro-enter-active,
  .aviso-enter-active,
  .login-submit,
  .login-submit::after {
    transition: none !important;
  }

  .login-submit::after {
    display: none;
  }
}
</style>