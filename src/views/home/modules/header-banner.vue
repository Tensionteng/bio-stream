<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchTaskStatus } from '@/service/api/home';
import { useAppStore } from '@/store/modules/app';
import { useAuthStore } from '@/store/modules/auth';
import { $t } from '@/locales';

defineOptions({ name: 'HeaderBanner' });

const appStore = useAppStore();
const authStore = useAuthStore();

const gap = computed(() => (appStore.isMobile ? 0 : 16));
const taskStatusData = ref<Api.Home.TaskStatus[]>([]);
const loading = ref(false);

interface StatisticData {
  id: number;
  title: string;
  value: number;
}

const statisticData = computed<StatisticData[]>(() => {
  const totalTasks = taskStatusData.value.reduce((sum, status) => sum + status.count, 0);
  const runningTasks = taskStatusData.value.find(status => status.status === 'Running')?.count || 0;

  return [
    { id: 0, title: $t('page.home.taskCount'), value: totalTasks },
    { id: 1, title: $t('page.home.taskRunning'), value: runningTasks }
  ];
});

async function fetchData() {
  try {
    loading.value = true;
    const { data } = await fetchTaskStatus();
    taskStatusData.value = data?.status || [];
  } catch (error) {
    console.error('获取任务统计失败:', error);
    taskStatusData.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchData();
});
</script>

<template>
  <ElCard v-loading="loading" class="card-wrapper">
    <ElRow :gutter="gap" class="px-8px">
      <ElCol :md="18" :sm="24">
        <div class="flex-y-center">
          <div class="size-72px shrink-0 overflow-hidden rd-1/2">
            <img src="@/assets/imgs/soybean.jpg" class="size-full" />
          </div>
          <div class="pl-12px">
            <h3 class="text-18px font-semibold">
              {{ $t('page.home.greeting', { userName: authStore.userInfo.userName }) }}
            </h3>
            <p class="text-#999 leading-30px">{{ $t('page.home.weatherDesc') }}</p>
          </div>
        </div>
      </ElCol>
      <ElCol :md="6" :sm="24">
        <ElSpace direction="horizontal" class="w-full justify-end" :size="24">
          <ElStatistic v-for="item in statisticData" :key="item.id" class="whitespace-nowrap" v-bind="item" />
        </ElSpace>
      </ElCol>
    </ElRow>
  </ElCard>
</template>

<style scoped></style>
