<script setup lang="ts">
// 导入Vue的核心功能，如computed（计算属性）、ref（响应式引用）和watch（侦听器）。
import { computed, ref, watch } from 'vue';
// 导入Element Plus组件库中的消息提示和确认对话框功能。
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
// 从后端服务接口定义文件中导入类型和API请求函数。
import {
  type TaskDetail, // 导入任务详情的数据类型定义。
  fetchTaskDetail, // 导入获取任务详情的API函数。
  restartTask, // 导入重启任务的API函数。
  reuploadTaskFiles, // 导入触发文件重新上传的API函数。
  stopTask // 导入中断任务的API函数。
} from '@/service/api/task';
import TaskFlow from './TaskFlow.vue';
// -- Props and Emits --
// 定义组件接收的属性（Props），这里接收v-model绑定的modelValue（控制对话框显示/隐藏）和任务ID（taskId）。
const props = defineProps<{
  modelValue: boolean;
  taskId: number | null;
}>();

// 定义组件可以触发的自定义事件（Emits），用于更新v-model的值和通知父组件任务已重启。
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void; // 更新v-model
  (e: 'task-restarted'): void; // 任务重启事件
}>();

// -- State Management --
// 定义一个响应式变量loading，用于控制加载状态的显示。
const loading = ref(false);
// 定义一个响应式变量taskDetails，用于存储从API获取的任务详情数据。
const taskDetails = ref<TaskDetail | null>(null);

// -- Computed Properties (计算属性) --
// 创建一个计算属性isDialogVisible，它将props.modelValue与组件内部状态同步，实现v-model的双向绑定。
const isDialogVisible = computed({
  get: () => props.modelValue,
  set: val => emit('update:modelValue', val)
});
// 一个计算属性，用于获取流程图数据
const flowNodes = computed(() => {
  // 从 taskDetails 中获取后端处理好的 execution_flow 数组，并将 message 为 null 的转换为 undefined
  return (taskDetails.value?.execution_flow || []).map((node: any) => ({
    ...node,
    message: node.message === null ? undefined : node.message
  }));
});
// --- Watchers (侦听器) ---
// 侦听taskId的变化。如果taskId变了并且对话框是可见的，就重新获取任务详情。
watch(
  () => props.taskId,
  newId => {
    if (newId && isDialogVisible.value) {
      getTaskDetails(newId);
    }
  }
);

// 侦听对话框的可见性变化。
watch(isDialogVisible, isVisible => {
  if (isVisible && props.taskId) {
    // 如果对话框变为可见，并且有taskId，则加载任务详情。
    getTaskDetails(props.taskId);
  } else {
    // 如果对话框关闭，则清空任务详情数据，以便下次打开时重新加载。
    taskDetails.value = null;
  }
});

// --- Computed Properties (计算属性) ---
// 将任务详情中的执行单元（execution_units）对象转换为一个数组，方便在表格中渲染。
const taskUnitsArray = computed(() => {
  if (!taskDetails.value?.execution_flow) {
    return [];
  }
  const units = taskDetails.value.result_json.execution_units;
  // 使用Object.values将对象的值转换为数组，并映射成表格需要的数据结构。
  return Object.values(units).map(unit => ({
    unit_name: unit.name,
    start_time: unit.start_time,
    end_time: unit.end_time,
    duration: calculateDuration(unit.start_time, unit.end_time),
    status: unit.status.toUpperCase(),
    message: unit.message,
    description: unit.description,
    type: unit.type
  }));
});

// 计算“中断任务”按钮是否应该可用。只有在任务是“运行中”或“等待中”时才能中断。
const canBeStopped = computed(() => {
  const status = taskDetails.value?.status?.toUpperCase();
  return status === 'RUNNING' || status === 'PENDING';
});

// 计算“重启任务”按钮是否应该可用。只有在任务是“失败”或“已取消”时才能重启。
// 注：根据您的代码，这里包括了'PENDING'，如果不需要请移除。
const canBeRestarted = computed(() => {
  const status = taskDetails.value?.status?.toUpperCase() || '';
  return ['FAILED', 'PENDING'].includes(status);
});

// 计算“重新上传”按钮是否应该可用。只有当上传状态存在且不为'SUCCESS'时，才允许点击。
const canBeReuploaded = computed(() => {
  if (!taskDetails.value) return false;
  const uploadStatus = taskDetails.value.upload_status?.toUpperCase();
  return Boolean(uploadStatus) && uploadStatus !== 'SUCCESS';
});

// --- Helper Functions (辅助函数) ---
// 格式化ISO 8601日期时间字符串为本地化的、易读的格式（例如 '2025-08-29 16:22:58'）。
function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat('zh-CN', {
    /* ... format options ... */
  })
    .format(date)
    .replace(/\//g, '-');
}

// 计算开始时间和结束时间之间的时长，并格式化为"Xd Yh Zm Ws"的字符串。
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

// 根据状态字符串返回对应的Element Plus标签类型（'success', 'danger'等），用于UI颜色区分。
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

// 根据上传状态字符串，返回一个包含标签类型和显示文本的对象。
const getUploadStatusInfo = (status: string | null) => {
  if (!status) return { type: 'info' as const, text: '未知' };
  switch (status.toUpperCase()) {
    case 'SUCCESS':
      return { type: 'success' as const, text: '上传成功' };
    case 'FAILED':
      return { type: 'danger' as const, text: '上传失败' };
    case 'RUNNING':
      return { type: 'primary' as const, text: '上传中' };
    case 'PENDING':
      return { type: 'warning' as const, text: '等待中' };
    default:
      return { type: 'info' as const, text: status };
  }
};

// --- API Calls (API调用逻辑) ---
// 异步函数：获取任务详情。
async function getTaskDetails(id: number) {
  loading.value = true; // 开始加载
  taskDetails.value = null; // 清空旧数据
  try {
    const detailRes = await fetchTaskDetail(id); // 调用API
    taskDetails.value = detailRes.data as TaskDetail; // 将返回的数据存入响应式变量
  } catch (error) {
    ElMessage.error('获取任务详情失败'); // 显示错误提示
    console.error(error);
    isDialogVisible.value = false; // 出错时关闭对话框
  } finally {
    loading.value = false; // 结束加载
  }
}

// 异步函数：处理中断任务的点击事件。
async function handleStopTask() {
  if (!props.taskId) return;
  try {
    // 弹出确认框，防止误操作。
    await ElMessageBox.confirm('您确定要中断此任务吗？此操作不可逆。', '警告', { type: 'warning' });
    loading.value = true;
    const res = await stopTask(props.taskId); // 调用中断API
    ElMessage.success(res.data?.message || '操作成功');
    await getTaskDetails(props.taskId); // 操作成功后刷新详情
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('中断任务失败'); // 用户点击取消时不提示错误
  } finally {
    loading.value = false;
  }
}

// 异步函数：处理重启任务的点击事件。
async function handleRestartTask() {
  if (!props.taskId) return;
  try {
    await ElMessageBox.confirm('您确定要重新启动此任务吗？', '确认', { type: 'info' });
    loading.value = true;
    const res = await restartTask(props.taskId); // 调用重启API
    ElMessage.success(res.data?.message || '操作成功');
    emit('task-restarted'); // 触发事件，通知父组件
    isDialogVisible.value = false; // 关闭对话框
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('重启任务失败');
  } finally {
    loading.value = false;
  }
}

// 异步函数：处理重新上传的点击事件。
async function handleReupload() {
  if (!props.taskId) return;
  try {
    await ElMessageBox.confirm('文件上传状态异常，您确定要重新触发上传吗？', '确认上传', { type: 'info' });
    loading.value = true;
    await reuploadTaskFiles(props.taskId); // 调用重新上传API
    ElMessage.success('重新上传任务已成功触发');
    await getTaskDetails(props.taskId); // 触发后刷新详情，以获取最新的上传状态
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('重新上传失败');
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
    width="90%"
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
              <ElButton type="warning" :disabled="!canBeReuploaded" @click="handleReupload">重新上传</ElButton>
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

          <ElDescriptionsItem label="最终文件上传状态" :span="2">
            <ElTag v-if="taskDetails.upload_status" :type="getUploadStatusInfo(taskDetails.upload_status).type">
              {{ getUploadStatusInfo(taskDetails.upload_status).text }}
            </ElTag>
            <span v-else>-</span>
          </ElDescriptionsItem>

          <ElDescriptionsItem label="启动时间">{{ formatDateTime(taskDetails.start_time) }}</ElDescriptionsItem>
          <ElDescriptionsItem label="结束时间">{{ formatDateTime(taskDetails.end_time) }}</ElDescriptionsItem>
          <ElDescriptionsItem v-if="taskDetails.total_units !== undefined" label="任务单元">
            {{ taskDetails.success_units }} / {{ taskDetails.total_units }}
          </ElDescriptionsItem>
        </ElDescriptions>
        <div v-if="Array.isArray(flowNodes) && flowNodes.length > 0" class="mt-6 border rounded-lg p-4">
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-lg font-semibold">任务流程</h3>
            <ElButton
              :icon="Refresh"
              circle
              :loading="loading"
              :disabled="loading || !props.taskId"
              @click="props.taskId && getTaskDetails(props.taskId)"
            />
          </div>
          <TaskFlow :steps="flowNodes" />
        </div>
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
            <ElTableColumn prop="message" label="执行信息" min-width="400">
              <template #default="{ row }">{{ row.message || '-' }}</template>
            </ElTableColumn>
          </ElTable>
        </div>
      </div>
      <ElEmpty v-else-if="!loading" description="未能加载任务详情" />
    </div>
  </ElDialog>
</template>
