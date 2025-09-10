<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { createReusableTemplate } from '@vueuse/core';
import { fetchTaskStatus } from '@/service/api/home';
import { $t } from '@/locales';

defineOptions({ name: 'CardData' });

interface CardData {
  key: string;
  title: string;
  value: number;
  unit: string;
  color: {
    start: string;
    end: string;
  };
  icon: string;
}

const taskStatusData = ref<Api.Home.TaskStatus[]>([]);
const loading = ref(false);

// 预定义的颜色方案
const colorSchemes = [
  { start: '#ec4786', end: '#b955a4' },
  { start: '#865ec0', end: '#5144b4' },
  { start: '#56cdf3', end: '#719de3' },
  { start: '#fcbc25', end: '#f68057' },
  { start: '#26deca', end: '#13c2c2' }
];

const cardData = computed<CardData[]>(() => {
  const cards: CardData[] = [];

  // 状态名称和图标映射
  const statusConfig: Record<string, { title: string; icon: string }> = {
    Pending: { title: $t('page.home.taskPending'), icon: 'ant-design:clock-circle-outlined' },
    Running: { title: $t('page.home.taskRunning'), icon: 'ant-design:loading-outlined' },
    Success: { title: $t('page.home.taskCompleted'), icon: 'ant-design:check-circle-outlined' },
    Failed: { title: $t('page.home.taskFailed'), icon: 'ant-design:close-circle-outlined' },
    Canceled: { title: $t('page.home.taskCancelled'), icon: 'ant-design:stop-outlined' }
  };

  // 自适应添加各种任务状态卡片
  taskStatusData.value.forEach((taskStatus, index) => {
    const colorIndex = index % colorSchemes.length;
    const config = statusConfig[taskStatus.status];

    cards.push({
      key: taskStatus.status,
      title: config?.title || taskStatus.status,
      value: taskStatus.count,
      unit: '',
      color: colorSchemes[colorIndex],
      icon: config?.icon || 'ant-design:info-circle-outlined'
    });
  });

  return cards;
});

async function fetchData() {
  try {
    loading.value = true;
    const { data } = await fetchTaskStatus();
    taskStatusData.value = data?.status || [];
  } catch (error) {
    console.error('获取任务状态统计失败:', error);
    taskStatusData.value = [];
  } finally {
    loading.value = false;
  }
}
interface GradientBgProps {
  gradientColor: string;
}

const [DefineGradientBg, GradientBg] = createReusableTemplate<GradientBgProps>();

function getGradientColor(color: CardData['color']) {
  return `linear-gradient(to bottom right, ${color.start}, ${color.end})`;
}

// 页面初始化
onMounted(() => {
  fetchData();
});
</script>

<template>
  <ElCard v-loading="loading" class="card-wrapper">
    <template #header>
      <div class="text-center">
        <h3 class="text-18px font-semibold">{{ $t('page.home.taskStatusOverview') }}</h3>
      </div>
    </template>
    <!-- define component start: GradientBg -->
    <DefineGradientBg v-slot="{ $slots, gradientColor }">
      <div class="rd-8px px-16px pb-4px pt-8px text-white" :style="{ backgroundImage: gradientColor }">
        <component :is="$slots.default" />
      </div>
    </DefineGradientBg>
    <!-- define component end: GradientBg -->
    <ElRow :gutter="16">
      <ElCol v-for="item in cardData" :key="item.key" :xs="24" :sm="12" :md="8" :lg="4" :xl="4" class="my-8px">
        <GradientBg :gradient-color="getGradientColor(item.color)" class="flex-1">
          <h3 class="text-14px">{{ item.title }}</h3>
          <div class="flex justify-between pt-12px">
            <SvgIcon :icon="item.icon" class="text-28px" />
            <CountTo
              :prefix="item.unit"
              :start-value="1"
              :end-value="item.value"
              class="text-24px text-white dark:text-dark"
            />
          </div>
        </GradientBg>
      </ElCol>
    </ElRow>
  </ElCard>
</template>

<style scoped>
/* 使用CSS实现完美5列布局 */
.el-row {
  display: flex !important;
  flex-wrap: wrap;
}

.el-col {
  flex: 0 0 20% !important; /* 20% = 5列 */
  max-width: 20% !important;
}

@media (max-width: 768px) {
  .el-col {
    flex: 0 0 100% !important;
    max-width: 100% !important;
  }
}

@media (min-width: 769px) and (max-width: 992px) {
  .el-col {
    flex: 0 0 50% !important;
    max-width: 50% !important;
  }
}

@media (min-width: 993px) and (max-width: 1200px) {
  .el-col {
    flex: 0 0 33.333% !important;
    max-width: 33.333% !important;
  }
}
</style>
