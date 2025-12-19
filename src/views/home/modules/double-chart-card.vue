<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <ElCard class="card-wrapper shadow-sm">
    <template #header>
      <div class="text-center font-bold">{{ title }}</div>
    </template>
    <div class="h-360px flex flex-col items-center justify-around lg:flex-row">
      <div class="h-full w-full lg:w-1/2"><slot name="left"></slot></div>
      <div class="h-full w-full lg:w-1/2"><slot name="right"></slot></div>
    </div>
  </ElCard>
</template>
