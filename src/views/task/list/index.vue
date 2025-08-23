<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { type TaskListItem, type TaskListParams, type TaskStatus, fetchTaskList } from '@/service/api/task';
// 1. 引入新的对话框组件
import TaskDetailDialog from './components/TaskDetailDialog.vue';

// -- 状态定义 --
const loading = ref(false);
const tasks = ref<TaskListItem[]>([]);
const filterStatus = ref<TaskStatus | ''>('');

// 2. 添加控制对话框所需的状态
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

// -- 时间格式化函数 --
function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) {
    return '-';
  }
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return isoString;
    }
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error('Error formatting date:', isoString, error);
    return isoString;
  }
}

// 根据任务状态返回对应的标签类型
const statusTagType = (status: TaskStatus): 'success' | 'primary' | 'danger' | 'warning' | 'info' => {
  switch (status) {
    case 'SUCCESS':
      return 'success';
    case 'RUNNING':
      return 'primary';
    case 'FAILED':
      return 'danger';
    case 'CANCELLED':
      return 'warning';
    case 'PENDING':
      return 'info';
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
      status: filterStatus.value || undefined
    };
    const { data } = await fetchTaskList(params);
    if (data) {
      console.log(data);
      tasks.value = data.results || [];
      pagination.itemCount = data.count || 0;
      console.log(tasks.value);
    }
  } catch (error) {
    ElMessage.error('获取任务列表失败');
    console.error('Failed to fetch task list:', error);
  } finally {
    loading.value = false;
  }
}

// -- 事件处理 --
function handlePageChange(currentPage: number) {
  pagination.page = currentPage;
  getTasks();
}

function handlePageSizeChange(pageSize: number) {
  pagination.pageSize = pageSize;
  pagination.page = 1;
  getTasks();
}

function handleFilter() {
  pagination.page = 1;
  getTasks();
}

// 3. 创建打开对话框的方法
function showDetailsDialog(taskId: number) {
  selectedTaskId.value = taskId;
  isDetailDialogVisible.value = true;
}

// 4. 创建一个方法来处理重启成功后的回调
function handleTaskRestarted() {
  // 当子组件通知任务重启后，关闭对话框并刷新列表
  isDetailDialogVisible.value = false;
  // 调用获取任务列表的方法
  getTasks();
}

// -- 生命周期钩子 --
onMounted(() => {
  getTasks();
});
</script>

<template>
  <div>
    <div class="p-4">
      <ElCard shadow="never" class="rounded-lg">
        <template #header>
          <div class="card-header">
            <span>任务列表</span>
          </div>
        </template>

        <!-- 筛选区域 -->
        <ElForm :inline="true" @submit.prevent>
          <ElFormItem label="状态筛选:">
            <ElSelect v-model="filterStatus" placeholder="请选择任务状态" clearable @change="handleFilter">
              <ElOption v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
            </ElSelect>
          </ElFormItem>
        </ElForm>

        <!-- 数据表格 -->
        <ElTable v-loading="loading" :data="tasks" stripe>
          <ElTableColumn prop="id" label="任务ID" width="100" />
          <ElTableColumn prop="process_name" label="任务流名称" min-width="180" />
          <ElTableColumn prop="file_ids" label="文件ID" width="100">
            <template #default="{ row }">
              {{ Array.isArray(row.file_ids) ? row.file_ids.join(', ') : '-' }}
            </template>
          </ElTableColumn>
          <ElTableColumn prop="start_time" label="启动时间" min-width="180">
            <template #default="{ row }">
              {{ formatDateTime(row.start_time) }}
            </template>
          </ElTableColumn>
          <ElTableColumn prop="end_time" label="结束时间" min-width="180">
            <template #default="{ row }">
              {{ formatDateTime(row.end_time) }}
            </template>
          </ElTableColumn>
          <ElTableColumn prop="status" label="运行状态" width="120">
            <template #default="{ row }">
              <ElTag :type="statusTagType(row.status)">{{ row.status }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn prop="error_summary" label="错误摘要" min-width="200">
            <template #default="{ row }">{{ row.error_summary || '-' }}</template>
          </ElTableColumn>
          <ElTableColumn label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <!-- 修改了这里的点击事件 -->
              <ElButton link type="primary" @click="showDetailsDialog(row.id)">查看详情</ElButton>
            </template>
          </ElTableColumn>
        </ElTable>

        <!-- 分页 -->
        <div class="mt-4 flex justify-end">
          <ElPagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :page-sizes="[10, 20, 50]"
            :total="pagination.itemCount"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handlePageSizeChange"
            @current-change="handlePageChange"
          />
        </div>
      </ElCard>
    </div>

    <!-- 5. 在 template 的末尾添加新的对话框组件 -->
    <TaskDetailDialog v-model="isDetailDialogVisible" :task-id="selectedTaskId" @task-restarted="handleTaskRestarted" />
  </div>
</template>
