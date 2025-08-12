<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  type TaskDetail,
  type TaskStatus,
  type TaskUnit,
  fetchTaskDetail,
  restartTask,
  stopTask
} from '@/service/api/task';

// -- Props and Emits --
const props = defineProps<{
  modelValue: boolean; // 用于 v-model 控制对话框显示/隐藏
  taskId: number | null; // 接收要显示详情的任务ID
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'task-restarted'): void; // 当任务重启成功时，通知父组件刷新列表
}>();

const loading = ref(false);
const taskDetails = ref<TaskDetail | null>(null);

const isDialogVisible = computed({
  get: () => props.modelValue,
  set: val => emit('update:modelValue', val)
});

watch(
  () => props.taskId,
  newId => {
    if (newId && isDialogVisible.value) {
      getTaskDetails(newId);
    }
  }
);

watch(isDialogVisible, isVisible => {
  if (isVisible && props.taskId) {
    getTaskDetails(props.taskId);
  } else {
    // 清理数据当对话框关闭时
    taskDetails.value = null;
  }
});

function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
    .format(date)
    .replace(/\//g, '-');
}

const getStatusTagType = (
  status: TaskStatus | TaskUnit['status']
): 'success' | 'primary' | 'danger' | 'warning' | 'info' => {
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

const canBeStopped = computed(() => taskDetails.value?.status === 'RUNNING' || taskDetails.value?.status === 'PENDING');
const canBeRestarted = computed(() => ['SUCCESS', 'FAILED', 'CANCELLED'].includes(taskDetails.value?.status || ''));

async function getTaskDetails(id: number) {
  loading.value = true;
  taskDetails.value = null; // 先清空旧数据
  try {
    const { data } = await fetchTaskDetail(id);
    taskDetails.value = data;
  } catch (error) {
    ElMessage.error('获取任务详情失败');
    console.error(error);
    isDialogVisible.value = false; // 获取失败时自动关闭对话框
  } finally {
    loading.value = false;
  }
}

async function handleStopTask() {
  if (!props.taskId) return;
  try {
    await ElMessageBox.confirm('您确定要中断此任务吗？此操作不可逆。', '警告', { type: 'warning' });
    loading.value = true;
    const res = await stopTask(props.taskId);
    ElMessage.success(res.data?.message);
    await getTaskDetails(props.taskId); // 重新加载数据以更新状态
    isDialogVisible.value = false;
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('中断任务失败');
      console.error(error);
    }
  } finally {
    loading.value = false;
  }
}

async function handleRestartTask() {
  if (!props.taskId) return;
  try {
    await ElMessageBox.confirm('您确定要重新启动此任务吗？', '确认', { type: 'info' });
    loading.value = true;
    const res = await restartTask(props.taskId);
    ElMessage.success(res.data?.message);
    // 通知父组件任务已重启，父组件应刷新列表
    emit('task-restarted');
    // 关闭当前对话框
    isDialogVisible.value = false;
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('重启任务失败');
      console.error(error);
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <ElDialog
    v-model="isDialogVisible"
    :title="`任务详情：${taskId}`"
    width="70%"
    top="5vh"
    :close-on-click-modal="false"
  >
    <div v-loading="loading" style="min-height: 200px">
      <div v-if="taskDetails">
        <!-- 任务基本信息 -->
        <ElDescriptions :column="2" border>
          <template #title>
            <span class="text-lg font-semibold">基本信息</span>
          </template>
          <template #extra>
            <div class="space-x-2">
              <ElButton type="danger" :disabled="!canBeStopped" @click="handleStopTask">中断任务</ElButton>
              <ElButton type="primary" :disabled="!canBeRestarted" @click="handleRestartTask">重启任务</ElButton>
            </div>
          </template>
          <ElDescriptionsItem label="任务流名称">{{ taskDetails.process_name }}</ElDescriptionsItem>
          <ElDescriptionsItem label="文件名">{{ taskDetails.file_name }}</ElDescriptionsItem>
          <ElDescriptionsItem label="启动时间">{{ formatDateTime(taskDetails.start_time) }}</ElDescriptionsItem>
          <ElDescriptionsItem label="结束时间">{{ formatDateTime(taskDetails.end_time) }}</ElDescriptionsItem>
          <ElDescriptionsItem label="运行状态" :span="2">
            <ElTag :type="getStatusTagType(taskDetails.status)">{{ taskDetails.status }}</ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="错误摘要" :span="2">
            {{ taskDetails.error_summary || '-' }}
          </ElDescriptionsItem>
        </ElDescriptions>

        <!-- 任务执行单元详情 -->
        <div class="mt-6">
          <h3 class="mb-3 text-lg font-semibold">执行细节</h3>
          <ElTable :data="taskDetails.result_json" stripe border max-height="40vh">
            <ElTableColumn prop="unit_name" label="任务单元" min-width="200" />
            <ElTableColumn label="开始时间" min-width="180">
              <template #default="{ row }">{{ formatDateTime(row.start_time) }}</template>
            </ElTableColumn>
            <ElTableColumn label="结束时间" min-width="180">
              <template #default="{ row }">{{ formatDateTime(row.end_time) }}</template>
            </ElTableColumn>
            <ElTableColumn prop="duration" label="已运行时间" width="120" />
            <ElTableColumn label="状态" width="120">
              <template #default="{ row }">
                <ElTag :type="getStatusTagType(row.status)">{{ row.status }}</ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="error_message" label="错误信息" min-width="250">
              <template #default="{ row }">{{ row.error_message || '-' }}</template>
            </ElTableColumn>
          </ElTable>
        </div>
      </div>
      <ElEmpty v-else-if="!loading" description="未能加载任务详情" />
    </div>
  </ElDialog>
</template>
