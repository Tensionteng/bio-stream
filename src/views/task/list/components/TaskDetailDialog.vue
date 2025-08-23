<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { type TaskDetail, fetchTaskDetail, restartTask, stopTask } from '@/service/api/task';

// -- Props and Emits --
const props = defineProps<{
  modelValue: boolean;
  taskId: number | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'task-restarted'): void;
}>();

const loading = ref(false);
const taskDetails = ref<TaskDetail | null>(null);

const isDialogVisible = computed({
  get: () => props.modelValue,
  set: val => emit('update:modelValue', val)
});

// --- 监听器部分保持不变 ---
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
    taskDetails.value = null;
  }
});

// --- 核心逻辑：将 execution_units 对象转换为表格所需的数组 ---
const taskUnitsArray = computed(() => {
  if (!taskDetails.value?.result_json?.execution_units) {
    return [];
  }

  const units = taskDetails.value.result_json.execution_units;
  return Object.values(units).map(unit => ({
    unit_name: unit.name,
    start_time: unit.start_time,
    end_time: unit.end_time,
    duration: calculateDuration(unit.start_time, unit.end_time),
    status: unit.status.toUpperCase(), // 统一状态为大写以便处理
    message: unit.message,
    description: unit.description,
    type: unit.type
  }));
});

// --- 辅助函数 ---

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

function calculateDuration(start: string | null, end: string | null): string {
  if (!start) return '-';
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return '-';

  let diff = Math.abs(endTime - startTime) / 1000;
  const days = Math.floor(diff / 86400);
  diff -= days * 86400;
  const hours = Math.floor(diff / 3600) % 24;
  diff -= hours * 3600;
  const minutes = Math.floor(diff / 60) % 60;
  const seconds = Math.floor(diff % 60);

  let result = '';
  if (days > 0) result += `${days}d `;
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0) result += `${minutes}m `;
  result += `${seconds}s`;

  return result.trim();
}

// 统一将状态转为大写处理
const getStatusTagType = (status: string): 'success' | 'primary' | 'danger' | 'warning' | 'info' => {
  if (!status) return 'info';
  switch (status.toUpperCase()) {
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

const canBeStopped = computed(() => {
  const status = taskDetails.value?.status?.toUpperCase();
  return status === 'RUNNING' || status === 'PENDING';
});

const canBeRestarted = computed(() => {
  const status = taskDetails.value?.status?.toUpperCase() || '';
  return ['SUCCESS', 'FAILED', 'CANCELLED'].includes(status);
});

// --- API 调用逻辑保持不变 ---

async function getTaskDetails(id: number) {
  loading.value = true;
  taskDetails.value = null;
  try {
    const { data } = await fetchTaskDetail(id);
    taskDetails.value = data as TaskDetail;
  } catch (error) {
    ElMessage.error('获取任务详情失败');
    console.error(error);
    isDialogVisible.value = false;
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
    ElMessage.success(res.data?.message || '操作成功');
    await getTaskDetails(props.taskId);
    isDialogVisible.value = false;
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('中断任务失败');
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
    ElMessage.success(res.data?.message || '操作成功');
    emit('task-restarted');
    isDialogVisible.value = false;
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('重启任务失败');
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
        <ElDescriptions :column="3" border>
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
          <ElDescriptionsItem label="文件ID">
            {{ Array.isArray(taskDetails.file_ids) ? taskDetails.file_ids.join(', ') : '-' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="运行状态">
            <ElTag :type="getStatusTagType(taskDetails.status)">{{ taskDetails.status }}</ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="启动时间">{{ formatDateTime(taskDetails.start_time) }}</ElDescriptionsItem>
          <ElDescriptionsItem label="结束时间">{{ formatDateTime(taskDetails.end_time) }}</ElDescriptionsItem>
          <ElDescriptionsItem v-if="taskDetails.total_units !== undefined" label="任务单元">
            {{ taskDetails.success_units }} / {{ taskDetails.total_units }}
          </ElDescriptionsItem>
        </ElDescriptions>

        <div class="mt-6">
          <h3 class="mb-3 text-lg font-semibold">执行细节</h3>
          <ElTable :data="taskUnitsArray" stripe border max-height="40vh">
            <ElTableColumn type="expand">
              <template #default="{ row }">
                <div class="p-4">
                  <p>
                    <strong>描述:</strong>
                    {{ row.description }}
                  </p>
                  <p v-if="row.type">
                    <strong>类型:</strong>
                    {{ row.type }}
                  </p>
                </div>
              </template>
            </ElTableColumn>
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
            <ElTableColumn prop="message" label="执行信息" min-width="250">
              <template #default="{ row }">{{ row.message || '-' }}</template>
            </ElTableColumn>
          </ElTable>
        </div>
      </div>
      <ElEmpty v-else-if="!loading" description="未能加载任务详情" />
    </div>
  </ElDialog>
</template>
