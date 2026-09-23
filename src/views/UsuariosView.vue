<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { apiError } from '@/utils/apiError'
import { KeyRound, Pencil, Search, UserPlus, UserX } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import RowActions from '@/components/ui/RowActions.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import {
  atualizarUsuario,
  criarUsuario,
  desativarUsuario,
  gerarSenhaTemporaria,
  listarEscolas,
  listarUsuarios,
} from '@/api/usuarios'
import { rotuloPerfil, type Nivel, type User } from '@/types'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { computed } from 'vue'

const ui = useUiStore()
const auth = useAuthStore()

const isAdmin = computed(() => auth.user?.nivel === 'ADMIN')
const isGestor = computed(() => auth.user?.nivel === 'GESTOR')

/** Perfis disponíveis no cadastro (Gestor só pode criar Visualizador). */
const perfisDisponiveis = computed(() =>
  isAdmin.value
    ? [
        { valor: 'ADMIN' as const, rotulo: 'Administrador' },
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
const filtros = reactive({ search: '', status: '' })

const escolas = ref<string[]>([])

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

/* ---------- Criar / Editar ---------- */

const modalAberto = ref(false)
const editando = ref<User | null>(null)
const salvando = ref(false)
const form = reactive({ nome: '', email: '', nivel: 'GESTOR' as Nivel, filial: '', status: 'ATIVO' as 'ATIVO' | 'INATIVO' })

/** Senha temporária exibida após criar usuário / gerar nova senha */
const senhaTempModal = ref<{ email: string; senha: string } | null>(null)

function abrirCriar() {
  editando.value = null
  form.nome = ''
  form.email = ''
  form.nivel = isGestor.value ? 'VISUALIZADOR' : 'GESTOR'
  form.filial = isGestor.value ? auth.user?.filial || '' : ''
  form.status = 'ATIVO'
  modalAberto.value = true
}

function abrirEditar(u: User) {
  editando.value = u
  form.nome = u.nome
  form.email = u.email
  form.nivel = u.nivel === 'TECNICO' ? 'TECNICO' : u.nivel
  form.filial = u.filial
  form.status = (u.status === 'ATIVO' ? 'ATIVO' : 'INATIVO')
  modalAberto.value = true
}

async function salvar() {
  salvando.value = true
  try {
    if (editando.value) {
      await atualizarUsuario(editando.value.id, {
        nome: form.nome,
        nivel: form.nivel,
        filial: form.nivel === 'ADMIN' ? 'URE Leste 3' : form.filial,
        status: form.status,
      })
      ui.success('Usuário atualizado.')
      modalAberto.value = false
    } else {
      const criado = await criarUsuario({
        email: form.email.trim().toLowerCase(),
        nome: form.nome.trim(),
        nivel: form.nivel,
        filial: form.nivel === 'ADMIN' ? 'URE Leste 3' : form.filial,
      })
      modalAberto.value = false
      senhaTempModal.value = { email: criado.email, senha: criado.senhaTemporaria }
    }
    await carregar()
  } catch (e) {
    ui.error(apiError(e, 'Falha ao salvar usuário.'))
  } finally {
    salvando.value = false
  }
}

async function novaSenhaTemporaria(u: User) {
  try {
    const senha = await gerarSenhaTemporaria(u.email)
    senhaTempModal.value = { email: u.email, senha }
  } catch {
    ui.error('Não foi possível gerar a senha temporária.')
  }
}

async function desativar(u: User) {
  if (!window.confirm(`Desativar ${u.nome} (${u.email})?`)) return
  try {
    await desativarUsuario(u.id)
    ui.success('Usuário desativado.')
    await carregar()
  } catch {
    ui.error('Não foi possível desativar o usuário.')
  }
}

function copiarSenha(senha: string) {
  void navigator.clipboard.writeText(senha)
  ui.success('Senha copiada.')
}

onMounted(async () => {
  void carregar()
  try {
    escolas.value = await listarEscolas()
  } catch {
    escolas.value = []
  }
})
</script>

<template>
  <div class="usuarios-page">
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
      <select v-model="filtros.status" class="select-input slim" @change="aplicarFiltros">
        <option value="">Status: Todos</option>
        <option value="ATIVO">Ativo</option>
        <option value="INATIVO">Inativo</option>
      </select>
      <button class="btn btn-primary" type="button" @click="abrirCriar">
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
              <td>{{ u.filial || '—' }}</td>
              <td><StatusPill :status="u.status === 'ATIVO' ? 'Ativo' : 'Inativo'" /></td>
              <td class="td-acoes">
                <RowActions
                  v-if="podeEditarAlvo(u)"
                  :itens="[
                    { rotulo: 'Editar', icone: Pencil, acao: () => abrirEditar(u) },
                    ...(isAdmin
                      ? [{ rotulo: 'Nova senha temporária', icone: KeyRound, acao: () => novaSenhaTemporaria(u) }]
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
              <strong>Gestor</strong>: gere chamados e equipamentos da(s) unidade(s) ·
            </template>
            <strong>Visualizador</strong>: mesmas funções do Gestor na unidade, <em>sem</em> apagar usuários/equipamentos
          </small>
        </div>
        <div class="field">
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
      </div>

      <template #footer>
        <button class="btn btn-outline" type="button" @click="modalAberto = false">Cancelar</button>
        <button
          class="btn btn-primary"
          type="button"
          :disabled="salvando || !form.nome || (!editando && !form.email) || (form.nivel !== 'ADMIN' && !form.filial)"
          @click="salvar"
        >
          {{ editando ? 'Salvar alterações' : 'Criar usuário' }}
        </button>
      </template>
    </BaseModal>

    <!-- Modal senha temporária -->
    <BaseModal
      :aberto="!!senhaTempModal"
      titulo="Senha temporária gerada"
      @fechar="senhaTempModal = null"
    >
      <div v-if="senhaTempModal" class="senha-temp">
        <p>
          Compartilhe com o usuário <strong>{{ senhaTempModal.email }}</strong>.
          Ele será obrigado a definir uma senha própria no primeiro acesso.
        </p>
        <div class="senha-box">{{ senhaTempModal.senha }}</div>
        <button
          class="btn btn-outline"
          type="button"
          @click="copiarSenha(senhaTempModal.senha)"
        >
          Copiar senha
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

.erro {
  padding: 14px 18px;
  color: var(--red);
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
