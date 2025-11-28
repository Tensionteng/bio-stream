<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Document, Search, View } from '@element-plus/icons-vue';
import { type TaskListItem, type TaskListParams, type TaskStatus, fetchTaskList } from '@/service/api/task';
import TaskDetailDialog from './components/TaskDetailDialog.vue';

// -- 状态定义 --
const loading = ref(false);
const tasks = ref<TaskListItem[]>([]);

// -- 筛选状态 --
const filterParams = reactive({
  id: undefined as number | undefined,
  process_name: '',
  status: '' as TaskStatus | ''
});

// 对话框控制
const isDetailDialogVisible = ref(false);
const selectedTaskId = ref<number | null>(null);

// -- 筛选选项 --
const statusOptions = [
  { label: '运行中', value: 'RUNNING' },
  { label: '成功', value: 'SUCCESS' },
  { label: '失败', value: 'FAILED' },
  { label: '已取消', value: 'CANCELLED' },
  { label: '等待中', value: 'PENDING' }
];

// -- 时间格式化 --
function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    // 1. 修复 unused-vars: 移除未使用的 error
    return isoString;
  }
}

// -- 状态标签样式 (修复：忽略大小写) --
const statusTagType = (status: string | TaskStatus | undefined | null) => {
  if (!status) return 'info';

  // 核心修改：强制转换为大写进行比对
  const upperStatus = status.toString().toUpperCase();

  switch (upperStatus) {
    case 'SUCCESS':
      return 'success';
    case 'RUNNING':
      return 'primary';
    case 'FAILED':
      return 'danger';
    case 'CANCELLED':
      return 'info';
    case 'PENDING':
      return 'warning';
    default:
      return 'info';
  }
};

// -- 分页状态 --
const pagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0
});

// -- 数据获取 --
async function getTasks() {
  loading.value = true;
  try {
    const params: TaskListParams = {
      page: pagination.page,
      page_size: pagination.pageSize,
      status: filterParams.status || undefined,
      name: filterParams.process_name || undefined
    };

    const { data } = await fetchTaskList(params);
    if (data) {
      tasks.value = data.results || [];
      pagination.itemCount = data.count || 0;
    }
  } catch {
    // 2. 修复 unused-vars: 移除未使用的 error
    ElMessage.error('获取任务列表失败');
  } finally {
    loading.value = false;
  }
}

// -- 事件处理 --
function handlePageChange(currentPage: number) {
  pagination.page = currentPage;
  getTasks();
}

function handleSizeChange(pageSize: number) {
  pagination.pageSize = pageSize;
  pagination.page = 1;
  getTasks();
}

function handleSearch() {
  pagination.page = 1;
  getTasks();
}

function handleReset() {
  filterParams.id = undefined;
  filterParams.process_name = '';
  filterParams.status = '';
  handleSearch();
}

function showDetailsDialog(taskId: number) {
  selectedTaskId.value = taskId;
  isDetailDialogVisible.value = true;
}

function handleTaskRestarted() {
  isDetailDialogVisible.value = false;
  getTasks();
}

onMounted(() => {
  getTasks();
});
</script>

<template>
  <div class="page-container">
    <ElCard shadow="never" class="main-card">
      <template #header>
        <div class="card-header">
          <span>任务列表</span>
        </div>
      </template>

      <ElForm :model="filterParams" inline class="filter-bar" @submit.prevent="handleSearch">
        <ElFormItem label="任务ID">
          <ElInput
            v-model.number="filterParams.id"
            class="filter-input"
            placeholder="按ID搜索"
            clearable
            @clear="handleSearch"
          />
        </ElFormItem>

        <ElFormItem label="流程名称">
          <ElInput
            v-model="filterParams.process_name"
            class="filter-input"
            placeholder="按名称搜索"
            clearable
            @clear="handleSearch"
          />
        </ElFormItem>

        <ElFormItem label="状态">
          <ElSelect
            v-model="filterParams.status"
            class="filter-input filter-select"
            placeholder="选择状态"
            clearable
            @change="handleSearch"
          >
            <ElOption v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </ElSelect>
        </ElFormItem>

        <ElFormItem>
          <ElButton class="filter-primary-btn" type="primary" native-type="submit" :loading="loading">
            <ElIcon><Search /></ElIcon>
            查询
          </ElButton>
          <ElButton class="filter-ghost-btn" @click="handleReset">重置</ElButton>
        </ElFormItem>
      </ElForm>

      <!-- 3. 修复 static inline style: 使用 class -->
      <ElTable v-loading="loading" :data="tasks" class="full-width-table" empty-text="暂无任务数据">
        <ElTableColumn prop="id" label="ID" width="90" align="center">
          <template #default="{ row }">
            <span class="text-mono">#{{ row.id }}</span>
          </template>
        </ElTableColumn>

        <ElTableColumn prop="process_name" label="流程名称 (Process)" min-width="150">
          <template #default="{ row }">
            <span class="text-gray-700 font-medium">{{ row.process_name }}</span>
          </template>
        </ElTableColumn>

        <ElTableColumn prop="file_ids" label="文件ID (File IDs)" min-width="150">
          <template #default="{ row }">
            <div v-if="Array.isArray(row.file_ids) && row.file_ids.length" class="file-info">
              <ElIcon class="file-icon"><Document /></ElIcon>
              <span class="file-ids-text">{{ row.file_ids.join(', ') }}</span>
            </div>
            <span v-else class="text-muted">-</span>
          </template>
        </ElTableColumn>

        <ElTableColumn prop="start_time" label="开始时间 (Start Time)" min-width="170">
          <template #default="{ row }">
            <span class="text-gray-600">{{ formatDateTime(row.start_time) }}</span>
          </template>
        </ElTableColumn>

        <ElTableColumn prop="end_time" label="结束时间 (End Time)" min-width="170">
          <template #default="{ row }">
            <span v-if="row.end_time" class="text-gray-600">{{ formatDateTime(row.end_time) }}</span>
            <span v-else class="font-small text-blue-400">进行中...</span>
          </template>
        </ElTableColumn>

        <ElTableColumn prop="status" label="状态 (Status)" width="120" align="center">
          <template #default="{ row }">
            <ElTag :type="statusTagType(row.status)" effect="plain" round size="small" class="status-tag">
              {{ row.status }}
            </ElTag>
          </template>
        </ElTableColumn>

        <ElTableColumn label="操作" width="120" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-buttons">
              <ElButton type="primary" link class="action-btn is-view" @click="showDetailsDialog(row.id)">
                <ElIcon><View /></ElIcon>
                <span>详情</span>
              </ElButton>
            </div>
          </template>
        </ElTableColumn>
      </ElTable>

      <div class="pagination-container">
        <ElPagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="pagination.itemCount"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </ElCard>

    <TaskDetailDialog v-model="isDetailDialogVisible" :task-id="selectedTaskId" @task-restarted="handleTaskRestarted" />
  </div>
</template>

<style scoped>
/* --- 全局容器 --- */
.page-container {
  padding: 24px 28px 32px;
  background: #f5f7fb;
  min-height: calc(100vh - 64px);
  box-sizing: border-box;
}

/* --- 卡片 --- */
.main-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.04);
}

:deep(.el-card__header) {
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
}

.card-header {
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 16px;
  color: #303133;
}

.card-header::before {
  content: '';
  width: 4px;
  height: 18px;
  border-radius: 999px;
  margin-right: 8px;
  background: linear-gradient(180deg, #409eff, #66b1ff);
}

/* --- 筛选栏 --- */
.filter-bar {
  margin-bottom: 16px;
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.filter-input {
  width: 200px;
}
.filter-select {
  width: 160px;
}

/* 胶囊输入框 */
.filter-input :deep(.el-input__wrapper),
.filter-input :deep(.el-select__wrapper) {
  border-radius: 999px;
  border-color: #c0d3ff;
  box-shadow: 0 0 0 0 rgba(92, 124, 255, 0.15);
  background: #ffffff;
  transition: all 0.18s ease;
  padding-left: 16px;
}

.filter-input :deep(.el-input__wrapper:hover),
.filter-input :deep(.el-select__wrapper:hover) {
  border-color: #8c9dff;
  box-shadow: 0 0 0 1px rgba(140, 157, 255, 0.25) inset;
}

.filter-input :deep(.el-input__wrapper.is-focus),
.filter-input :deep(.el-select__wrapper.is-focused) {
  border-color: #5c7cff;
  box-shadow:
    0 0 0 1px rgba(92, 124, 255, 0.4) inset,
    0 0 10px rgba(92, 124, 255, 0.25);
}

.filter-primary-btn {
  min-width: 96px;
  height: 34px;
  border-radius: 999px;
  border: none;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 1px;
  background-image: linear-gradient(135deg, #8c9dff, #5c7cff);
  box-shadow: 0 6px 14px rgba(92, 124, 255, 0.35);
  color: #fff;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.filter-primary-btn:hover {
  transform: translateY(-1px);
  background-image: linear-gradient(135deg, #7b90ff, #4c6dff);
}

.filter-ghost-btn {
  min-width: 78px;
  height: 34px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid #d0d5eb;
  background: #ffffff;
  color: #606266;
  margin-left: 12px;
}
.filter-ghost-btn:hover {
  background: #f5f7ff;
  border-color: #b9c6ff;
  color: #3a57d5;
}

/* --- 表格样式 --- */
/* 新增：替代 inline style */
.full-width-table {
  width: 100%;
}

:deep(.el-table) {
  --el-table-header-bg-color: #f5f7fa;
  --el-table-row-hover-bg-color: #f0f9ff;
  --el-table-border-color: #ebeef5;
  font-size: 13px;
}
:deep(.el-table__header-wrapper th) {
  font-weight: 600;
  color: #606266;
  height: 50px;
}
:deep(.el-table__row) {
  transition: all 0.15s ease;
}
:deep(.el-table__row:hover) {
  transform: translateY(-1px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.02);
  z-index: 1;
  position: relative;
}

/* --- 列内容细节 --- */
.text-muted {
  color: #909399;
  font-size: 12px;
}
.text-mono {
  font-family: 'JetBrains Mono', Consolas, monospace;
  color: #909399;
}
.text-blue-400 {
  color: #409eff;
}
.font-small {
  font-size: 12px;
}

/* 文件列 */
.file-info {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #606266;
  background: #f8f9fb;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #ebeef5;
  display: inline-flex;
  max-width: 100%;
}
.file-icon {
  color: #909399;
}
.file-ids-text {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 状态标签 */
.status-tag {
  border: none;
  font-weight: 500;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  justify-content: center;
}
.action-btn {
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;
  height: auto;
}
.action-btn.is-view {
  color: #409eff;
}
.action-btn.is-view:hover {
  background-color: #ecf5ff;
}

/* 分页 */
.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
