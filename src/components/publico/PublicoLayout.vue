<script setup lang="ts">
import { LogIn } from '@lucide/vue'

/**
 * Moldura das páginas públicas (sem autenticação):
 * fundo branco, header branco com a marca do portal + link "Entrar" e rodapé
 * discreto. Mesmo padrão da tela de abertura de chamado (`NovoChamadoView`).
 *
 * Use `wide` em páginas com muito conteúdo (painéis/dashboards).
 */
withDefaults(defineProps<{ wide?: boolean }>(), { wide: false })
</script>

<template>
  <div class="pub">
    <header class="pub-topo">
      <div class="pub-topo-inner" :class="{ wide }">
        <RouterLink to="/chamado/novo" class="pub-marca">
          <img class="marca-logo" src="/logo-ure.png" alt="Brasão da URE Leste 3" />
          <span class="marca-texto">PORTAL URE LESTE 3</span>
        </RouterLink>
        <RouterLink to="/login" class="pub-entrar">
          <LogIn :size="15" />
          Entrar
        </RouterLink>
      </div>
    </header>

    <main class="pub-conteudo" :class="{ wide }">
      <slot />
    </main>

    <footer class="pub-rodape">
      <em>Tecnologia a serviço da educação</em> · URE Leste 3
    </footer>
  </div>
</template>

<style scoped>
.pub {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
}

.pub-topo {
  padding: 16px 20px 0;
}

.pub-topo-inner {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.pub-topo-inner.wide {
  max-width: 1180px;
}

.pub-marca {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.marca-logo {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex-shrink: 0;
}

.marca-texto {
  color: var(--sidebar-bg);
  font-weight: 800;
  font-size: 14px;
  letter-spacing: 0.05em;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pub-entrar {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  border: 1px solid var(--border-strong);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  transition: background 0.15s ease, border-color 0.15s ease;
  flex-shrink: 0;
}

.pub-entrar:hover {
  background: var(--surface);
  border-color: var(--blue);
  color: var(--blue);
}

.pub-conteudo {
  flex: 1;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 26px 20px 48px;
}

.pub-conteudo.wide {
  max-width: 1180px;
}

.pub-rodape {
  text-align: center;
  padding: 18px;
  color: var(--text-muted);
  font-size: 12px;
  border-top: 1px solid var(--border);
}

.pub-rodape em {
  font-family: Georgia, 'Times New Roman', serif;
}

@media (max-width: 480px) {
  .pub-topo {
    padding: 14px 14px 0;
  }
  .pub-conteudo {
    padding: 26px 14px 48px;
  }
}
</style>
