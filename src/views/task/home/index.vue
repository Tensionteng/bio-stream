<script setup lang="ts">
// --- 核心依赖导入 ---
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router'; // 导入 Vue Router 的 useRouter hook，用于编程式导航
import { ElCard, ElCol, ElIcon, ElPopover, ElRow, ElScrollbar } from 'element-plus'; // 导入 Element Plus UI 组件
import { CollectionTag, Cpu } from '@element-plus/icons-vue'; // 导入图标
import { type ProcessListItem, fetchProcessList } from '@/service/api/task'; // 导入 API 请求函数和相关 TypeScript 类型

// --- 组件状态定义 ---
const loadingProcesses = ref(false); // 控制是否显示加载状态的布尔值
const processList = ref<ProcessListItem[]>([]); // 存储从 API 获取的分析流程列表
const router = useRouter(); // 初始化 router 实例

/**
 * 处理用户选择一个分析流程的点击事件
 *
 * @param {ProcessListItem} process - 用户点击的流程对象
 */
function handleProcessSelect(process: ProcessListItem) {
  // 使用 router.push 进行页面跳转
  router.push({
    // 跳转到动态路由，其中 :id 将被 process.process_id 替换
    path: `/task/create/${process.process_id}`,
    // 通过 query 参数传递流程名称，以便在下一个页面显示
    query: {
      name: process.name
    }
  });
}

/** 异步函数，用于从服务器获取所有可用的分析流程列表 */
async function getProcessList() {
  loadingProcesses.value = true; // 开始加载，显示 loading 动画
  try {
    const response = await fetchProcessList();
    // 将获取到的数据赋值给 processList，如果数据为空则赋值为空数组
    processList.value = response.data ?? [];
  } catch (error) {
    // 如果请求失败，在控制台打印错误信息
    console.error('Failed to fetch process list:', error);
  } finally {
    // 无论成功还是失败，都结束加载状态
    loadingProcesses.value = false;
  }
}

// --- 生命周期钩子 ---
// onMounted 会在组件挂载到 DOM 后执行
onMounted(() => {
  getProcessList(); // 调用函数，获取流程列表数据
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
  transform: translateY(-5px); /* 鼠标悬浮时轻微上移 */
  box-shadow: var(--el-box-shadow-light); /* 添加阴影效果 */
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
  white-space: nowrap; /* 防止文本换行 */
  overflow: hidden; /* 隐藏超出部分 */
  text-overflow: ellipsis; /* 超出部分显示省略号 */
}

.step-container {
  margin-top: 8px;
  flex-grow: 1; /* 占据剩余空间 */
  overflow: hidden; /* 隐藏内部溢出的内容 */
  display: flex;
  flex-direction: column;
  min-height: 0; /* 修正 flex 布局在某些浏览器中的高度计算问题 */
}

.step-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin: 0 0 8px;
  text-align: left;
}

.step-scrollbar {
  flex-grow: 1; /* 确保滚动条容器能填满父容器的剩余空间 */
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
  cursor: help; /* 提示用户此处可交互（查看详情） */
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

/* --- 自定义滚动条样式 --- */
.step-scrollbar :deep(::-webkit-scrollbar) {
  width: 6px;
}

.step-scrollbar :deep(::-webkit-scrollbar-thumb) {
  border-radius: 3px;
  background-color: #dcdfe6;
}

.step-scrollbar :deep(::-webkit-scrollbar-thumb:hover) {
  background-color: #c0c4cc;
}
</style>
