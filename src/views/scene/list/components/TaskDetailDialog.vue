<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Collection, DocumentCopy, FolderOpened, InfoFilled, Refresh, Setting, Upload } from '@element-plus/icons-vue';
import {
  fetchFileSchemaList,
  fetchTaskDetail,
  restartTask,
  reuploadTaskFiles,
  stopTask,
  uploadTaskGeneratedFiles
} from '@/service/api/task';
import TaskFlow from './TaskFlow.vue';
import TaskInOutPreview from './TaskInOutPreview.vue';
import TaskFlowGraph from './TaskFlowGraph.vue'; // 引入新组件
/**
 * # ==========================================
 *
 * Props & Emits
 */

// -- Props and Emits --
const props = defineProps<{
  modelValue: boolean;
  taskId: number | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'taskRestarted'): void;
}>();

/**
 * # ==========================================
 *
 * Dialog & 表单状态
 */
const loading = ref(false);
const taskDetails = ref<Api.Task.TaskDetail | null>(null);

// -- Upload Dialog State --
const isUploadDialogVisible = ref(false);
const uploadLoading = ref(false);
const metaFileLoading = ref(false);
const metaFileOptions = ref<Api.Task.FileSchemaItem[]>([]);

// 当前选中的 Schema
const currentSchema = ref<Api.Task.FileSchemaItem | null>(null);

// 动态表单数据
const dynamicForm = reactive({
  meta_file_id: undefined as unknown as number,
  content: {} as Record<string, any>,
  files: {} as Record<string, string>
});

// 解析后的字段列表
const parsedFields = reactive({
  content: [] as { key: string; label: string; type: string; required: boolean; enum?: string[] }[],
  files: [] as {
    key: string;
    label: string;
    required: boolean;
    description: string;
    pattern?: string; // 新增 pattern 字段
  }[]
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
  return Array.from(fileSet).map(fileName => ({ label: fileName, value: fileName }));
});

const taskUnitsArray = computed(() => {
  if (!taskDetails.value?.result_json?.execution_units) return [];
  return Object.values(taskDetails.value.result_json.execution_units).map(unit => ({
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

const canBeStopped = computed(() => {
  const status = taskDetails.value?.status?.toUpperCase();
  return status === 'RUNNING' || status === 'PENDING';
});

const canBeRestarted = computed(() => {
  const status = taskDetails.value?.status?.toUpperCase() || '';
  return ['FAILED', 'PENDING', 'CANCELLED', 'CANCELED'].includes(status);
});

const canBeReuploaded = computed(() => {
  if (!taskDetails.value) return false;
  const uploadStatus = taskDetails.value.upload_status?.toUpperCase();
  return Boolean(uploadStatus) && uploadStatus !== 'SUCCESS';
});

/**
 * # ==========================================
 *
 * 数据监听：根据 taskId / dialog 状态加载详情
 */
watch(
  () => props.taskId,
  newId => {
    if (newId && isDialogVisible.value) getTaskDetails(newId);
  }
);
watch(isDialogVisible, isVisible => {
  if (isVisible && props.taskId) getTaskDetails(props.taskId);
  else taskDetails.value = null;
});

// Schema 解析逻辑
watch(
  () => dynamicForm.meta_file_id,
  newId => {
    dynamicForm.content = {};
    dynamicForm.files = {};
    parsedFields.content = [];
    parsedFields.files = [];
    currentSchema.value = null;

    if (!newId) return;

    const schemaItem = metaFileOptions.value.find(item => item.id === newId);
    if (!schemaItem || !schemaItem.schema_json || !schemaItem.schema_json.properties) return;

    currentSchema.value = schemaItem;
    const propsDef = schemaItem.schema_json.properties;
    const requiredList = (schemaItem.schema_json.required as string[]) || [];

    Object.keys(propsDef).forEach(key => {
      const propDef = propsDef[key];
      const isRequired = requiredList.includes(key);

      if (key === 'file_locations' && propDef.type === 'object' && propDef.properties) {
        const fileProps = propDef.properties;
        const fileRequiredList = (propDef.required as string[]) || [];
        Object.keys(fileProps).forEach(fileKey => {
          const fileItem = fileProps[fileKey];
          parsedFields.files.push({
            key: fileKey,
            label: fileKey,
            description: fileItem.description || '',
            required: fileRequiredList.includes(fileKey),
            pattern: fileItem.pattern // 提取 pattern
          });
          dynamicForm.files[fileKey] = '';
        });
      } else if (key === 'filePaths' || key === 'filePath') {
        parsedFields.files.push({
          key,
          label: key,
          description: (propDef.description || '') + (key === 'filePaths' ? ' (提交时映射为 filepath)' : ''),
          required: isRequired,
          pattern: propDef.pattern // 提取 pattern
        });
        dynamicForm.files[key] = '';
      } else if (propDef.type !== 'object' || key === 'position') {
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

/**
 * # ==========================================
 *
 * 工具函数
 */
/** 将 ISO 字符串格式化成常见时间，避免模板重复写逻辑 */
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

/** 计算单个执行单元的耗时，缺失值时友好降级 */
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

const getStatusTagType = (status: string) => {
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
    case 'CANCELED':
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

/** 根据 pattern 过滤可用文件列表 用于下拉框只显示符合后缀名的文件 */
/** 根据 schema 中的正则进行提示过滤 */
function getFilteredFiles(pattern?: string) {
  if (!pattern) return availableTaskFiles.value;
  try {
    const regex = new RegExp(pattern);
    return availableTaskFiles.value.filter(file => regex.test(file.value));
  } catch (e) {
    console.warn('Regex error:', e);
    return availableTaskFiles.value;
  }
}

// -- API Calls --
/** 打开弹窗时获取任务详情、可选 schema 列表 */
async function getTaskDetails(id: number) {
  loading.value = true;
  taskDetails.value = null;
  try {
    const detailRes = await fetchTaskDetail(id);
    taskDetails.value = detailRes.data as Api.Task.TaskDetail;
  } catch {
    ElMessage.error('获取任务详情失败');
    isDialogVisible.value = false;
  } finally {
    loading.value = false;
  }
}

/** 停止仍在运行的任务 */
async function handleStopTask() {
  if (!props.taskId) return;
  try {
    await ElMessageBox.confirm('您确定要中断此任务吗？此操作不可逆。', '警告', { type: 'warning' });
    loading.value = true;
    await stopTask(props.taskId);
    ElMessage.success('操作成功');
    await getTaskDetails(props.taskId);
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('中断任务失败');
  } finally {
    loading.value = false;
  }
}

/** 允许在失败后重新启动任务 */
async function handleRestartTask() {
  if (!props.taskId) return;
  try {
    await ElMessageBox.confirm('您确定要重新启动此任务吗？', '确认', { type: 'info' });
    loading.value = true;
    await restartTask(props.taskId);
    ElMessage.success('操作成功');
    emit('taskRestarted');
    isDialogVisible.value = false;
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('重启任务失败');
  } finally {
    loading.value = false;
  }
}

/** 重新上传任务自动生成的文件，弥补失败场景 */
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
/** 打开手动补充上传的弹窗，提前加载 Schema */
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

/** 将填好的动态表单提交给服务端 */
async function submitUpload() {
  if (!props.taskId) return;
  if (!dynamicForm.meta_file_id) {
    ElMessage.warning('请选择目标元文件 (Meta File)');
    return;
  }

  // 校验文件选择
  for (const field of parsedFields.files) {
    const selectedFile = dynamicForm.files[field.key];

    // 1. 必填校验
    if (field.required && !selectedFile) {
      ElMessage.warning(`请选择文件: ${field.label}`);
      return;
    }

    // 2. 正则格式校验 (防止非法输入)
    if (selectedFile && field.pattern) {
      try {
        const regex = new RegExp(field.pattern);
        if (!regex.test(selectedFile)) {
          ElMessage.error(`字段 [${field.label}] 文件类型错误`);
          ElMessage.error(`已选: ${selectedFile}`);
          ElMessage.error(`需匹配: ${field.pattern}`);
          return;
        }
      } catch (e) {
        console.error('正则校验异常', e);
      }
    }
  }

  // 校验普通字段
  for (const field of parsedFields.content) {
    if (field.required && !dynamicForm.content[field.key]) {
      ElMessage.warning(`请输入参数: ${field.label}`);
      return;
    }
  }

  const uploadsPayload: Api.Task.UploadMapItem[] = Object.keys(dynamicForm.files)
    .filter(key => Boolean(dynamicForm.files[key]))
    .map(key => {
      const apiFiledName = key === 'filePaths' ? 'filepath' : key;
      return { filed_name: apiFiledName, file_dir: dynamicForm.files[key] };
    });

  const payload: Api.Task.SelectFileUploadPayload = {
    meta_file_id: dynamicForm.meta_file_id,
    uploads: uploadsPayload,
    content_json: dynamicForm.content
  };

  uploadLoading.value = true;
  try {
    await uploadTaskGeneratedFiles(props.taskId, payload);
    ElMessage.success('文件上传任务已提交');
    isUploadDialogVisible.value = false;
    await getTaskDetails(props.taskId);
  } catch (error: any) {
    console.error('上传失败:', error);
    ElMessage.error('上传任务提交失败');
  } finally {
    uploadLoading.value = false;
  }
}
</script>

<template>
  <!-- 主详情弹窗：展示执行流 + 元信息 -->
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
          <div class="mt-6">
            <h3 class="mb-3 text-lg font-semibold">输入/输出预览</h3>
            <TaskInOutPreview :task-id="props.taskId" />
          </div>
        </div>
        <div class="mt-6 overflow-hidden border rounded-lg p-0">
          <div class="flex items-center justify-between border-b bg-gray-50 p-3">
            <h3 class="text-sm text-gray-700 font-bold">流程逻辑视图</h3>
            <ElTag size="small" type="warning">Conditional Flow</ElTag>
          </div>
          <TaskFlowGraph :task-id="props.taskId" />
        </div>
      </div>
      <ElEmpty v-else-if="!loading" description="未能加载任务详情" />
    </div>
  </ElDialog>

  <!-- 上传任务文件弹窗：根据 schema 动态渲染 -->
  <ElDialog
    v-model="isUploadDialogVisible"
    title="上传任务生成文件"
    width="680px"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    class="upload-dialog-wrapper"
  >
    <div class="dialog-content">
      <div class="info-block">
        <div class="icon-wrap">
          <ElIcon class="info-icon" color="#409eff"><InfoFilled /></ElIcon>
        </div>
        <div class="info-text">
          <p class="title">操作指引</p>
          <p class="desc">
            系统将根据选择的 Schema 动态生成表单。请填写必要参数，并将任务流程中产生的输出文件映射到对应字段。
          </p>
        </div>
      </div>

      <ElForm label-position="top" class="upload-form" size="large">
        <div class="main-select-area">
          <ElFormItem required label="目标元文件定义 (Meta File Schema)">
            <ElSelect
              v-model="dynamicForm.meta_file_id"
              placeholder="请选择文件定义 Schema"
              :loading="metaFileLoading"
              class="full-width-select"
              filterable
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
        </div>

        <ElEmpty
          v-if="dynamicForm.meta_file_id && parsedFields.content.length === 0 && parsedFields.files.length === 0"
          description="该 Schema 暂无需填写字段"
          :image-size="80"
          class="py-8"
        />

        <div v-else class="form-sections">
          <div v-if="parsedFields.content.length > 0" class="section-block">
            <div class="section-header">
              <div class="header-icon bg-blue-100 text-blue-600">
                <ElIcon><Setting /></ElIcon>
              </div>
              <span class="header-title">基础参数配置</span>
            </div>
            <div class="section-body">
              <div class="grid grid-cols-2 gap-4">
                <template v-for="field in parsedFields.content" :key="field.key">
                  <div class="form-item-wrapper col-span-2 sm:col-span-1">
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
                  </div>
                </template>
              </div>
            </div>
          </div>

          <div v-if="parsedFields.files.length > 0" class="section-block">
            <div class="section-header">
              <div class="header-icon bg-orange-100 text-orange-600">
                <ElIcon><FolderOpened /></ElIcon>
              </div>
              <span class="header-title">文件映射</span>
            </div>
            <div class="section-body">
              <div class="grid grid-cols-1 gap-4">
                <template v-for="field in parsedFields.files" :key="field.key">
                  <div class="form-item-wrapper">
                    <ElFormItem :required="field.required">
                      <template #label>
                        <div class="custom-label">
                          <span class="label-text">{{ field.label }}</span>
                          <span v-if="field.description" class="label-desc">
                            {{ field.description }}
                          </span>
                        </div>
                      </template>
                      <ElSelect
                        v-model="dynamicForm.files[field.key]"
                        filterable
                        :placeholder="field.pattern ? `需匹配后缀: ${field.pattern}` : '请选择任务产出的文件'"
                        class="full-width-select"
                        :no-data-text="field.pattern ? '当前无匹配后缀的文件' : '当前任务无可用文件'"
                      >
                        <template #prefix>
                          <ElIcon><DocumentCopy /></ElIcon>
                        </template>
                        <ElOption
                          v-for="file in getFilteredFiles(field.pattern)"
                          :key="file.value"
                          :label="file.label"
                          :value="file.value"
                        />
                      </ElSelect>
                    </ElFormItem>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </ElForm>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <ElButton size="large" @click="isUploadDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="uploadLoading" size="large" :icon="Upload" @click="submitUpload">
          确认提交
        </ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<style scoped>
/* 弹窗容器 */
.upload-dialog-wrapper {
  border-radius: 12px;
  overflow: hidden;
}

.dialog-content {
  padding: 0 12px 10px;
}

/* 顶部提示块美化 */
.info-block {
  display: flex;
  align-items: flex-start;
  background-color: #f0f7ff;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
  border-left: 4px solid #409eff;
}

.icon-wrap {
  margin-right: 12px;
  padding-top: 2px;
}

.info-text .title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.info-text .desc {
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
}

/* 核心选择区 */
.main-select-area {
  margin-bottom: 24px;
}

/* 分块区域样式 */
.form-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-block {
  background: #ffffff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.02);
  overflow: hidden;
}

.section-header {
  padding: 12px 16px;
  background: #fcfcfc;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
}

.header-icon {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 8px;
}

.header-title {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.section-body {
  padding: 20px;
}

/* 表单项微调 */
.form-item-wrapper {
  margin-bottom: 0;
}

.custom-label {
  display: flex;
  flex-direction: column;
  line-height: 1.4;
  margin-bottom: 4px;
}

.label-text {
  font-weight: 500;
  color: #606266;
}

.label-desc {
  font-size: 12px;
  color: #909399;
  font-weight: normal;
}

.full-width-select {
  width: 100%;
}

/* 底部按钮 */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
  margin-top: 10px;
}

/* 工具类补充 */
.bg-blue-100 {
  background-color: #ecf5ff;
}
.text-blue-600 {
  color: #409eff;
}
.bg-orange-100 {
  background-color: #fdf6ec;
}
.text-orange-600 {
  color: #e6a23c;
}
.grid {
  display: grid;
}
.grid-cols-1 {
  grid-template-columns: repeat(1, minmax(0, 1fr));
}
.grid-cols-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.gap-4 {
  gap: 1rem;
}
.col-span-2 {
  grid-column: span 2 / span 2;
}
.py-8 {
  padding-top: 2rem;
  padding-bottom: 2rem;
}

/* 基础样式复用 */
.loading-container {
  min-height: 200px;
}
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
.mt-6 {
  margin-top: 24px;
}
.p-4 {
  padding: 16px;
}
</style>
