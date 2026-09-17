<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Hammer } from '@lucide/vue'

const route = useRoute()
const modulo = computed(() => (route.meta.modulo as string) || 'Módulo')
</script>

<template>
  <div class="stub card">
    <Hammer :size="40" :stroke-width="1.5" />
    <h2>{{ modulo }}</h2>
    <p>
      Este módulo faz parte do novo PORTAL URE LESTE 3 e será implementado nas próximas fases do
      projeto de unificação (Equipamentos → Chamados → Unidades → Relatórios).
    </p>
  </div>
</template>

<style scoped>
.stub {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 12px;
  padding: 72px 32px;
  color: var(--text-muted);
}

.stub h2 {
  font-size: 18px;
}

.stub p {
  max-width: 460px;
  margin: 0;
  font-size: 13.5px;
}
</style>
