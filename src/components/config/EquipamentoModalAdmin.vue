<script setup lang="ts">
/**
 * Aba "Modal de equipamentos" das Configurações (ADMIN).
 *
 * Permite editar rótulo, texto de ajuda, obrigatoriedade, ativação e ordem
 * das perguntas (campos) que compõem o modal de cadastro/edição de equipamento.
 * As mudanças são aplicadas no próprio modal (EquipamentoFormModal.vue).
 */
import { ref } from 'vue'
import { ArrowDown, ArrowUp, Eye, Plus, RotateCcw, Save, Trash2 } from '@lucide/vue'
import EquipamentoFormModal from '@/components/equipamentos/EquipamentoFormModal.vue'
import { PERFIS_USUARIO, useEquipamentoModalConfig } from '@/composables/useEquipamentoModalConfig'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const { ordenados, salvar, restaurar, novaPergunta, removerPergunta, chaveEhFixo } =
  useEquipamentoModalConfig()

const previewAberto = ref(false)

function mover(idx: number, delta: number) {
  const lista = [...ordenados.value]
  const alvo = idx + delta
  if (alvo < 0 || alvo >= lista.length) return
  // Troca `ordem` dos dois vizinhos.
  const a = lista[idx]
  const b = lista[alvo]
  if (!a || !b) return
  const ordemA = a.ordem
  a.ordem = b.ordem
  b.ordem = ordemA
}

function salvarConfig() {
  salvar()
  ui.success('Configuração do modal de equipamentos salva.')
}

function restaurarPadrao() {
  if (!window.confirm('Restaurar os rótulos e a ordem padrão das perguntas?')) return
  restaurar()
  ui.success('Configuração restaurada para o padrão.')
}

function temPerfil(campo: any, perfil: string): boolean {
  return Array.isArray(campo.perfis) && campo.perfis.includes(perfil)
}

function alternarPerfil(campo: any, perfil: string) {
  if (!Array.isArray(campo.perfis)) campo.perfis = [...PERFIS_USUARIO]
  const idx = campo.perfis.indexOf(perfil)
  if (idx >= 0) {
    // Evita deixar uma pergunta sem nenhum perfil autorizado.
    if (campo.perfis.length <= 1) return
    campo.perfis.splice(idx, 1)
  } else {
    campo.perfis.push(perfil)
  }
}

function abrirPreview() {
  previewAberto.value = true
}

/** Nova pergunta livre: entra em edição já selecionada no fim da lista. */
function adicionarPergunta() {
  novaPergunta()
  ui.info('Pergunta adicionada. Edite o rótulo e clique em Salvar.')
}

function excluirPergunta(chave: string, rotulo: string) {
  if (chaveEhFixo(chave)) return
  if (!window.confirm(`Excluir a pergunta "${rotulo}"?`)) return
  removerPergunta(chave)
  ui.success('Pergunta excluída da configuração.')
}
</script>

<template>
  <div class="ema">
    <div class="ema-head">
      <div>
        <h3>Modal de equipamentos</h3>
        <p class="ema-desc">
          Edite as perguntas (campos) exibidas ao cadastrar ou editar um equipamento. A pré-visualização
          abre o modal com a configuração atual.
        </p>
      </div>
      <div class="ema-acoes">
        <button class="btn btn-outline" type="button" @click="restaurarPadrao">
          <RotateCcw :size="15" />
          Restaurar padrão
        </button>
        <button class="btn btn-outline" type="button" @click="abrirPreview">
          <Eye :size="15" />
          Pré-visualizar
        </button>
        <button class="btn btn-outline" type="button" @click="adicionarPergunta">
          <Plus :size="15" />
          Nova pergunta
        </button>
        <button class="btn btn-primary" type="button" @click="salvarConfig">
          <Save :size="15" />
          Salvar
        </button>
      </div>
    </div>

    <div class="ema-lista">
      <div v-for="(c, i) in ordenados" :key="c.chave" class="ema-item" :class="{ inativo: !c.ativo }">
        <div class="ema-grip">
          <button class="ico-btn" type="button" title="Mover para cima" :disabled="i === 0" @click="mover(i, -1)">
            <ArrowUp :size="13" />
          </button>
          <span class="ema-posicao">{{ i + 1 }}</span>
          <button
            class="ico-btn"
            type="button"
            title="Mover para baixo"
            :disabled="i === ordenados.length - 1"
            @click="mover(i, 1)"
          >
            <ArrowDown :size="13" />
          </button>
        </div>

        <div class="ema-corpo">
          <div class="ema-linha1">
            <code class="ema-chave">{{ c.personalizada ? 'extra' : c.chave }}</code>
            <input
              v-model="c.rotulo"
              class="input ema-rotulo"
              placeholder="Rótulo exibido no modal"
            />
            <div v-if="c.personalizada" class="ema-switches">
              <select v-model="c.tipo" class="select-input slim ema-tipo">
                <option value="texto">Texto</option>
                <option value="textarea">Texto longo</option>
                <option value="opcoes">Opções</option>
              </select>
            </div>
            <div class="ema-switches">
              <label class="switch" :class="{ on: c.ativo }">
                <input type="checkbox" v-model="c.ativo" />
                <span>{{ c.ativo ? 'Ativa' : 'Inativa' }}</span>
              </label>
              <label class="switch" :class="{ on: c.obrigatorio }">
                <input type="checkbox" v-model="c.obrigatorio" />
                <span>Obrigatória</span>
              </label>
            </div>
          </div>
          <input v-model="c.ajuda" class="input ema-ajuda" placeholder="Texto de ajuda (opcional)" />
          <input
            v-if="c.personalizada && c.tipo === 'opcoes'"
            v-model="c.opcoes"
            class="input ema-ajuda"
            placeholder="Opções separadas por vírgula (ex.: Sim, Não, Trocar)"
          />
          <div class="ema-perfis">
            <span class="ema-perfis-rotulo">Quem preenche:</span>
            <div class="ema-chips">
              <button
                v-for="pf in PERFIS_USUARIO"
                :key="pf"
                type="button"
                class="ema-chip"
                :class="{ on: temPerfil(c, pf) }"
                @click="alternarPerfil(c, pf)"
              >
                {{ pf }}
              </button>
            </div>
          </div>
        </div>
        <button
          v-if="c.personalizada"
          class="ico-btn perigo ema-excluir"
          type="button"
          title="Excluir pergunta"
          @click="excluirPergunta(c.chave, c.rotulo)"
        >
          <Trash2 :size="14" />
        </button>
      </div>
    </div>

    <EquipamentoFormModal
      v-if="previewAberto"
      :aberto="previewAberto"
      :item="null"
      @fechar="previewAberto = false"
    />
  </div>
</template>

<style scoped>
.ema-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.ema-head h3 {
  font-size: 15px;
  margin-bottom: 4px;
}
.ema-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  max-width: 620px;
}
.ema-acoes {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.ema-lista {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ema-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}
.ema-item.inativo {
  opacity: 0.55;
  background: var(--surface-muted);
}
.ema-ordem {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
}
.ema-corpo {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ema-linha1 {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.ema-chave {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 2px 7px;
}
.ema-campos {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.ema-campos .input {
  width: 100%;
}
.check-linha {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
}
.check-linha input {
  accent-color: var(--sidebar-bg);
  width: 15px;
  height: 15px;
}
.ico-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: var(--text-muted);
  background: transparent;
}
.ico-btn:hover:not(:disabled) {
  background: var(--surface-muted);
  color: var(--text-primary);
}
.ico-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* ---------- Switches ---------- */
.switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: var(--surface-muted);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  position: relative;
}
.switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.switch::before {
  content: '';
  width: 28px;
  height: 16px;
  border-radius: 999px;
  background: var(--border-strong);
  transition: background 0.15s ease;
}
.switch::after {
  content: '';
  position: absolute;
  left: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s ease;
}
.switch.on::before {
  background: #16a34a;
}
.switch.on::after {
  transform: translate(16px, -50%);
}
.switch.on {
  color: var(--text-primary);
  border-color: transparent;
}

/* ---------- Chips de perfil ---------- */
.ema-perfis {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.ema-perfis-rotulo {
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}
.ema-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.ema-chip {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s ease;
}
.ema-chip:hover {
  border-color: var(--blue);
  color: var(--blue);
}
.ema-chip.on {
  background: var(--blue-soft);
  border-color: var(--blue);
  color: var(--blue);
}

/* ---------- Ajustes gerais ---------- */
.ema-grip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.ema-posicao {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
}
.ema-item {
  align-items: center;
}
.ema-rotulo {
  flex: 1 1 220px;
  min-width: 180px;
}
.ema-ajuda {
  width: 100%;
}
.ema-switches {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.ema-linha1 {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.ema-tipo {
  min-width: 130px;
}
.ema-excluir {
  align-self: center;
  flex-shrink: 0;
}
.ico-btn.perigo {
  color: var(--red);
}
.ico-btn.perigo:hover:not(:disabled) {
  background: var(--red-soft);
}
@media (max-width: 640px) {
  .ema-campos {
    grid-template-columns: 1fr;
  }
}
</style>
