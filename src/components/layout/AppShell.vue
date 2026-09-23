<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import AppTopbar from './AppTopbar.vue'
import { useSidebar } from '@/composables/useSidebar'

const route = useRoute()
const { fechar, liberarScroll } = useSidebar()

watch(
  () => route.fullPath,
  () => fechar(),
)

onUnmounted(liberarScroll)
</script>

<template>
  <div class="shell">
    <AppSidebar />
    <div class="content">
      <AppTopbar />
      <main class="page">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  min-height: 100vh;
}

.content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.page {
  flex: 1;
  padding: 24px 28px 40px;
}

@media (max-width: 900px) {
  .page {
    padding: 16px 14px 32px;
  }
}
</style>
