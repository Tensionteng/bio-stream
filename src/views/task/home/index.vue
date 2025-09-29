<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router'; // 导入 useRouter
import { ElCard, ElCol, ElIcon, ElRow } from 'element-plus';
import { CollectionTag, Cpu } from '@element-plus/icons-vue';
import { type ProcessListItem, fetchProcessList } from '@/service/api/task'; // 确认路径正确

const loadingProcesses = ref(false);
const processList = ref<ProcessListItem[]>([]);
const router = useRouter();

// 点击卡片时，跳转到新的动态路由页面
function handleProcessSelect(process: ProcessListItem) {
  router.push({
    path: `/task/create/${process.process_id}`,
    query: {
      name: process.name
    }
  });
}

async function getProcessList() {
  loadingProcesses.value = true;
  try {
    const response = await fetchProcessList();
    processList.value = response.data ?? [];
  } catch (error) {
    console.error('Failed to fetch process list:', error);
  } finally {
    loadingProcesses.value = false;
  }
}

onMounted(() => {
  getProcessList();
});
</script>

<template>
  <div class="create-task-page">
    <ElCard class="step-card" shadow="never">
      <template #header>
        <div class="card-header">
          <ElIcon class="header-icon"><CollectionTag /></ElIcon>
          <span>第一步：选择分析流程</span>
        </div>
      </template>

      <div v-loading="loadingProcesses" class="process-grid-container">
        <ElRow :gutter="20">
          <!-- 修改后：将 lg 的值从 6 改为 8 -->
          <ElCol v-for="process in processList" :key="process.process_id" :xs="24" :sm="12" :md="8" :lg="6">
            <div class="process-card" @click="handleProcessSelect(process)">
              <div class="process-card-header">
                <ElIcon class="process-icon" :size="24"><Cpu /></ElIcon>
                <h3 class="process-name">{{ process.name }}</h3>
              </div>
              <div class="step-container">
                <p class="step-count">共 {{ process.description.total_units }} 个步骤</p>
                <ElScrollbar class="step-scrollbar">
                  <ul class="step-list">
                    <ElPopover
                      v-for="unit in process.description.execution_units"
                      :key="unit.name"
                      placement="right"
                      :title="unit.name"
                      :width="300"
                      trigger="hover"
                    >
                      <template #reference>
                        <li class="step-item">
                          {{ unit.name }}
                        </li>
                      </template>
                      <div class="popover-content">{{ unit.description }}</div>
                    </ElPopover>
                  </ul>
                </ElScrollbar>
              </div>
            </div>
          </ElCol>
        </ElRow>
      </div>
    </ElCard>
  </div>
</template>

<style scoped>
/* 页面整体布局 */
.create-task-page {
  padding: 20px;
  background-color: var(--el-bg-color-page);
}

/* 步骤卡片（容器）样式 */
.step-card {
  margin-bottom: 20px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

/* 卡片头部通用样式 */
.card-header {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.header-icon {
  margin-right: 8px;
  font-size: 18px;
  color: var(--el-color-primary);
}

/* --- 流程选择卡片网格 --- */
.process-grid-container {
  padding: 10px 0;
}

.process-card {
  min-height: 350px;
  max-height: 400px;
  padding: 20px;
  border-radius: 8px;
  border: 2px solid var(--el-border-color-light);
  background-color: var(--el-bg-color);
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  margin-bottom: 20px;
}

.process-card:hover {
  transform: translateY(-5px);
  box-shadow: var(--el-box-shadow-light);
  border-color: var(--el-color-primary-light-5);
}

.process-card.is-selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 4px 12px rgba(var(--el-color-primary-rgb), 0.2);
  background-color: var(--el-color-primary-light-9);
}

/* --- 卡片内部内容样式 --- */
.process-card-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.process-icon {
  margin-right: 12px;
  color: var(--el-color-primary);
}

.process-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.step-container {
  margin-top: 8px;
  flex-grow: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.step-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin: 0 0 8px;
  text-align: left;
}

/* 确保滚动容器有明确的高度限制（当前代码已有，但可加强） */
.step-scrollbar {
  flex-grow: 1;
  height: 0; /* 配合flex-grow，强制容器高度由父元素分配 */
}

.step-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.step-item {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  padding: 10px 8px;
  border-radius: 6px;
  margin-bottom: 8px;
  background-color: #fff;
  border: 1px solid var(--el-border-color-lighter);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: help;
  transition: all 0.2s ease-in-out;
}

.step-item:hover {
  transform: translateX(4px);
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.popover-content {
  color: #606266;
  font-size: 14px;
  line-height: 1.6;
}

.step-scrollbar :deep(::-webkit-scrollbar) {
  width: 6px;
}

/* 直接为滑块设置一个可见的背景色 */
.step-scrollbar :deep(::-webkit-scrollbar-thumb) {
  border-radius: 3px;
  background-color: #dcdfe6; /* 例如使用这个灰色 */
}

.step-scrollbar :deep(::-webkit-scrollbar-thumb:hover) {
  background-color: #c0c4cc;
}
</style>
