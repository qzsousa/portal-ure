<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AxiosError } from 'axios'
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Wrench,
} from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

/**
 * Etapas da tela de acesso.
 *
 * `email`  → confirma o endereço e pergunta ao backend se a pessoa está em
 *             primeiro acesso.
 * `codigo` → primeiro acesso: o código de 6 dígitos que a Matriz entregou.
 * `senha`  → login normal (e também a criação da senha, quando a pessoa
 *             prefere usar a senha temporária que a Matriz lhe entregou).
 */
const etapa = ref<'email' | 'codigo' | 'senha'>('email')

const form = reactive({ email: '', codigo: '', senha: '', novaSenha: '', confirmarSenha: '' })
const erro = ref('')
const carregando = ref(false)
const verificandoEmail = ref(false)
const mostrarSenha = ref(false)
const mostrarNovaSenha = ref(false)
const mostrarConfirmacao = ref(false)
const capsAtivo = ref(false)
const emailInput = ref<HTMLInputElement | null>(null)
const codigoInput = ref<HTMLInputElement | null>(null)
const senhaInput = ref<HTMLInputElement | null>(null)

/** Token de uso único que autoriza criar a senha (10 min). */
const tokenCriacaoSenha = ref('')
/** Verdadeiro quando a senha a ser criada é a primeira da conta. */
const criandoSenha = ref(false)

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

async function alternarSenha(alvo: 'atual' | 'nova' | 'confirmar') {
  if (alvo === 'atual') mostrarSenha.value = !mostrarSenha.value
  else if (alvo === 'nova') mostrarNovaSenha.value = !mostrarNovaSenha.value
  else mostrarConfirmacao.value = !mostrarConfirmacao.value

  await nextTick()
  if (alvo === 'atual') senhaInput.value?.focus()
}

function mensagemErro(e: unknown, padrao: string): string {
  const err = e as AxiosError<{ message?: string }>
  return err.response?.data?.message || padrao
}

async function focar(refEl: { value: HTMLInputElement | null }) {
  await nextTick()
  refEl.value?.focus()
}

/* ------------------------------------------------------------------
 * Etapa 1 — e-mail
 * ------------------------------------------------------------------ */

let timerDebounce: number | undefined

/**
 * A consulta ao backend falhou e ainda não sabemos se a pessoa está em
 * primeiro acesso.
 *
 * Antes isso era silêncio: a tela caía direto na etapa de senha e quem tem
 * código ficava sem campo para digitá-lo, sem nenhuma pista do motivo. O
 * fallback em si continua certo — travar a pessoa na tela de código quando a
 * rede cai seria pior. O que faltava era dizer o que está acontecendo e
 * oferecer a saída.
 */
const verificacaoFalhou = ref(false)

/**
 * Pergunta ao backend o que fazer com este e-mail, enquanto a pessoa digita.
 *
 * Debounce de 600 ms: chamar a cada tecla gastaria o rate limit da rota sem
 * ganho — ninguém digita um e-mail completo em menos de meio segundo.
 */
function agendarVerificacao() {
  window.clearTimeout(timerDebounce)
  const email = form.email.trim()
  if (!email || !email.includes('@')) {
    verificandoEmail.value = false
    return
  }

  timerDebounce = window.setTimeout(async () => {
    verificandoEmail.value = true
    const info = await auth.verificarEmail(email)
    verificandoEmail.value = false
    verificacaoFalhou.value = info === null
    // `null` = a consulta falhou (rede/rate limit). Não tranca ninguém: a
    // pessoa segue para a etapa de senha e tenta o login normal. Mas o aviso
    // abaixo deixa claro que a verificação não aconteceu.
    if (info?.primeiroAcesso) entrarModoPrimeiroAcesso()
  }, 600)
}

/**
 * Atalho para a etapa do código, para quando a verificação falhou mas a
 * pessoa tem um código em mãos.
 */
function tentarCodigoDireto() {
  verificacaoFalhou.value = false
  entrarModoPrimeiroAcesso()
}

/** Saiu do campo: cancela a consulta pendente (já não interessa o resultado). */
function cancelarVerificacao() {
  window.clearTimeout(timerDebounce)
}

/** Volta para a etapa de e-mail. */
function voltarParaEmail() {
  etapa.value = 'email'
  form.codigo = ''
  form.senha = ''
  form.novaSenha = ''
  form.confirmarSenha = ''
  tokenCriacaoSenha.value = ''
  criandoSenha.value = false
  verificacaoFalhou.value = false
  erro.value = ''
  void focar(emailInput)
}

/** Login normal, a partir da tela de e-mail. */
function irParaLogin() {
  etapa.value = 'senha'
  criandoSenha.value = false
  tokenCriacaoSenha.value = ''
  form.novaSenha = ''
  form.confirmarSenha = ''
  erro.value = ''
  void focar(senhaInput)
}

/** Primeiro acesso detectado: mostra a etapa do código. */
function entrarModoPrimeiroAcesso() {
  etapa.value = 'codigo'
  erro.value = ''
  void focar(codigoInput)
}

/** Volta para a etapa do código (trocar de código). */
function voltarParaCodigo() {
  etapa.value = 'codigo'
  criandoSenha.value = false
  tokenCriacaoSenha.value = ''
  form.novaSenha = ''
  form.confirmarSenha = ''
  erro.value = ''
  void focar(codigoInput)
}

/* ------------------------------------------------------------------
 * Etapa 2 — código (primeiro acesso)
 * ------------------------------------------------------------------ */

async function confirmarCodigoEnviado() {
  erro.value = ''
  if (!/^\d{6}$/.test(form.codigo.trim())) {
    erro.value = 'Digite os 6 dígitos do código.'
    return
  }
  carregando.value = true
  try {
    const res = await auth.confirmarCodigoPrimeiroAcesso(form.email, form.codigo)
    tokenCriacaoSenha.value = res.token
    etapa.value = 'senha'
    criandoSenha.value = true
  } catch (e) {
    erro.value = mensagemErro(e, 'Código inválido ou expirado. Peça um novo código à Matriz.')
    sacudirErro()
    form.codigo = ''
    void focar(codigoInput)
  } finally {
    carregando.value = false
  }
}

/** Só dígitos: copiar e colar um código com espaço ou traço não deve falhar. */
function somenteDigitos(e: Event) {
  const alvo = e.target as HTMLInputElement
  form.codigo = alvo.value.replace(/\D/g, '').slice(0, 6)
}

/* ------------------------------------------------------------------
 * Etapa 3 — senha (login) ou criação de senha (primeiro acesso)
 * ------------------------------------------------------------------ */

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
  carregando.value = true
  try {
    if (criandoSenha.value) {
      if (form.novaSenha !== form.confirmarSenha) {
        erro.value = 'A confirmação não confere com a nova senha.'
        sacudirErro()
        return
      }
      const problema = validarForca(form.novaSenha)
      if (problema) {
        erro.value = problema
        sacudirErro()
        return
      }

      await auth.criarSenhaPrimeiroAcesso({
        token: tokenCriacaoSenha.value,
        novaSenha: form.novaSenha,
        confirmarSenha: form.confirmarSenha,
      })
      // A senha acabou de ser criada e a sessão já vem pronta: vai direto ao
      // destino que a pessoa tentava alcançar.
      const destino = (route.query.redirect as string) || '/painel'
      router.push(destino)
      return
    }

    if (!form.senha) {
      erro.value = 'Informe sua senha.'
      sacudirErro()
      return
    }

    const res = await auth.login({ email: form.email.trim().toLowerCase(), senha: form.senha })
    if (res.primeiroLogin) {
      // Entrou com a senha temporária da Matriz: a troca é obrigatória.
      router.push({ name: 'trocar-senha' })
      return
    }
    const redirect = (route.query.redirect as string) || '/painel'
    router.push(redirect)
  } catch (e) {
    erro.value = mensagemErro(e, 'Não foi possível entrar. Tente novamente.')
    sacudirErro()
    form.senha = ''
  } finally {
    carregando.value = false
  }
}

// Evita o primeiro "clique" do usuário cair num campo vazio.
onMounted(() => {
  void focar(emailInput)
  // Recarga com ?email=... (link de convite/primeiro acesso) já pula para a
  // verificação sem a pessoa redigitar o endereço.
  const emailDaUrl = (route.query.email as string) || ''
  if (emailDaUrl.includes('@')) {
    form.email = emailDaUrl.trim().toLowerCase()
    entrarModoPrimeiroAcesso()
  }
})

onBeforeUnmount(() => {
  window.clearTimeout(timerDebounce)
  window.clearTimeout(timerTremer)
})
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
        <div class="login-card" :class="{ treme: tremerErro }">
          <!-- Marca compacta: só aparece quando a coluna hero some. -->
          <div class="card-marca">
            <img class="card-logo" src="/logo-ure.png" alt="Brasão da URE Leste 3" />
            <div>
              <strong>PORTAL URE LESTE 3</strong>
              <span>Chamados e Equipamentos em um só lugar</span>
            </div>
          </div>

          <!-- Cabeçalho: o título muda com a etapa. -->
          <header class="login-head">
            <h1>
              <template v-if="etapa === 'codigo'">Primeiro acesso</template>
              <template v-else-if="etapa === 'senha' && criandoSenha">Criar sua senha</template>
              <template v-else>Entrar</template>
            </h1>
            <p>
              <template v-if="etapa === 'email'">Use seu e-mail institucional e senha.</template>
              <template v-else-if="etapa === 'codigo'">
                Digite o código de 6 dígitos que a <strong>Matriz</strong> entregou para
                <strong>{{ form.email }}</strong>.
              </template>
              <template v-else-if="criandoSenha">Escolha uma senha para acessar o portal.</template>
              <template v-else>Digite sua senha para continuar.</template>
            </p>
          </header>

          <!-- Trilha do primeiro acesso: só nas etapas desse fluxo. No login normal
               (etapa de senha sem `criandoSenha`) não aparece — lá não há
               "criar senha" para acompanhar. -->
          <ol
            v-if="etapa === 'codigo' || (etapa === 'senha' && criandoSenha)"
            class="trilha"
            aria-label="Etapas do primeiro acesso"
          >
            <li :class="{ ativo: etapa === 'codigo', feito: etapa === 'senha' && criandoSenha }">
              <span class="trilha-num">
                <CheckCircle2 v-if="etapa === 'senha' && criandoSenha" :size="13" />
                <template v-else>1</template>
              </span>
              Verificar e-mail
            </li>
            <span class="trilha-linha" />
            <li :class="{ ativo: etapa === 'senha' && criandoSenha }">
              <span class="trilha-num">2</span>
              Criar senha
            </li>
          </ol>

          <!-- ============================================================
               Etapa 1 — e-mail
               ============================================================ -->
          <form v-if="etapa === 'email'" class="login-form" @submit.prevent="irParaLogin">
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
                  @input="agendarVerificacao"
                  @blur="cancelarVerificacao"
                />
                <span v-if="verificandoEmail" class="input-status">
                  <Loader2 class="spin" :size="15" />
                </span>
              </div>
              <small class="field-hint">
                Se for seu primeiro acesso, a Matriz precisa ter gerado um código para você.
              </small>
            </div>

            <!-- A consulta ao backend não respondeu. Sem este aviso a pessoa
                 caía direto na tela de senha e quem tem código ficava sem
                 campo para digitá-lo, sem explicação. O atalho abaixo
                 resolve: o código é válido mesmo sem a verificação. -->
            <div v-if="verificacaoFalhou" class="login-aviso-verificacao" role="status">
              <AlertTriangle :size="16" />
              <div>
                <strong>Não conseguimos verificar seu acesso agora.</strong>
                <span>
                  Se a Matriz já passou um código para você, use-o mesmo assim —
                  o código funciona sem esta verificação.
                </span>
                <button type="button" class="link-btn" @click="tentarCodigoDireto">
                  Já tenho um código
                </button>
              </div>
            </div>

            <button class="btn btn-gold login-submit" type="submit" :disabled="!form.email.includes('@')">
              <span class="submit-conteudo">
                Continuar
                <ArrowLeft :size="16" class="seta-continuar" />
              </span>
            </button>
          </form>

          <!-- ============================================================
               Etapa 2 — código do e-mail
               ============================================================ -->
          <form v-else-if="etapa === 'codigo'" class="login-form" @submit.prevent="confirmarCodigoEnviado">
            <div class="field">
              <label for="codigo">Código de primeiro acesso</label>
              <div class="input-icon">
                <ShieldCheck :size="16" />
                <input
                  id="codigo"
                  ref="codigoInput"
                  v-model="form.codigo"
                  class="input input-codigo"
                  type="text"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  placeholder="000000"
                  maxlength="6"
                  required
                  @input="somenteDigitos"
                />
              </div>
              <small class="field-hint">
                O código vale por 24 horas e só pode ser usado uma vez. Se tiver expirado,
                peça outro à Matriz.
              </small>
            </div>

            <Transition name="erro">
              <p v-if="erro" class="login-error">{{ erro }}</p>
            </Transition>

            <button class="btn btn-gold login-submit" type="submit" :disabled="carregando || form.codigo.length < 6">
              <span class="submit-conteudo">
                <Loader2 v-if="carregando" class="spin" :size="17" />
                <KeyRound v-else :size="16" />
                {{ carregando ? 'Verificando...' : 'Confirmar código' }}
              </span>
            </button>

            <div class="login-rodape">
              <button type="button" class="link-btn" :disabled="carregando" @click="voltarParaEmail">
                <ArrowLeft :size="13" />
                Usar outro e-mail
              </button>
            </div>

            <!-- Quem já tem senha (a Matriz também gera código para quem já
                 entrou antes): vai direto para o login normal. -->
            <button type="button" class="alternativa" :disabled="carregando" @click="irParaLogin">
              Já tenho senha — entrar
            </button>
          </form>

          <!-- ============================================================
               Etapa 3 — senha (login) ou criação de senha
               ============================================================ -->
          <form v-else class="login-form" @submit.prevent="submit">
            <!-- Login normal -->
            <template v-if="!criandoSenha">
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
                    @click="alternarSenha('atual')"
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
            </template>

            <!-- Primeiro acesso: senha nova + confirmação -->
            <template v-else>
              <div class="field">
                <label for="nova">Nova senha</label>
                <div class="input-icon">
                  <Lock :size="16" />
                  <input
                    id="nova"
                    v-model="form.novaSenha"
                    class="input input-senha"
                    :type="mostrarNovaSenha ? 'text' : 'password'"
                    placeholder="••••••••"
                    autocomplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    class="btn-olho"
                    :aria-label="mostrarNovaSenha ? 'Ocultar senha' : 'Mostrar senha'"
                    @click="alternarSenha('nova')"
                  >
                    <span class="olho-icone" :class="{ visivel: mostrarNovaSenha }">
                      <EyeOff v-if="mostrarNovaSenha" :size="16" />
                      <Eye v-else :size="16" />
                    </span>
                  </button>
                </div>
                <small class="field-hint">Mín. 8 caracteres, com maiúscula, minúscula, número e símbolo.</small>
              </div>

              <div class="field">
                <label for="confirmar">Confirmar nova senha</label>
                <div class="input-icon">
                  <Lock :size="16" />
                  <input
                    id="confirmar"
                    v-model="form.confirmarSenha"
                    class="input input-senha"
                    :type="mostrarConfirmacao ? 'text' : 'password'"
                    placeholder="••••••••"
                    autocomplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    class="btn-olho"
                    :aria-label="mostrarConfirmacao ? 'Ocultar senha' : 'Mostrar senha'"
                    @click="alternarSenha('confirmar')"
                  >
                    <span class="olho-icone" :class="{ visivel: mostrarConfirmacao }">
                      <EyeOff v-if="mostrarConfirmacao" :size="16" />
                      <Eye v-else :size="16" />
                    </span>
                  </button>
                </div>
              </div>
            </template>

            <Transition name="erro">
              <p v-if="erro" class="login-error">{{ erro }}</p>
            </Transition>

            <button class="btn btn-gold login-submit" type="submit" :disabled="carregando">
              <span class="submit-conteudo">
                <Loader2 v-if="carregando" class="spin" :size="17" />
                <template v-if="criandoSenha">
                  <KeyRound v-if="!carregando" :size="16" />
                  {{ carregando ? 'Criando senha...' : 'Criar senha e entrar' }}
                </template>
                <template v-else>
                  {{ carregando ? 'Entrando...' : 'Entrar' }}
                </template>
              </span>
            </button>

            <div class="login-rodape">
              <button v-if="criandoSenha" type="button" class="link-btn" @click="voltarParaCodigo">
                <ArrowLeft :size="13" />
                Voltar para o código
              </button>
              <button v-else type="button" class="link-btn" @click="voltarParaEmail">
                <ArrowLeft :size="13" />
                Usar outro e-mail
              </button>
            </div>
          </form>

          <footer v-if="etapa !== 'codigo'" class="login-footer">
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

/* ---------- Cabeçalho da etapa ---------- */

.login-head {
  margin-bottom: 20px;
}

.login-head h1 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 5px;
  font-size: 21px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.login-head p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.login-head strong {
  font-weight: 600;
  color: var(--text-primary);
  word-break: break-all;
}

/* ---------- Trilha do primeiro acesso ---------- */

.trilha {
  display: flex;
  align-items: center;
  gap: 8px;
  list-style: none;
  margin: 0 0 22px;
  padding: 0;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-muted);
}

.trilha li {
  display: flex;
  align-items: center;
  gap: 6px;
  transition: color 0.2s ease;
}

.trilha li.ativo {
  color: var(--blue);
}

.trilha li.feito {
  color: var(--green);
}

.trilha-num {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid currentColor;
  font-size: 10.5px;
  font-weight: 700;
  flex-shrink: 0;
}

.trilha-linha {
  flex: 1;
  height: 1px;
  background: var(--border);
}

/* ---------- Formulário ---------- */

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

/* Código: centralizado e espaçado — parece o campo de um app de banco. */
.input-codigo {
  font-family: 'Courier New', ui-monospace, monospace;
  font-size: 21px;
  font-weight: 700;
  letter-spacing: 0.4em;
  text-align: center;
  padding-left: 42px;
}

.input-status {
  position: absolute;
  right: 12px;
  display: grid;
  place-items: center;
  color: var(--text-muted);
}

.input-senha {
  padding-right: 42px;
}

.input-senha:focus {
  padding-right: 42px;
}

.field-hint {
  margin: 6px 0 0;
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--text-muted);
}

/* Falha na verificação de primeiro acesso.
   Atenção, não erro: nada deu errado com a pessoa, a consulta é que não
   respondeu. Por isso o tom é o mesmo do aviso de campo e não o vermelho do
   login-error — alarmar aqui serialie para quem só está com a internet lenta. */
.login-aviso-verificacao {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-top: 12px;
  padding: 11px 13px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--brand-gold) 45%, transparent);
  background: color-mix(in srgb, var(--brand-gold-soft) 60%, transparent);
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-muted);
  text-align: left;
}

.login-aviso-verificacao strong {
  display: block;
  color: var(--text);
  margin-bottom: 2px;
}

.login-aviso-verificacao .link-btn {
  margin-top: 6px;
  font-size: 12.5px;
}

/* Botão do olho: a troca de ícone gira e entra em vez de piscar. */
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

.login-submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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

/* A seta do "Continuar" aponta para a direita (a leitura é LTR). */
.seta-continuar {
  transform: scaleX(-1);
}

/* ---------- Ações secundárias ---------- */

.login-rodape {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin-top: -4px;
}

.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
  transition: color 0.15s ease;
}

.link-btn:hover:not(:disabled) {
  color: var(--blue);
}

.link-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Válvula de escape do primeiro acesso — discreta, mas clicável. */
.alternativa {
  margin: -6px 0 0;
  padding: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  text-align: center;
  text-decoration: underline;
  text-underline-offset: 3px;
  border-radius: var(--radius-sm);
  transition: color 0.15s ease;
}

.alternativa:hover:not(:disabled) {
  color: var(--text-secondary);
}

.alternativa:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

  .input-codigo {
    font-size: 19px;
    letter-spacing: 0.3em;
  }

  .login-rodape {
    flex-direction: column;
    gap: 8px;
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