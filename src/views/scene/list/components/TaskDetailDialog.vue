<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Collection, DocumentCopy, InfoFilled, Refresh, Upload } from '@element-plus/icons-vue';
import {
  type FileSchemaItem,
  type SelectFileUploadPayload,
  type TaskDetail,
  fetchFileSchemaList,
  fetchTaskDetail,
  restartTask,
  reuploadTaskFiles,
  stopTask,
  uploadTaskGeneratedFiles
} from '@/service/api/task';
import TaskFlow from './TaskFlow.vue';

// -- Props and Emits --
const props = defineProps<{
  modelValue: boolean;
  taskId: number | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  // 1. 修复命名规范 warning: task-restarted -> taskRestarted
  (e: 'taskRestarted'): void;
}>();

// -- State Management --
const loading = ref(false);
const taskDetails = ref<TaskDetail | null>(null);

// -- Upload Dialog State --
const isUploadDialogVisible = ref(false);
const uploadLoading = ref(false);
const uploadForm = reactive<SelectFileUploadPayload>({
  meta_file_id: undefined as unknown as number,
  files: []
});

// Meta File 下拉选项
const metaFileOptions = ref<FileSchemaItem[]>([]);
const metaFileLoading = ref(false);

// -- Computed Properties --
const isDialogVisible = computed({
  get: () => props.modelValue,
  set: val => emit('update:modelValue', val)
});

const flowNodes = computed(() => {
  return (taskDetails.value?.execution_flow || []).map((node: any) => ({
    ...node,
    message: node.message === null ? undefined : node.message,
    files: node.files
  }));
});

// 从任务详情中提取所有可用的输出文件列表
const availableTaskFiles = computed(() => {
  if (!taskDetails.value?.execution_flow) return [];

  const fileSet = new Set<string>();
  taskDetails.value.execution_flow.forEach(step => {
    if (Array.isArray(step.files)) {
      step.files.forEach(file => {
        if (file) fileSet.add(file);
      });
    }
  });

  return Array.from(fileSet).map(fileName => ({
    label: fileName,
    value: fileName
  }));
});

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
    status: unit.status ? unit.status.toUpperCase() : '',
    message: unit.message,
    description: unit.description,
    type: unit.type
  }));
});

// -- Button Status Logic --
const canBeStopped = computed(() => {
  const status = taskDetails.value?.status?.toUpperCase();
  return status === 'RUNNING' || status === 'PENDING';
});

const canBeRestarted = computed(() => {
  const status = taskDetails.value?.status?.toUpperCase() || '';
  return ['FAILED', 'PENDING', 'CANCELLED'].includes(status);
});

const canBeReuploaded = computed(() => {
  if (!taskDetails.value) return false;
  const uploadStatus = taskDetails.value.upload_status?.toUpperCase();
  return Boolean(uploadStatus) && uploadStatus !== 'SUCCESS';
});

// -- Watchers --
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

// -- Helper Functions --
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

// -- API Calls --
async function getTaskDetails(id: number) {
  loading.value = true;
  taskDetails.value = null;
  try {
    const detailRes = await fetchTaskDetail(id);
    taskDetails.value = detailRes.data as TaskDetail;
  } catch {
    // 2. 修复 unused-vars: 移除未使用的 error 参数
    ElMessage.error('获取任务详情失败');
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
    // 修复事件名称
    emit('taskRestarted');
    isDialogVisible.value = false;
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('重启任务失败');
  } finally {
    loading.value = false;
  }
}

async function handleReupload() {
  if (!props.taskId) return;
  try {
    await ElMessageBox.confirm('文件上传状态异常，您确定要重新触发上传吗？', '确认上传', { type: 'info' });
    loading.value = true;
    await reuploadTaskFiles(props.taskId);
    ElMessage.success('重新上传任务已成功触发');
    await getTaskDetails(props.taskId);
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('重新上传失败');
  } finally {
    loading.value = false;
  }
}

// -- Manual Upload Logic --

// 打开弹窗时，加载 Schema 列表
async function handleOpenUploadDialog() {
  // 重置表单
  uploadForm.meta_file_id = undefined as unknown as number;
  uploadForm.files = [];

  isUploadDialogVisible.value = true;

  // 加载 Meta File 选项
  metaFileLoading.value = true;
  try {
    const res = await fetchFileSchemaList();
    metaFileOptions.value = res.data?.schemas || [];
  } catch {
    // 修复 unused-vars
    ElMessage.error('无法加载源文件列表');
  } finally {
    metaFileLoading.value = false;
  }
}

async function submitUpload() {
  if (!props.taskId) return;

  if (!uploadForm.meta_file_id) {
    ElMessage.warning('请选择目标元文件 (Meta File)');
    return;
  }
  if (!uploadForm.files || uploadForm.files.length === 0) {
    ElMessage.warning('请至少选择一个生成文件');
    return;
  }

  uploadLoading.value = true;
  try {
    await uploadTaskGeneratedFiles(props.taskId, uploadForm);
    ElMessage.success('文件上传任务已提交');
    isUploadDialogVisible.value = false;
    // 刷新详情状态
    await getTaskDetails(props.taskId);
  } catch {
    // 3. 修复 no-console: 移除 console.error，添加 UI 提示
    ElMessage.error('上传任务提交失败');
  } finally {
    uploadLoading.value = false;
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
    <!-- 4. 修复 static inline styles: 提取到 css class -->
    <div v-loading="loading" class="loading-container">
      <div v-if="taskDetails">
        <ElDescriptions :column="3" border>
          <template #title>
            <span class="text-lg font-semibold">基本信息</span>
          </template>
          <template #extra>
            <div class="space-x-2">
              <ElButton type="primary" plain :icon="Upload" @click="handleOpenUploadDialog">选择上传</ElButton>
              <ElButton type="warning" :disabled="!canBeReuploaded" @click="handleReupload">重新上传</ElButton>
              <ElButton type="danger" :disabled="!canBeStopped" @click="handleStopTask">中断任务</ElButton>
              <ElButton type="primary" :disabled="!canBeRestarted" @click="handleRestartTask">重启任务</ElButton>
            </div>
          </template>

          <ElDescriptionsItem label="任务流名称">{{ taskDetails.name }}</ElDescriptionsItem>
          <ElDescriptionsItem label="任务来源">{{ taskDetails.task_source_type || '-' }}</ElDescriptionsItem>

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

  <ElDialog
    v-model="isUploadDialogVisible"
    title="上传任务生成文件"
    width="560px"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    class="upload-dialog"
  >
    <div class="dialog-content">
      <div class="info-block">
        <ElIcon class="info-icon" color="#409eff"><InfoFilled /></ElIcon>
        <span class="info-text">
          手动将任务流程中产生的文件关联到系统文件库。请选择目标元文件定义和具体要上传的文件。
        </span>
      </div>

      <ElForm label-position="top" class="upload-form">
        <ElFormItem required>
          <template #label>
            <span class="form-label">目标元文件 (Meta File)</span>
          </template>
          <!-- 修复 static inline styles -->
          <ElSelect
            v-model="uploadForm.meta_file_id"
            placeholder="请选择要归属的文件 Schema"
            :loading="metaFileLoading"
            class="full-width-select"
            size="large"
          >
            <template #prefix>
              <ElIcon><Collection /></ElIcon>
            </template>
            <ElOption v-for="item in metaFileOptions" :key="item.id" :label="item.name" :value="item.id">
              <div class="flex items-center justify-between">
                <span>{{ item.name }}</span>
                <span class="text-xs text-gray-400">ID: {{ item.id }}</span>
              </div>
            </ElOption>
          </ElSelect>
        </ElFormItem>

        <ElFormItem required>
          <template #label>
            <span class="form-label">选择上传文件</span>
          </template>
          <!-- 修复 static inline styles -->
          <ElSelect
            v-model="uploadForm.files"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="从任务产生的文件列表中选择"
            class="full-width-select"
            size="large"
            no-data-text="当前任务暂无记录的文件"
          >
            <template #prefix>
              <ElIcon><DocumentCopy /></ElIcon>
            </template>
            <ElOption v-for="file in availableTaskFiles" :key="file.value" :label="file.label" :value="file.value" />
          </ElSelect>
          <div class="mt-2 flex items-center text-xs text-gray-400">
            <span class="mr-1">*</span>
            列表仅显示任务执行记录中明确输出的文件
          </div>
        </ElFormItem>
      </ElForm>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <ElButton size="large" @click="isUploadDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="uploadLoading" size="large" :icon="Upload" @click="submitUpload">
          确认上传
        </ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<style scoped>
/* 弹窗样式优化 */
.upload-dialog {
  border-radius: 12px;
  overflow: hidden;
}

.dialog-content {
  padding: 0 10px;
}

/* 顶部提示块 */
.info-block {
  display: flex;
  align-items: flex-start;
  background-color: #ecf5ff;
  border-radius: 6px;
  padding: 10px 14px;
  margin-bottom: 24px;
}

.info-icon {
  margin-top: 2px;
  margin-right: 8px;
  font-size: 16px;
}

.info-text {
  font-size: 13px;
  color: #409eff;
  line-height: 1.5;
}

/* 表单样式 */
.upload-form .el-form-item {
  margin-bottom: 24px;
}

.form-label {
  font-weight: 600;
  color: #303133;
}

/* 底部按钮区 */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 8px;
}

/* 新增工具类，解决 inline-styles 报错 */
.loading-container {
  min-height: 200px;
}

.full-width-select {
  width: 100%;
}

/* 通用工具类 */
.flex {
  display: flex;
}
.items-center {
  align-items: center;
}
.justify-between {
  justify-content: space-between;
}
.text-xs {
  font-size: 12px;
}
.text-gray-400 {
  color: #9ca3af;
}
.mt-2 {
  margin-top: 8px;
}
.mr-1 {
  margin-right: 4px;
}
</style>
