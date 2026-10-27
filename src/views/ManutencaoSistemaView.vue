<template>
  <div class="manut-sistema">
    <div class="manut-card">
      <h1>Sistema em manutenção</h1>
      <p>O portal estará temporariamente indisponível para manutenção programada.</p>
      <div class="manut-window">Manutenção: 17:00 às 20:00</div>
      <p>Por favor, tente novamente após esse horário. Pedimos desculpas pelo inconveniente.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.manut-sistema {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(135deg, #eef4fb 0%, #dce8f8 100%);
}
.manut-card {
  background: var(--card-bg, #fff);
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(16, 24, 40, 0.12);
  padding: 40px 36px;
  max-width: 460px;
  width: 100%;
  text-align: center;
}
.manut-card h1 {
  font-size: 1.35rem;
  margin: 0 0 8px;
  color: #1565c0;
}
.manut-card p {
  margin: 8px 0;
  line-height: 1.55;
  color: #4b5563;
}
.manut-window {
  margin-top: 18px;
  padding: 12px 16px;
  border-radius: 10px;
  background: #f3f6fb;
  font-weight: 600;
  color: #1565c0;
}
</style>
