<script setup lang="ts">
import { BookOpen, LogIn } from '@lucide/vue'

/**
 * Moldura das páginas públicas (sem autenticação):
 * fundo em gradiente azul-marinho (mesmo padrão do login), header com a
 * marca do portal + link "Entrar" e rodapé discreto.
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
          <span class="marca-icone"><BookOpen :size="17" :stroke-width="2" /></span>
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
  background:
    radial-gradient(1200px 600px at 80% -10%, rgb(245 185 33 / 0.12), transparent 60%),
    linear-gradient(160deg, #081a33 0%, #0a2140 45%, #061429 100%);
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
}

.marca-icone {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: rgb(245 185 33 / 0.15);
  color: var(--brand-gold);
}

.marca-texto {
  color: #fff;
  font-weight: 800;
  font-size: 14px;
  letter-spacing: 0.05em;
}

.pub-entrar {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  background: rgb(255 255 255 / 0.09);
  border: 1px solid rgb(255 255 255 / 0.16);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.15s ease;
}

.pub-entrar:hover {
  background: rgb(255 255 255 / 0.18);
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
  color: rgb(255 255 255 / 0.45);
  font-size: 12px;
}

.pub-rodape em {
  font-family: Georgia, 'Times New Roman', serif;
}
</style>
