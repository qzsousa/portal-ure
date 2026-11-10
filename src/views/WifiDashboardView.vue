<template>
  <WifiDashboardAdminView v-if="auth.user?.nivel === 'ADMIN'" />
  <WifiDashboardTecnicoView v-else />
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import WifiDashboardAdminView from './WifiDashboardAdminView.vue'
import WifiDashboardTecnicoView from './WifiDashboardTecnicoView.vue'

const auth = useAuthStore()
</script>
