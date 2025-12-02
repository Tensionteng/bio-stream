<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Collection, DocumentCopy, InfoFilled, Refresh, Setting, Upload } from '@element-plus/icons-vue';
import {
  type FileSchemaItem,
  type SelectFileUploadPayload,
  type TaskDetail,
  type UploadMapItem,
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
  (e: 'taskRestarted'): void;
}>();

// -- State Management --
const loading = ref(false);
const taskDetails = ref<TaskDetail | null>(null);

// -- Upload Dialog State --
const isUploadDialogVisible = ref(false);
const uploadLoading = ref(false);
const metaFileLoading = ref(false);
const metaFileOptions = ref<FileSchemaItem[]>([]);

// 当前选中的 Schema
const currentSchema = ref<FileSchemaItem | null>(null);

// 动态表单数据
const dynamicForm = reactive({
  meta_file_id: undefined as unknown as number,
  // 存放 content_json 的数据
  content: {} as Record<string, any>,
  // 存放 uploads 的文件映射
  files: {} as Record<string, string>
});

// 解析后的字段列表（用于界面渲染）
const parsedFields = reactive({
  content: [] as { key: string; label: string; type: string; required: boolean; enum?: string[] }[],
  files: [] as { key: string; label: string; required: boolean; description: string }[]
});

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

// ==========================================
// 核心逻辑修改：Schema 解析 (包含新增的 filePath 支持)
// ==========================================
watch(
  () => dynamicForm.meta_file_id,
  newId => {
    // 1. 重置表单数据
    dynamicForm.content = {};
    dynamicForm.files = {};
    parsedFields.content = [];
    parsedFields.files = [];
    currentSchema.value = null;

    if (!newId) return;

    // 2. 找到对应的 Schema 定义
    const schemaItem = metaFileOptions.value.find(item => item.id === newId);
    if (!schemaItem || !schemaItem.schema_json || !schemaItem.schema_json.properties) return;

    currentSchema.value = schemaItem;
    const propsDef = schemaItem.schema_json.properties;
    const requiredList = (schemaItem.schema_json.required as string[]) || [];

    // 3. 遍历属性进行分类
    Object.keys(propsDef).forEach(key => {
      const propDef = propsDef[key];
      const isRequired = requiredList.includes(key);

      // --- CASE A: 标准文件结构 (file_locations) ---
      // 识别 type: object 且名为 file_locations 的容器
      if (key === 'file_locations' && propDef.type === 'object' && propDef.properties) {
        const fileProps = propDef.properties;
        const fileRequiredList = (propDef.required as string[]) || [];

        Object.keys(fileProps).forEach(fileKey => {
          const fileItem = fileProps[fileKey];
          parsedFields.files.push({
            key: fileKey, // 字段名，如 json_file, bam_file
            label: fileKey,
            description: fileItem.description || '',
            required: fileRequiredList.includes(fileKey)
          });
          dynamicForm.files[fileKey] = '';
        });
      }
      // --- CASE B: 特殊文件结构 (filePaths / filePath) ---
      // ID 7 使用 filePaths (object), ID 4 使用 filePath (string)
      // 只要 key 是这两个之一，就强制作为单个文件处理
      else if (key === 'filePaths' || key === 'filePath') {
        parsedFields.files.push({
          key,
          label: key,
          description: (propDef.description || '') + (key === 'filePaths' ? ' (提交时映射为 filepath)' : ''),
          required: isRequired
        });
        dynamicForm.files[key] = '';
      }
      // --- CASE C: 普通参数 (Content) ---
      // 排除掉对象类型（除非是 position 或者是我们未处理的其他字段），剩下的作为普通文本/枚举参数
      // 注意：ID 4 的 position 是 object，这里不做深层解析，暂时允许它生成一个 Input (需输入JSON或后续优化)
      else if (propDef.type !== 'object' || key === 'position') {
        parsedFields.content.push({
          key,
          label: key,
          type: propDef.type,
          required: isRequired,
          enum: propDef.enum
        });
        dynamicForm.content[key] = propDef.enum && propDef.enum.length > 0 ? propDef.enum[0] : undefined;
      }
    });
  }
);

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

async function handleOpenUploadDialog() {
  dynamicForm.meta_file_id = undefined as unknown as number;
  dynamicForm.content = {};
  dynamicForm.files = {};
  parsedFields.content = [];
  parsedFields.files = [];
  currentSchema.value = null;

  isUploadDialogVisible.value = true;

  metaFileLoading.value = true;
  try {
    const res = await fetchFileSchemaList();
    metaFileOptions.value = res.data?.schemas || [];
  } catch {
    ElMessage.error('无法加载源文件列表');
  } finally {
    metaFileLoading.value = false;
  }
}

// ==========================================
// 核心逻辑修改：提交 Payload 构建
// ==========================================
async function submitUpload() {
  if (!props.taskId) return;

  if (!dynamicForm.meta_file_id) {
    ElMessage.warning('请选择目标元文件 (Meta File)');
    return;
  }

  // 1. 校验必填文件
  for (const field of parsedFields.files) {
    if (field.required && !dynamicForm.files[field.key]) {
      ElMessage.warning(`请选择文件: ${field.label}`);
      return;
    }
  }
  // 2. 校验必填内容
  for (const field of parsedFields.content) {
    if (field.required && !dynamicForm.content[field.key]) {
      ElMessage.warning(`请输入参数: ${field.label}`);
      return;
    }
  }

  // 3. 构造 Payload
  const uploadsPayload: UploadMapItem[] = Object.keys(dynamicForm.files)
    .filter(key => Boolean(dynamicForm.files[key]))
    .map(key => {
      // 只有 filePaths 需要重命名为 filepath，filePath (ID 4) 保持原名
      const apiFiledName = key === 'filePaths' ? 'filepath' : key;

      return {
        filed_name: apiFiledName,
        file_dir: dynamicForm.files[key]
      };
    });

  const payload: SelectFileUploadPayload = {
    meta_file_id: dynamicForm.meta_file_id,
    uploads: uploadsPayload,
    content_json: dynamicForm.content
  };

  uploadLoading.value = true;
  try {
    console.log(payload);
    await uploadTaskGeneratedFiles(props.taskId, payload);
    ElMessage.success('文件上传任务已提交');
    isUploadDialogVisible.value = false;
    await getTaskDetails(props.taskId);
  } catch {
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
    width="600px"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    class="upload-dialog"
  >
    <div class="dialog-content">
      <div class="info-block">
        <ElIcon class="info-icon" color="#409eff"><InfoFilled /></ElIcon>
        <span class="info-text">
          系统根据选择的 Schema 动态生成表单。请填写必要参数并将任务输出文件映射到对应字段。
        </span>
      </div>

      <ElForm label-position="top" class="upload-form" label-width="120px">
        <ElFormItem required label="目标元文件 (Meta File)">
          <ElSelect
            v-model="dynamicForm.meta_file_id"
            placeholder="请选择文件定义 Schema"
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

        <ElDivider v-if="parsedFields.content.length > 0 || parsedFields.files.length > 0" border-style="dashed" />

        <div v-if="parsedFields.content.length > 0" class="mb-4">
          <h4 class="mb-3 flex items-center text-sm text-gray-600 font-bold">
            <ElIcon class="mr-1"><Setting /></ElIcon>
            基础参数 (Content)
          </h4>
          <template v-for="field in parsedFields.content" :key="field.key">
            <ElFormItem :label="field.label" :required="field.required">
              <ElSelect
                v-if="field.enum && field.enum.length > 0"
                v-model="dynamicForm.content[field.key]"
                class="full-width-select"
                placeholder="请选择"
              >
                <ElOption v-for="opt in field.enum" :key="opt" :label="opt" :value="opt" />
              </ElSelect>
              <ElInput v-else v-model="dynamicForm.content[field.key]" :placeholder="`请输入 ${field.label}`" />
            </ElFormItem>
          </template>
        </div>

        <ElDivider v-if="parsedFields.content.length > 0 && parsedFields.files.length > 0" border-style="dashed" />

        <div v-if="parsedFields.files.length > 0">
          <h4 class="mb-3 flex items-center text-sm text-gray-600 font-bold">
            <ElIcon class="mr-1"><DocumentCopy /></ElIcon>
            文件映射 (Files)
          </h4>
          <template v-for="field in parsedFields.files" :key="field.key">
            <ElFormItem :required="field.required">
              <template #label>
                <div class="flex flex-col">
                  <span>{{ field.label }}</span>
                  <span v-if="field.description" class="mt-1 text-xs text-gray-400 font-normal">
                    {{ field.description }}
                  </span>
                </div>
              </template>

              <ElSelect
                v-model="dynamicForm.files[field.key]"
                filterable
                placeholder="请选择任务产出的文件"
                class="full-width-select"
                no-data-text="当前任务无可用文件"
              >
                <ElOption
                  v-for="file in availableTaskFiles"
                  :key="file.value"
                  :label="file.label"
                  :value="file.value"
                />
              </ElSelect>
            </ElFormItem>
          </template>
        </div>

        <ElEmpty
          v-if="dynamicForm.meta_file_id && parsedFields.content.length === 0 && parsedFields.files.length === 0"
          description="该 Schema 暂无需填写字段"
          :image-size="60"
        />
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
.upload-dialog {
  border-radius: 12px;
  overflow: hidden;
}
.dialog-content {
  padding: 0 10px;
}
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
.upload-form .el-form-item {
  margin-bottom: 18px;
}
.form-label {
  font-weight: 600;
  color: #303133;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 8px;
}
.loading-container {
  min-height: 200px;
}
.full-width-select {
  width: 100%;
}
.flex {
  display: flex;
}
.flex-col {
  flex-direction: column;
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
.text-sm {
  font-size: 14px;
}
.font-semibold {
  font-weight: 600;
}
.font-bold {
  font-weight: 700;
}
.font-normal {
  font-weight: 400;
}
.text-gray-400 {
  color: #9ca3af;
}
.text-gray-600 {
  color: #606266;
}
.mt-1 {
  margin-top: 4px;
}
.mt-6 {
  margin-top: 24px;
}
.mb-3 {
  margin-bottom: 12px;
}
.mb-4 {
  margin-bottom: 16px;
}
.mr-1 {
  margin-right: 4px;
}
.p-4 {
  padding: 16px;
}
.space-x-2 > * + * {
  margin-left: 0.5rem;
}
</style>
