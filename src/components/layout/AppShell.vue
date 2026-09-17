<script setup lang="ts">
import AppSidebar from './AppSidebar.vue'
import AppTopbar from './AppTopbar.vue'
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
</style>
