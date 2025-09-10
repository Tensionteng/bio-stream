<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchEvents } from '@/service/api/home';
import { $t } from '@/locales';

defineOptions({ name: 'ProjectNews' });

interface NewsItem {
  id: number;
  content: string;
  time: string;
  type: string;
}

const loading = ref(false);
const eventsData = ref<Api.Home.Event[]>([]);

// 格式化时间函数
function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch (error) {
    console.error('时间格式化失败:', error);
    return isoString;
  }
}

const newses = computed<NewsItem[]>(() =>
  eventsData.value
    .slice(0, 10) // 只取前10条
    .map((event, index) => ({
      id: index + 1,
      content: event.event_message,
      time: formatTime(event.event_time),
      type: event.event_type
    }))
);

async function fetchData() {
  try {
    loading.value = true;
    const { data } = await fetchEvents();
    eventsData.value = data?.events || [];
  } catch (error) {
    console.error('获取项目动态失败:', error);
    eventsData.value = [];
  } finally {
    loading.value = false;
  }
}

// 获取事件类型对应的颜色
function getEventTypeColor(type: string) {
  const colorMap: Record<string, string> = {
    file: '#409eff',
    task: '#67c23a',
    system: '#909399',
    warning: '#e6a23c',
    error: '#f56c6c'
  };
  return colorMap[type] || '#909399';
}

onMounted(() => {
  fetchData();
});
</script>

<template>
  <ElCard v-loading="loading" class="h-500px card-wrapper">
    <template #header>
      <ElRow>
        <ElCol :span="18">{{ $t('page.home.projectNews.title') }}</ElCol>
        <ElCol :span="6" class="text-right">
          <a class="text-primary" href="javascript:;" @click="fetchData">{{ $t('page.home.projectNews.moreNews') }}</a>
        </ElCol>
      </ElRow>
    </template>
    <div class="timeline-container">
      <div v-if="newses.length === 0 && !loading" class="py-8 text-center text-gray-500">
        {{ $t('common.noData') }}
      </div>
      <ElTimeline v-else>
        <ElTimelineItem
          v-for="item in newses"
          :key="item.id"
          :timestamp="item.time"
          placement="top"
          :color="getEventTypeColor(item.type)"
        >
          <ElSpace>
            <ElTag :color="getEventTypeColor(item.type)" effect="light" size="small">
              {{ item.type }}
            </ElTag>
            <p>{{ item.content }}</p>
          </ElSpace>
        </ElTimelineItem>
      </ElTimeline>
    </div>
  </ElCard>
</template>

<style scoped>
.timeline-container {
  height: 380px;
  overflow-y: auto;
  padding-right: 8px;
}

.timeline-container::-webkit-scrollbar {
  width: 6px;
}

.timeline-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.timeline-container::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.timeline-container::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
