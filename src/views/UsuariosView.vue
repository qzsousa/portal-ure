<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { apiError } from '@/utils/apiError'
import { KeyRound, Pencil, Plus, Search, UserPlus, UserX, X } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import RowActions from '@/components/ui/RowActions.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import {
  atualizarUsuario,
  criarUsuario,
  desativarUsuario,
  gerarCodigoPrimeiroAcesso,
  listarEscolas,
  listarUsuarios,
} from '@/api/usuarios'
import { getFormularioPublico, type FormularioCategoria } from '@/api/publico'
import { montarEscopo, rotuloPerfil, type Nivel, type User } from '@/types'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'

const ui = useUiStore()
const auth = useAuthStore()

const isAdmin = computed(() => auth.user?.nivel === 'ADMIN')
const isGestor = computed(() => auth.user?.nivel === 'GESTOR')

/** Perfis disponíveis no cadastro (Gestor só pode criar Visualizador). */
const perfisDisponiveis = computed(() =>
  isAdmin.value
    ? [
        { valor: 'ADMIN' as const, rotulo: 'Administrador' },
        { valor: 'TECNICO' as const, rotulo: 'Técnico' },
        { valor: 'GESTOR' as const, rotulo: 'Gestor' },
        { valor: 'VISUALIZADOR' as const, rotulo: 'Visualizador' },
      ]
    : [{ valor: 'VISUALIZADOR' as const, rotulo: 'Visualizador' }],
)

/** O Gestor pode mexer apenas em Visualizadores; o Admin, em todos. */
function podeEditarAlvo(u: User): boolean {
  if (isAdmin.value) return true
  return u.nivel === 'VISUALIZADOR'
}

const estado = reactive({ loading: true, erro: '', items: [] as User[], total: 0, page: 1 })
const PAGE_SIZE = 10
const filtros = reactive({ search: '', status: '', nivel: '' as Nivel | '', filial: '' })

const escolas = ref<string[]>([])

/** Todos os perfis — é filtro de leitura, serve qualquer um que exista na lista. */
const PERFIS_FILTRO: Array<{ valor: Nivel; rotulo: string }> = [
  { valor: 'ADMIN', rotulo: 'Administrador' },
  { valor: 'TECNICO', rotulo: 'Técnico' },
  { valor: 'GESTOR', rotulo: 'Gestor' },
  { valor: 'VISUALIZADOR', rotulo: 'Visualizador' },
]

/** Só o Admin filtra por unidade: o Gestor já vê apenas a própria escola. */
const podeFiltrarUnidade = computed(() => isAdmin.value)

/**
 * Cota do Gestor: ele + **2** usuários = 3 usuários ATIVOS na unidade.
 * Espelha `MAX_GESTORES_UNIDADE` do backend (`chamados/backend/src/routes/usuarios.ts`),
 * que recusa o `POST /usuarios` com 400 quando a unidade já tem 3 ativos.
 *
 * A contagem é de **usuários**, não de visualizadores: o backend conta todo
 * `status: 'ATIVO'` da filial, então um Técnico já cadastrado na escola também
 * ocupa uma das vagas — e o texto do erro do servidor diz "usuários" por isso.
 */
const LIMITE_USUARIOS_UNIDADE = 2

/**
 * Total de usuários ATIVOS da unidade, contado pelo próprio backend
 * (`GET /usuarios?status=ATIVO`). `null` = ainda não sabemos (primeiro load ou
 * falhou): nesse caso a tela **não** trava — quem julga é o servidor, e uma
 * leitura que falhou não pode trancar o cadastro de uma escola.
 */
const ativosDaUnidade = ref<number | null>(null)

/** Vagas já ocupadas — a contagem inclui o próprio Gestor, que não é vaga. */
const vagasUsadas = computed(() =>
  ativosDaUnidade.value === null ? null : Math.max(0, ativosDaUnidade.value - 1),
)

/** Só o Gestor tem cota; o Admin cadastra quem quiser. */
const limiteAtingido = computed(
  () =>
    isGestor.value &&
    vagasUsadas.value !== null &&
    vagasUsadas.value >= LIMITE_USUARIOS_UNIDADE,
)

const temFiltroAtivo = computed(
  () => !!(filtros.search || filtros.status || filtros.nivel || filtros.filial),
)

async function carregar() {
  estado.loading = true
  try {
    const res = await listarUsuarios({ ...filtros, page: estado.page, limit: PAGE_SIZE })
    estado.items = res.data
    estado.total = res.meta.total
  } catch {
    estado.erro = 'Não foi possível carregar os usuários.'
  } finally {
    estado.loading = false
  }
}

function aplicarFiltros() {
  estado.page = 1
  void carregar()
}

/**
 * Conta os usuários ativos da unidade para a trava de cota.
 * Só o Gestor precisa: `limit: 1` já devolve o total exato em `meta.total`,
 * então não pesa na listagem nem na paginação da tabela.
 */
async function carregarVagas() {
  if (!isGestor.value) {
    ativosDaUnidade.value = null
    return
  }
  try {
    const res = await listarUsuarios({ status: 'ATIVO', page: 1, limit: 1 })
    ativosDaUnidade.value = res.meta.total
  } catch {
    ativosDaUnidade.value = null
  }
}

function limparFiltros() {
  filtros.search = ''
  filtros.status = ''
  filtros.nivel = ''
  filtros.filial = ''
  aplicarFiltros()
}

/* ---------- Escopo de tipos de chamado ---------- */

/**
 * Uma caixa por TIPO de chamado, agrupada por categoria.
 *
 * O tipo de um chamado é `<Categoria> - <1ª resposta>` (ver `tipoFinal()` no
 * formulário público), então os tipos que o usuário pode receber são as OPÇÕES
 * da PRIMEIRA pergunta de cada categoria. Se a 1ª pergunta não for de opções
 * (o "E-mail institucional" começa pelo CIE da escola), não há tipo a
 * listar — a categoria inteira entra como uma única caixa.
 */
interface GrupoTipos {
  chave: string
  nome: string
  /** Rótulo da 1ª opção; vazio = a categoria inteira. */
  tipos: { rotulo: string; valor: string }[]
}

const categoriasFormulario = ref<FormularioCategoria[]>([])

const gruposTipos = computed<GrupoTipos[]>(() =>
  categoriasFormulario.value.map((cat) => {
    const primeiraOpcoes = (cat.perguntas ?? [])
      .filter((p) => p.tipo === 'OPCOES' && p.ativa)
      .sort((a, b) => a.ordem - b.ordem)[0]
    const rotulos = (primeiraOpcoes?.opcoes ?? []).map((o) => o.rotulo).filter(Boolean)
    return {
      chave: cat.chave,
      nome: cat.nome,
      tipos: rotulos.length
        ? rotulos.map((rotulo) => ({ rotulo, valor: montarEscopo(cat.chave, rotulo) }))
        : // Categoria sem tipos: marcar a categoria é o que existe.
          [{ rotulo: `Todos os chamados de ${cat.nome}`, valor: montarEscopo(cat.chave, '') }],
    }
  }),
)

/** Tipos marcados no formulário (o que vai no `escopoTipos`). */
const escopoMarcado = ref<string[]>([])

/** O escopo só existe para quem ATENDE chamado: Gestor e Visualizador não. */
const podeDefinirEscopo = computed(
  () => isAdmin.value && (form.nivel === 'TECNICO' || form.nivel === 'ADMIN'),
)

const escopoAtivo = computed(() => escopoMarcado.value.length > 0)

function alternarTipo(valor: string) {
  escopoMarcado.value = escopoMarcado.value.includes(valor)
    ? escopoMarcado.value.filter((v) => v !== valor)
    : [...escopoMarcado.value, valor]
}

const tiposPorCategoria = computed(() =>
  Object.fromEntries(gruposTipos.value.map((g) => [g.chave, g.tipos.filter((t) => escopoMarcado.value.includes(t.valor)).length])),
)

/* ---------- Criar / Editar ---------- */

const modalAberto = ref(false)
const editando = ref<User | null>(null)
const salvando = ref(false)
const form = reactive({ nome: '', email: '', nivel: 'GESTOR' as Nivel, filial: '', status: 'ATIVO' as 'ATIVO' | 'INATIVO' })

/**
 * Unidades do técnico: uma linha por select (o técnico atende N unidades).
 * O backend guarda a lista em um único texto separado por vírgula
 * (mesmo formato lido pelo SCE em `sessaoTemAcessoAUnidade`).
 */
const unidades = ref<string[]>([''])

/** Unidades escolhidas (sem linhas em branco). */
const unidadesPreenchidas = computed(() =>
  unidades.value.map((u) => u.trim()).filter((u) => u.length > 0),
)

/** Opções de um select: mostra a já escolhida na própria linha e esconde as de outras. */
function opcoesUnidade(indice: number): string[] {
  const outras = unidades.value.filter((_, i) => i !== indice).map((u) => u.trim())
  return escolas.value.filter((e) => e === unidades.value[indice] || !outras.includes(e))
}

/** Ainda há escola livre para uma nova linha? */
const temUnidadeDisponivel = computed(
  () => escolas.value.some((e) => !unidadesPreenchidas.value.includes(e)),
)

function adicionarUnidade() {
  unidades.value.push('')
}

function removerUnidade(indice: number) {
  if (unidades.value.length <= 1) return
  unidades.value.splice(indice, 1)
}

/** Valor enviado ao backend: técnico → lista de unidades; outros → filial única. */
function filialDoFormulario(): string {
  if (form.nivel === 'ADMIN') return 'URE Leste 3'
  if (form.nivel === 'TECNICO') return unidadesPreenchidas.value.join(', ')
  return form.filial
}

/** Campo de unidade é obrigatório para todo perfil, exceto ADMIN. */
const unidadePreenchida = computed(() => {
  if (form.nivel === 'ADMIN') return true
  if (form.nivel === 'TECNICO') return unidadesPreenchidas.value.length > 0
  return !!form.filial
})

/**
 * Código de primeiro acesso exibido ao ADMIN para repassar.
 *
 * Não é senha: é o que autoriza a pessoa a criar a senha dela. Por isso o
 * modal diz "compartilhe o código" e não "anote a senha" — a senha nunca
 * existe até a pessoa escolher.
 */
const codigoModal = ref<{ email: string; codigo: string } | null>(null)

function abrirCriar() {
  editando.value = null
  form.nome = ''
  form.email = ''
  form.nivel = isGestor.value ? 'VISUALIZADOR' : 'GESTOR'
  form.filial = isGestor.value ? auth.user?.filial || '' : ''
  form.status = 'ATIVO'
  unidades.value = ['']
  escopoMarcado.value = []
  modalAberto.value = true
}

function abrirEditar(u: User) {
  editando.value = u
  form.nome = u.nome
  form.email = u.email
  form.nivel = u.nivel
  form.filial = u.filial
  form.status = u.status === 'ATIVO' ? 'ATIVO' : 'INATIVO'
  unidades.value = u.nivel === 'TECNICO' ? separarUnidades(u.filial) : ['']
  escopoMarcado.value = [...(u.escopoTipos ?? [])]
  modalAberto.value = true
}

/** Trocar o perfil tem que limpar o escopo: só Técnico/Admin o aceita. */
watch(
  () => form.nivel,
  () => {
    if (!podeDefinirEscopo.value) escopoMarcado.value = []
  },
)

/** Divide o texto de `filial` em unidades ("A, B" → ["A", "B"]). */
function separarUnidades(filial: string): string[] {
  const lista = filial.split(',').map((u) => u.trim()).filter(Boolean)
  return lista.length ? lista : ['']
}

async function salvar() {
  salvando.value = true
  try {
    // `undefined` no PATCH = não mexer no escopo; aqui sempre mandamos, porque
    // o checkbox "sem restrição" é um estado legítimo que precisa ser gravado
    // como lista vazia. No POST a lista vazia é o default de qualquer forma.
    const escopo = podeDefinirEscopo.value ? escopoMarcado.value : undefined
    if (editando.value) {
      await atualizarUsuario(editando.value.id, {
        nome: form.nome,
        nivel: form.nivel,
        filial: filialDoFormulario(),
        status: form.status,
        ...(escopo ? { escopoTipos: escopo } : {}),
      })
      ui.success('Usuário atualizado.')
      modalAberto.value = false
    } else {
      const criado = await criarUsuario({
        email: form.email.trim().toLowerCase(),
        nome: form.nome.trim(),
        nivel: form.nivel,
        filial: filialDoFormulario(),
        ...(escopo ? { escopoTipos: escopo } : {}),
      })
      modalAberto.value = false
      codigoModal.value = { email: criado.email, codigo: criado.codigoPrimeiroAcesso }
    }
    await carregar()
    await carregarVagas()
  } catch (e) {
    ui.error(apiError(e, 'Falha ao salvar usuário.'))
  } finally {
    salvando.value = false
  }
}

/**
 * Gera um novo código para quem ainda não criou senha.
 *
 * Só faz sentido no primeiro acesso: se a pessoa já tem senha definitiva, o
 * backend recusa — trocar a senha dela é outro caminho (ela mesma, em
 * "Trocar senha").
 */
async function novoCodigoPrimeiroAcesso(u: User) {
  try {
    const resultado = await gerarCodigoPrimeiroAcesso(u.email)
    codigoModal.value = { email: u.email, codigo: resultado.codigo }
  } catch (e) {
    ui.error(apiError(e, 'Não foi possível gerar o código de acesso.'))
  }
}

async function desativar(u: User) {
  if (!window.confirm(`Desativar ${u.nome} (${u.email})?`)) return
  try {
    await desativarUsuario(u.id)
    ui.success('Usuário desativado.')
    await carregar()
    await carregarVagas() // desativar libera a vaga na cota da unidade
  } catch {
    ui.error('Não foi possível desativar o usuário.')
  }
}

/** Copia o código de primeiro acesso (não é senha — quem define a senha é a pessoa). */
function copiarCodigo(codigo: string) {
  void navigator.clipboard.writeText(codigo)
  ui.success('Código copiado.')
}

onMounted(async () => {
  void carregar()
  void carregarVagas()
  try {
    escolas.value = await listarEscolas()
  } catch {
    escolas.value = []
  }
  // Rota PÚBLICA do backend de chamados: as checkboxes de tipo não podem
  // depender de autenticação nem travar o cadastro se falhar — o usuário ainda
  // consegue criar a conta, só sem restrição.
  try {
    categoriasFormulario.value = await getFormularioPublico()
  } catch {
    categoriasFormulario.value = []
  }
})
</script>

<template>
  <div class="usuarios-page">
    <!-- Cota do Gestor: o servidor recusa o 3º usuário, a tela avisa antes -->
    <p v-if="isGestor" class="cota card" :class="{ 'cota-cheia': limiteAtingido }">
      <template v-if="limiteAtingido">
        <strong>Limite de {{ LIMITE_USUARIOS_UNIDADE }} usuários por unidade atingido.</strong>
        Desative um usuário da lista para liberar uma vaga.
      </template>
      <template v-else-if="vagasUsadas !== null">
        Sua unidade pode ter até
        <strong>{{ LIMITE_USUARIOS_UNIDADE }} usuários</strong> além de você.
        Em uso: <strong>{{ vagasUsadas }} de {{ LIMITE_USUARIOS_UNIDADE }}</strong>.
      </template>
      <template v-else>
        <strong>Não foi possível contar os usuários da unidade.</strong>
        O cadastro continua liberado — o servidor valida no envio.
      </template>
    </p>

    <!-- Toolbar -->
    <div class="toolbar card">
      <div class="search-box">
        <Search :size="16" />
        <input
          v-model="filtros.search"
          placeholder="Buscar por nome ou e-mail..."
          @keyup.enter="aplicarFiltros"
        />
      </div>
      <select v-model="filtros.nivel" class="select-input slim" @change="aplicarFiltros">
        <option value="">Perfil: Todos</option>
        <option v-for="p in PERFIS_FILTRO" :key="p.valor" :value="p.valor">{{ p.rotulo }}</option>
      </select>

      <select
        v-if="podeFiltrarUnidade"
        v-model="filtros.filial"
        class="select-input slim unidade-select"
        @change="aplicarFiltros"
      >
        <option value="">Unidade: Todas</option>
        <option v-for="e in escolas" :key="e" :value="e">{{ e }}</option>
      </select>

      <select v-model="filtros.status" class="select-input slim" @change="aplicarFiltros">
        <option value="">Status: Todos</option>
        <option value="ATIVO">Ativo</option>
        <option value="INATIVO">Inativo</option>
      </select>

      <button
        v-if="temFiltroAtivo"
        class="btn btn-outline btn-limpar"
        type="button"
        title="Limpar filtros"
        @click="limparFiltros"
      >
        <X :size="15" />
        Limpar
      </button>

      <button
        class="btn btn-primary btn-novo"
        type="button"
        :disabled="limiteAtingido"
        :title="
          limiteAtingido ? `Limite de ${LIMITE_USUARIOS_UNIDADE} usuários por unidade atingido` : ''
        "
        @click="abrirCriar"
      >
        <UserPlus :size="16" />
        Novo usuário
      </button>
    </div>

    <p v-if="estado.erro" class="erro card">{{ estado.erro }}</p>

    <!-- Tabela -->
    <div class="card table-card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Perfil</th>
              <th>Unidade</th>
              <th>Status</th>
              <th class="th-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="estado.loading">
              <td colspan="6" class="td-center">Carregando...</td>
            </tr>
            <tr v-else-if="estado.items.length === 0">
              <td colspan="6" class="td-center">Nenhum usuário encontrado.</td>
            </tr>
            <tr v-for="u in estado.items" :key="u.id">
              <td><strong>{{ u.nome }}</strong></td>
              <td>{{ u.email }}</td>
              <td>{{ rotuloPerfil(u.nivel) }}</td>
              <td>
                <template v-if="separarUnidades(u.filial).length > 1">
                  <span v-for="un in separarUnidades(u.filial)" :key="un" class="unidade-chip">{{ un }}</span>
                </template>
                <template v-else>{{ u.filial || '—' }}</template>
                <!--
                  Quantos tipos o usuário atende, sem o ADMIN precisar abrir o
                  cadastro: é a informação que explica por que a pessoa não vê
                  (nem recebe) chamado de rede/equipamento.
                -->
                <span
                  v-if="u.escopoTipos?.length"
                  class="escopo-chip"
                  :title="`Restrito a ${u.escopoTipos.length} tipo(s) de chamado, de todas as escolas`"
                >
                  {{ u.escopoTipos.length }} {{ u.escopoTipos.length === 1 ? 'tipo' : 'tipos' }}
                </span>
              </td>
              <td><StatusPill :status="u.status === 'ATIVO' ? 'Ativo' : 'Inativo'" /></td>
              <td class="td-acoes">
                <RowActions
                  v-if="podeEditarAlvo(u)"
                  :itens="[
                    { rotulo: 'Editar', icone: Pencil, acao: () => abrirEditar(u) },
                    ...(isAdmin
                      ? [{ rotulo: 'Novo código de acesso', icone: KeyRound, acao: () => novoCodigoPrimeiroAcesso(u) }]
                      : []),
                    { rotulo: 'Desativar', icone: UserX, perigo: true, acao: () => desativar(u) },
                  ]"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <PaginationBar
        :page="estado.page"
        :page-size="PAGE_SIZE"
        :total="estado.total"
        @change="(p) => { estado.page = p; void carregar() }"
      />
    </div>

    <!-- Modal criar/editar -->
    <BaseModal
      :aberto="modalAberto"
      :titulo="editando ? `Editar ${editando.nome}` : 'Novo usuário'"
      @fechar="modalAberto = false"
    >
      <div class="form-grid">
        <div class="field">
          <label>Nome completo</label>
          <input v-model="form.nome" class="input" placeholder="Nome e sobrenome" />
        </div>
        <div class="field">
          <label>E-mail</label>
          <input v-model="form.email" class="input" type="email" placeholder="nome@educacao.sp.gov.br" :disabled="!!editando" />
        </div>
        <div class="field">
          <label>Perfil</label>
          <select v-model="form.nivel" class="select-input" :disabled="isGestor">
            <option v-for="p in perfisDisponiveis" :key="p.valor" :value="p.valor">{{ p.rotulo }}</option>
          </select>
          <small class="perfil-hint">
            <template v-if="isAdmin">
              <strong>Administrador</strong>: acesso total (portal, usuários, configurações) ·
              <strong>Técnico</strong>: atende uma ou mais unidades (chamados, equipamentos e manutenção) ·
              <strong>Gestor</strong>: gere chamados e equipamentos da unidade ·
            </template>
            <strong>Visualizador</strong>: mesmas funções do Gestor na unidade, <em>sem</em> apagar usuários/equipamentos
          </small>
        </div>

        <!-- Técnico: uma ou mais unidades (matriz atende várias escolas) -->
        <div v-if="!isGestor && form.nivel === 'TECNICO'" class="field field-linha">
          <label>Unidades escolares</label>
          <div v-for="(_, i) in unidades" :key="i" class="unidade-linha">
            <select v-model="unidades[i]" class="select-input">
              <option value="" disabled>Selecione a unidade...</option>
              <option v-for="e in opcoesUnidade(i)" :key="e" :value="e">{{ e }}</option>
            </select>
            <button
              v-if="unidades.length > 1"
              class="btn btn-outline btn-remover"
              type="button"
              title="Remover esta unidade"
              @click="removerUnidade(i)"
            >
              <X :size="15" />
            </button>
          </div>
          <button
            class="btn btn-outline btn-mais-unidade"
            type="button"
            :disabled="!temUnidadeDisponivel"
            @click="adicionarUnidade"
          >
            <Plus :size="15" />
            Adicionar mais uma unidade
          </button>
          <small class="perfil-hint">O técnico verá chamados e equipamentos de todas as unidades marcadas.</small>
          <small v-if="!escolas.length" class="perfil-hint perfil-hint-erro">
            Não foi possível carregar a lista de unidades — recarregue a página para tentar de novo.
          </small>
        </div>

        <!-- Demais perfis: uma única unidade -->
        <div v-else class="field">
          <label>Unidade escolar</label>
          <select v-if="!isGestor && form.nivel !== 'ADMIN'" v-model="form.filial" class="select-input">
            <option value="" disabled>Selecione a unidade...</option>
            <option v-for="e in escolas" :key="e" :value="e">{{ e }}</option>
          </select>
          <input v-else class="input" :value="form.nivel === 'ADMIN' ? 'URE Leste 3' : form.filial" disabled />
        </div>
        <div v-if="editando" class="field">
          <label>Status</label>
          <select v-model="form.status" class="select-input">
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
          </select>
        </div>

        <!--
          Escopo de tipos: quem atende só alguns tipos de chamado, de qualquer
          escola. Só Técnico/Administrador — Gestor e Visualizador cuidam da
          unidade dela e não recebem chamado.
        -->
        <div v-if="podeDefinirEscopo" class="field field-linha escopo-box">
          <label>Tipos de chamado que este usuário atende</label>

          <p v-if="escopoAtivo" class="escopo-ativo">
            <strong>Restrito a {{ escopoMarcado.length }}
              {{ escopoMarcado.length === 1 ? 'tipo' : 'tipos' }}.</strong>
            Vai ver e receber chamado destes tipos em <strong>todas as escolas</strong> —
            a unidade escolhida acima deixa de valer para chamados. Os demais tipos
            ficam ocultos e ele não entra na fila de encaminhamento deles.
          </p>
          <p v-else class="escopo-ativo escopo-ativo-off">
            <strong>Sem restrição.</strong> Vai ver chamado de qualquer tipo, das escolas
            do campo Unidade.
          </p>

          <div v-if="!gruposTipos.length" class="perfil-hint perfil-hint-erro">
            Não foi possível carregar os tipos do formulário — o usuário ficará sem
            restrição. Recarregue a página para tentar de novo.
          </div>

          <div v-for="grupo in gruposTipos" :key="grupo.chave" class="escopo-grupo">
            <span class="escopo-grupo-nome">
              {{ grupo.nome }}
              <span v-if="tiposPorCategoria[grupo.chave]" class="escopo-grupo-conta">
                {{ tiposPorCategoria[grupo.chave] }}
              </span>
            </span>
            <label v-for="tipo in grupo.tipos" :key="tipo.valor" class="escopo-item">
              <input
                type="checkbox"
                :checked="escopoMarcado.includes(tipo.valor)"
                @change="alternarTipo(tipo.valor)"
              />
              <span>{{ tipo.rotulo }}</span>
            </label>
          </div>
        </div>
      </div>

      <template #footer>
        <button class="btn btn-outline" type="button" @click="modalAberto = false">Cancelar</button>
        <button
          class="btn btn-primary"
          type="button"
          :disabled="salvando || !form.nome || (!editando && !form.email) || !unidadePreenchida"
          @click="salvar"
        >
          {{ editando ? 'Salvar alterações' : 'Criar usuário' }}
        </button>
      </template>
    </BaseModal>

    <!-- Modal do código de primeiro acesso -->
    <BaseModal
      :aberto="!!codigoModal"
      titulo="Código de primeiro acesso"
      @fechar="codigoModal = null"
    >
      <div v-if="codigoModal" class="senha-temp">
        <p>
          Entregue este código a <strong>{{ codigoModal.email }}</strong>.
          Com ele, a pessoa cria a própria senha na tela de acesso — você
          não precisa gerar nem anotar senha nenhuma.
        </p>
        <div class="senha-box">{{ codigoModal.codigo }}</div>
        <p class="senha-temp-nota">
          Vale por 24 horas e só pode ser usado uma vez. Gerar um novo código
          anula o anterior.
        </p>
        <p class="senha-temp-nota">
          Se o pedido chegou por um chamado da unidade, você pode responder o
          próprio chamado com este código: em <strong>Chamados</strong>, abra o
          pedido de senha e use “Responder com código de acesso”. O solicitante
          lê a resposta na consulta por protocolo.
        </p>
        <button
          class="btn btn-outline"
          type="button"
          @click="copiarCodigo(codigoModal.codigo)"
        >
          Copiar código
        </button>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.usuarios-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 200px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  padding: 0 12px;
  color: var(--text-muted);
}

.search-box input {
  flex: 1;
  border: none;
  outline: none;
  padding: 10px 0;
  background: transparent;
  color: var(--text-primary);
}

.select-input.slim {
  width: auto;
  min-width: 140px;
}

/* Nome de unidade é longo: o select precisa de mais largura que os demais. */
.unidade-select {
  min-width: 230px;
  max-width: 290px;
}

.btn-limpar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.btn-limpar:hover {
  color: var(--text-primary);
}

/* O botão "Novo usuário" fica encostado à direita da toolbar. */
.btn-novo {
  margin-left: auto;
}

@media (max-width: 900px) {
  .btn-novo {
    margin-left: 0;
  }
}

.erro {
  padding: 14px 18px;
  color: var(--red);
  font-weight: 500;
}

/* Cota de usuários da unidade (só Gestor) — azul enquanto há vaga, vermelho quando fecha */
.cota {
  padding: 12px 16px;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--text-secondary);
  background: var(--blue-soft);
  border: 1px solid transparent;
}

.cota-cheia {
  color: var(--red);
  background: var(--red-soft);
  font-weight: 500;
}

.td-center {
  text-align: center;
  color: var(--text-muted);
  padding: 28px !important;
}

.th-acoes,
.td-acoes {
  width: 60px;
  text-align: center;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.perfil-hint {
  display: block;
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.5;
}

.perfil-hint-erro {
  color: var(--red);
}

/* Unidades do técnico: uma linha por select + botão de nova linha */
.field-linha {
  grid-column: 1 / -1;
  gap: 8px;
}

.unidade-linha {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-remover {
  flex-shrink: 0;
  padding: 10px 12px;
  color: var(--text-muted);
}

.btn-remover:hover {
  color: var(--red);
}

.btn-mais-unidade {
  align-self: flex-start;
  padding: 8px 14px;
  font-size: 13px;
}

/* ---------- Escopo de tipos ---------- */

.escopo-box {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 14px 16px;
  background: var(--surface-muted);
}

.escopo-ativo {
  margin: 0 0 14px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary);
  background: var(--blue-soft);
}

.escopo-ativo-off {
  background: transparent;
  padding-left: 0;
  padding-top: 0;
}

.escopo-grupo {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 8px 0;
}

.escopo-grupo + .escopo-grupo {
  border-top: 1px solid var(--border);
}

.escopo-grupo-nome {
  flex: 0 0 100%;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

/* Quantos tipos da categoria estão marcados — evita reler a lista inteira. */
.escopo-grupo-conta {
  margin-left: 6px;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10.5px;
  letter-spacing: 0;
  color: var(--blue);
  background: var(--blue-soft);
}

.escopo-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13.5px;
  color: var(--text-primary);
  cursor: pointer;
}

.escopo-item input {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--blue);
}

.escopo-chip {
  display: inline-block;
  margin-top: 5px;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  background: var(--blue-soft);
  border: 1px solid transparent;
  color: var(--blue);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.4;
}

/* Unidades múltiplas na tabela */
.unidade-chip {
  display: inline-block;
  margin: 0 4px 4px 0;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 11.5px;
  line-height: 1.4;
}

.senha-temp {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: flex-start;
}

.senha-temp p {
  margin: 0;
  font-size: 13.5px;
  color: var(--text-secondary);
}

.senha-temp-nota {
  margin-top: 10px !important;
  font-size: 12px !important;
  color: var(--text-muted) !important;
}

/* O código tem 6 dígitos: o espaçamento largo do `senha-box` (pensado para
   senha temporária) deixaria o número pequeno e solto no meio da caixa. */
.senha-box {
  font-family: 'Courier New', monospace;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.08em;
  background: var(--surface-muted);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  padding: 12px 20px;
  user-select: all;
  /* Senhas temporárias longas não podem estourar o modal */
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  /* Busca ocupa a linha inteira; filtros/botões quebram para a linha de baixo */
  .search-box {
    min-width: 0;
    width: 100%;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
