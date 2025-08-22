<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  ElButton,
  ElCol,
  ElDialog,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElRow,
  ElScrollbar,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag
} from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { Document, FolderOpened } from '@element-plus/icons-vue';
import { request } from '@/service/request';

// --- API 数据类型定义 ---

interface UploadUser {
  user_id: number;
  username: string;
}

interface FileInfo {
  file_id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  created_time: string;
  upload_user: UploadUser;
}

interface PaginatedFilesResponse {
  count: number;
  page: number;
  page_size: number;
  results: FileInfo[];
}

function fetchFileList(page: number, pageSize: number, fileType?: string) {
  const params: { page: number; page_size: number; File_type?: string } = {
    page,
    page_size: pageSize
  };
  if (fileType) {
    params.File_type = fileType;
  }
  return request<PaginatedFilesResponse>({
    url: '/files/list',
    method: 'get',
    params
  });
}

// --- 组件 Props 和 Emits 定义 ---
const props = defineProps<{
  schema: Record<string, any>;
  modelValue: Record<string, any>;
}>();

const emit = defineEmits(['update:modelValue']);

// --- 内部状态 ---
const formRef = ref<FormInstance | null>(null);
const localModel = ref<Record<string, any>>({});

// --- 文件选择对话框状态 ---
const fileDialogVisible = ref(false);
const availableFiles = ref<FileInfo[]>([]);
const loadingFiles = ref(false);
const currentFileSelectionKey = ref<string | null>(null);
const tempSelection = ref<FileInfo[]>([]);
const selectedFileType = ref<string>('');
const fileTypeOptions = ref(['BAM输入文件', 'FASTQ输入文件', 'VCF结果文件', '报告文件', '其他类型']);

// --- 分页状态 ---
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
  hasNextPage: false
});

// --- v-model 同步逻辑 ---
watch(
  () => props.modelValue,
  newModel => {
    if (JSON.stringify(newModel) !== JSON.stringify(localModel.value)) {
      localModel.value = JSON.parse(JSON.stringify(newModel));
    }
  },
  { deep: true, immediate: true }
);

watch(
  localModel,
  newLocalModel => {
    emit('update:modelValue', newLocalModel);
  },
  { deep: true }
);

// --- 核心功能: 动态验证规则 ---
const formRules = computed<FormRules>(() => {
  const rules: FormRules = {};
  if (!props.schema || !props.schema.properties) {
    return {};
  }

  for (const key in props.schema.properties) {
    if (props.schema.required?.includes(key)) {
      const property = props.schema.properties[key];
      let trigger: 'blur' | 'change' = 'blur';
      let message = `请输入 ${formatLabel(key)}`;
      let validator;

      // 对不同类型的字段设置不同的触发器和提示
      if (property.type === 'array') {
        trigger = 'change';
        message = `请选择文件`;
        // 数组类型需要自定义验证器来检查是否为空
        validator = (rule: any, value: any, callback: any) => {
          console.log(rule);
          if (!value || value.length === 0) {
            callback(new Error(message));
          } else {
            callback();
          }
        };
      } else if (property.type === 'string' && property.enum) {
        trigger = 'change';
        message = `请选择 ${formatLabel(key)}`;
      }

      rules[key] = [validator ? { validator, trigger } : { required: true, message, trigger }];
    }
  }
  return rules;
});

// --- 计算属性 ---
const fileIdMap = computed(() => {
  const map = new Map<number, FileInfo>();
  for (const file of availableFiles.value) {
    map.set(file.file_id, file);
  }
  for (const key in localModel.value) {
    if (Array.isArray(localModel.value[key])) {
      localModel.value[key].forEach((item: any) => {
        if (item.file_id && !map.has(item.file_id)) {
          map.set(item.file_id, { file_name: `文件ID: ${item.file_id}` } as FileInfo);
        }
      });
    }
  }
  return map;
});

// --- 辅助函数 ---
function isNumericType(property: Record<string, any>): boolean {
  if (!property || !property.type) return false;
  if (Array.isArray(property.type)) {
    return property.type.includes('number') || property.type.includes('integer');
  }
  return property.type === 'number' || property.type === 'integer';
}
function formatLabel(key: string): string {
  const spacedKey = key.replace(/([A-Z])/g, ' $1');
  return spacedKey
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim();
}
function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
function getFileName(fileId: number): string {
  return fileIdMap.value.get(fileId)?.file_name ?? `加载中...`;
}

// --- 文件选择与数据加载逻辑 ---
async function loadFilesPage() {
  if (loadingFiles.value || (!pagination.value.hasNextPage && availableFiles.value.length > 0)) return;
  loadingFiles.value = true;
  try {
    const response = await fetchFileList(pagination.value.page, pagination.value.pageSize, selectedFileType.value);
    if (response && response.data && Array.isArray(response.data.results)) {
      availableFiles.value.push(...response.data.results);
      pagination.value.total = response.data.count;
      pagination.value.hasNextPage = availableFiles.value.length < response.data.count;
      if (pagination.value.hasNextPage) {
        pagination.value.page += 1;
      }
    }
  } catch (error) {
    console.error('获取文件列表失败:', error);
    ElMessage.error('获取文件列表失败，请检查网络或联系管理员。');
  } finally {
    loadingFiles.value = false;
  }
}
const handleFileTypeChange = () => {
  availableFiles.value = [];
  pagination.value = { page: 1, pageSize: 20, total: 0, hasNextPage: true };
  loadFilesPage();
};
const closeFileDialog = () => {
  fileDialogVisible.value = false;
  currentFileSelectionKey.value = null;
  tempSelection.value = [];
};
const openFileDialog = (key: string) => {
  currentFileSelectionKey.value = key;
  selectedFileType.value = '';
  availableFiles.value = [];
  pagination.value = { page: 1, pageSize: 20, total: 0, hasNextPage: true };
  loadFilesPage();
  fileDialogVisible.value = true;
};
const handleTableSelectionChange = (selection: FileInfo[]) => {
  tempSelection.value = selection;
};
const confirmFileSelection = () => {
  if (currentFileSelectionKey.value) {
    localModel.value[currentFileSelectionKey.value] = tempSelection.value.map(file => ({
      file_id: file.file_id
    }));
  }
  closeFileDialog();
};
const removeFile = (key: string, fileIdToRemove: number) => {
  if (localModel.value[key]) {
    localModel.value[key] = localModel.value[key].filter(
      (item: { file_id: number }) => item.file_id !== fileIdToRemove
    );
  }
};
const dialogTableRef = ref();
watch(fileDialogVisible, isVisible => {
  if (isVisible && dialogTableRef.value) {
    setTimeout(() => {
      dialogTableRef.value.clearSelection();
      if (currentFileSelectionKey.value && localModel.value[currentFileSelectionKey.value]) {
        const selectedFileIds = new Set(
          localModel.value[currentFileSelectionKey.value].map((item: any) => item.file_id)
        );
        const rowsToSelect = availableFiles.value.filter(file => selectedFileIds.has(file.file_id));
        rowsToSelect.forEach(row => {
          dialogTableRef.value.toggleRowSelection(row, true);
        });
      }
    }, 100);
  }
});

// --- 核心功能: 表单验证方法 ---
const validate = async (): Promise<boolean> => {
  if (!formRef.value) return false;
  try {
    // ElForm 的 validate 方法返回一个 Promise
    await formRef.value.validate();
    return true; // 如果 Promise resolve，说明验证通过
  } catch (error) {
    console.log('表单验证失败:', error);
    return false; // 如果 Promise reject，说明验证失败
  }
};

// --- 核心功能: 暴露方法给父组件 ---
defineExpose({
  validate
});
</script>

<template>
  <div class="dynamic-form-container">
    <ElForm
      ref="formRef"
      :model="localModel"
      :rules="formRules"
      label-position="left"
      label-width="180px"
      class="beautified-form"
    >
      <ElRow :gutter="32">
        <template v-for="(property, key) in schema.properties" :key="String(key)">
          <ElCol :span="property.type === 'array' ? 24 : 12">
            <ElFormItem :prop="String(key)" :label="formatLabel(String(key))">
              <ElInputNumber
                v-if="isNumericType(property)"
                v-model="localModel[key]"
                :min="property.minimum"
                :max="property.maximum"
                placeholder="请输入数值"
                class="form-input"
                controls-position="right"
              />
              <ElSwitch v-else-if="property.type === 'boolean'" v-model="localModel[key]" />
              <ElSelect
                v-else-if="property.type === 'string' && property.enum"
                v-model="localModel[key]"
                :placeholder="`请选择 ${formatLabel(String(key))}`"
                class="form-input"
              >
                <ElOption v-for="option in property.enum" :key="option" :label="option" :value="option" />
              </ElSelect>

              <div
                v-else-if="property.type === 'array'"
                class="file-input-area-clickable"
                @click="openFileDialog(String(key))"
              >
                <template v-if="localModel[key] && localModel[key].length > 0">
                  <ElScrollbar class="file-scrollbar">
                    <div class="tags-wrapper">
                      <ElTag
                        v-for="item in localModel[key]"
                        :key="item.file_id"
                        class="file-tag"
                        closable
                        @close.stop="removeFile(String(key), item.file_id)"
                      >
                        <ElIcon :size="16"><Document /></ElIcon>
                        <span>{{ getFileName(item.file_id) }}</span>
                      </ElTag>
                    </div>
                  </ElScrollbar>
                </template>
                <div v-else class="file-placeholder">
                  <ElIcon :size="40"><FolderOpened /></ElIcon>
                  <span class="placeholder-text">点击选择或拖拽文件到此处</span>
                </div>
              </div>

              <ElInput
                v-else-if="property.type === 'string'"
                v-model="localModel[key]"
                :placeholder="`请输入 ${formatLabel(String(key))}`"
                class="form-input"
              />
            </ElFormItem>
          </ElCol>
        </template>
      </ElRow>
    </ElForm>

    <ElDialog
      v-model="fileDialogVisible"
      title="选择文件"
      width="60%"
      :before-close="closeFileDialog"
      append-to-body
      class="file-dialog"
    >
      <ElSelect
        v-model="selectedFileType"
        placeholder="按文件类型筛选"
        clearable
        class="dialog-filter-select"
        @change="handleFileTypeChange"
      >
        <ElOption v-for="type in fileTypeOptions" :key="type" :label="type" :value="type" />
      </ElSelect>
      <ElTable
        ref="dialogTableRef"
        v-loading="loadingFiles && availableFiles.length === 0"
        v-infinite-scroll="loadFilesPage"
        :data="availableFiles"
        height="400px"
        :row-key="(row: FileInfo) => String(row.file_id)"
        :infinite-scroll-disabled="loadingFiles || !pagination.hasNextPage"
        :infinite-scroll-distance="20"
        @selection-change="handleTableSelectionChange"
      >
        <ElTableColumn type="selection" width="55" reserve-selection />
        <ElTableColumn property="file_id" label="文件ID" width="100" />
        <ElTableColumn property="file_name" label="文件名" show-overflow-tooltip>
          <template #default="{ row }">
            <ElIcon class="el-icon--left"><Document /></ElIcon>
            <span>{{ row.file_name }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn property="file_type" label="文件类型" width="150" />
        <ElTableColumn property="file_size" label="大小" width="120">
          <template #default="{ row }">
            {{ formatFileSize(row.file_size) }}
          </template>
        </ElTableColumn>
        <ElTableColumn property="upload_user.username" label="上传者" width="120" />
      </ElTable>
      <template #footer>
        <span class="dialog-footer">
          <ElButton @click="closeFileDialog">取消</ElButton>
          <ElButton type="primary" @click="confirmFileSelection">确认</ElButton>
        </span>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
/* --- 容器与基础布局 --- */
.dynamic-form-container {
  padding: 8px; /* 减少内边距以更好地融入卡片 */
}

.beautified-form {
  --el-form-label-font-size: 14px;
}

/* --- 标签样式 --- */
.beautified-form :deep(.el-form-item__label) {
  font-weight: 500;
  color: #344054;
  height: 44px; /* 与输入框等高，实现垂直居中 */
  line-height: 44px;
}

/* --- 输入框与选择器通用样式 --- */
.form-input {
  width: 100%;
  height: 44px;
}

.form-input :deep(.el-input__wrapper),
.form-input :deep(.el-input-number) {
  width: 100%;
  height: 100%;
  padding: 0 16px;
  background-color: #ffffff;
  border-radius: 8px;
  border: 1px solid #d0d5dd;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
  transition: all 0.2s ease-in-out;
}

.form-input:not(.is-disabled):hover :deep(.el-input__wrapper),
.form-input:not(.is-disabled):hover :deep(.el-input-number) {
  border-color: var(--el-color-primary-light-5);
}

.form-input :deep(.el-input__wrapper.is-focus),
.form-input.is-focus :deep(.el-input-number) {
  outline: none;
  border-color: var(--el-color-primary-light-3);
  box-shadow:
    0 1px 2px rgba(16, 24, 40, 0.05),
    0 0 0 4px var(--el-color-primary-light-8);
}

.form-input :deep(.el-input__inner) {
  font-weight: 500;
  color: #101828;
}

.form-input :deep(.el-input__inner::placeholder),
.form-input :deep(.el-select__placeholder) {
  color: #667085;
}

/* --- 文件选择区域样式 --- */
.file-input-area-clickable {
  width: 100%;
  min-height: 160px;
  padding: 12px;
  border: 2px dashed var(--el-border-color-lighter);
  border-radius: 8px;
  background-color: var(--el-fill-color-light);
  position: relative;
  cursor: pointer;
  transition:
    border-color 0.3s,
    background-color 0.3s;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-input-area-clickable:hover {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

.file-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--el-text-color-placeholder);
  user-select: none;
  transition: color 0.3s;
}

.file-input-area-clickable:hover .file-placeholder {
  color: var(--el-color-primary);
}

.placeholder-text {
  font-size: 14px;
  font-weight: 500;
}

.file-scrollbar {
  width: 100%;
  height: 136px;
}

.tags-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 4px;
}

.file-tag {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  font-size: 14px;
  font-weight: 500;
  background-color: #ffffff;
  border: 1px solid var(--el-border-color);
  color: var(--el-text-color-primary);
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease-in-out;
}

.file-tag .el-icon {
  margin-right: 8px;
}

.file-tag :deep(.el-tag__close) {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  border-radius: 50%;
  width: 18px;
  height: 18px;
  transition: all 0.2s ease;
}

.file-tag :deep(.el-tag__close:hover) {
  background-color: var(--el-color-danger-light-7);
  color: var(--el-color-danger);
  transform: scale(1.1);
}

/* --- 对话框样式 --- */
.dialog-filter-select {
  width: 240px;
  margin-bottom: 16px;
}

/* --- 响应式设计 --- */
@media (max-width: 992px) {
  .beautified-form {
    /* 在中等屏幕及以下，切换为标签在上布局 */
    --el-form-label-width: 0px;
  }
  .beautified-form :deep(.el-form-item__label) {
    display: block;
    text-align: left;
    height: auto;
    line-height: 22px; /* 恢复默认行高 */
    margin-bottom: 8px;
  }
  .el-col {
    /* 在小屏幕上，所有列都占满整行 */
    width: 100% !important;
    flex: 0 0 100%;
    max-width: 100%;
  }
}
</style>
