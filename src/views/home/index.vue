<script setup lang="ts">
import { useAppStore } from '@/store/modules/app';
import CardData from './modules/card-data.vue';
import PieChart from './modules/pie-chart.vue';
import ProjectNews from './modules/project-news.vue';

const pipelineImage = new URL('@/assets/imgs/pipeline.jpg', import.meta.url).href;

useAppStore();
</script>

<template>
  <ElSpace direction="vertical" fill class="w-full pb-0" :size="0">
    <CardData class="w-full" />

    <ElRow :gutter="16" class="w-full items-stretch">
      <ElCol :xl="10" :lg="10" :md="24" :sm="24" class="flex flex-col gap-4 pb-4 xl:pb-0">
        <ProjectNews class="w-full" />
        <PieChart class="w-full" />
      </ElCol>

      <ElCol :xl="14" :lg="14" :md="24" :sm="24" class="flex pb-4 xl:pb-0">
        <ElCard
          class="h-full w-full flex items-center justify-center overflow-hidden border-0 rounded-xl shadow-lg"
          shadow="hover"
          :body-style="{ padding: '0' }"
        >
          <div class="h-full w-full flex items-center justify-center">
            <img :src="pipelineImage" alt="产品架构图" class="max-h-[800px] w-auto object-contain" />
          </div>
        </ElCard>
      </ElCol>
    </ElRow>
  </ElSpace>
</template>
