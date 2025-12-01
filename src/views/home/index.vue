<script setup lang="ts">
import { useAppStore } from '@/store/modules/app';
import CardData from './modules/card-data.vue';
import PieChart from './modules/pie-chart.vue';
import ProjectNews from './modules/project-news.vue';
import CurrentPermissions from './modules/current-permissions.vue';

const pipelineImage = new URL('@/assets/imgs/pipeline.jpg', import.meta.url).href;

useAppStore();
</script>

<template>
  <ElSpace direction="vertical" fill class="w-full pb-0" :size="0">
    <CardData class="w-full" />

    <div class="px-4 py-4">
      <ElRow :gutter="20" class="w-full items-stretch">
        <!-- 左侧列 (上下两个模块) -->
        <ElCol :xl="12" :lg="12" :md="24" :sm="24" class="flex flex-col gap-6 pb-6 xl:pb-0">
          <!-- 左上角: 项目动态 -->
          <ProjectNews class="w-full flex-1" />
          <!-- 左下角: 文件类型分布 -->
          <PieChart class="w-full flex-1" />
        </ElCol>

        <!-- 右侧列 (上下两个模块) -->
        <ElCol :xl="12" :lg="12" :md="24" :sm="24" class="flex flex-col gap-6 pb-6 xl:pb-0">
          <!-- 右上角: 产品架构图 -->
          <ElCard
            class="w-full flex flex-1 items-center justify-center overflow-hidden border-0 rounded-xl shadow-lg"
            shadow="hover"
            :body-style="{ padding: '16px' }"
          >
            <div class="h-full min-h-96 w-full flex items-center justify-center">
              <img :src="pipelineImage" alt="产品架构图" class="max-h-80 w-full rounded-lg object-contain" />
            </div>
          </ElCard>
          <!-- 右下角: 我的权限 -->
          <CurrentPermissions class="w-full flex-1" />
        </ElCol>
      </ElRow>
    </div>
  </ElSpace>
</template>
