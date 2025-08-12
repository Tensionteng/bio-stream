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
import type { FormInstance } from 'element-plus';
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
  next: string | null;
  previous: string | null;
  results: FileInfo[];
}

// UPDATE: 更新API函数，增加 fileType 参数并修改URL
function fetchFileList(page: number, pageSize: number, fileType?: string) {
  // 构造请求参数
  const params: { Page: number; Page_size: number; File_type?: string } = {
    Page: page,
    Page_size: pageSize
  };
  // 如果 fileType 有值，则添加到参数中
  if (fileType) {
    params.File_type = fileType;
  }
  return request<PaginatedFilesResponse>({
    url: '/files/list', // UPDATE: 使用新的API地址
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

// NEW: 新增文件类型筛选的状态
const selectedFileType = ref<string>(''); // 用于存储当前选择的文件类型
const fileTypeOptions = ref([
  // 文件类型的选项，您可以根据后端实际情况修改或从API获取
  'BAM输入文件',
  'FASTQ输入文件',
  'VCF结果文件',
  '报告文件',
  '其他类型'
]);

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

// --- 计算属性，用于快速查找文件名 ---
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

// UPDATE: 修改加载函数，使其能传递文件类型
async function loadFilesPage() {
  if (loadingFiles.value || (!pagination.value.hasNextPage && availableFiles.value.length > 0)) return;
  loadingFiles.value = true;
  try {
    const response = await fetchFileList(pagination.value.page, pagination.value.pageSize, selectedFileType.value);
    if (response && response.data && Array.isArray(response.data.results)) {
      availableFiles.value.push(...response.data.results);
      pagination.value.total = response.data.count;
      pagination.value.hasNextPage = response.data.next !== null;
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

// NEW: 新增处理文件类型变更的函数
const handleFileTypeChange = () => {
  // 重置文件列表和分页信息
  availableFiles.value = [];
  pagination.value = {
    page: 1,
    pageSize: 20,
    total: 0,
    hasNextPage: true // 假设新筛选下有第一页
  };
  // 使用新的筛选条件加载第一页数据
  loadFilesPage();
};

const closeFileDialog = () => {
  fileDialogVisible.value = false;
  currentFileSelectionKey.value = null;
  tempSelection.value = [];
};

// UPDATE: 打开对话框时，重置筛选和分页
const openFileDialog = (key: string) => {
  currentFileSelectionKey.value = key;
  // 重置所有状态
  selectedFileType.value = ''; // 重置文件类型选择
  availableFiles.value = [];
  pagination.value = {
    page: 1,
    pageSize: 20,
    total: 0,
    hasNextPage: true
  };
  loadFilesPage(); // 加载第一页
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
</script>

<template>
  <div class="dynamic-form-container">
    <ElForm ref="formRef" :model="localModel" label-position="left" label-width="150px">
      <ElRow :gutter="24">
        <template v-for="(property, key) in schema.properties" :key="String(key)">
          <ElCol :span="property.type === 'array' ? 24 : 12">
            <ElFormItem class="form-item-enhanced" :required="schema.required?.includes(String(key))">
              <template #label>
                <span class="form-item-label">{{ formatLabel(String(key)) }}</span>
              </template>

              <ElInputNumber
                v-if="property.type === 'integer' || property.type === 'number'"
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
                        {{ getFileName(item.file_id) }}
                      </ElTag>
                    </div>
                  </ElScrollbar>
                </template>
                <div v-else class="file-placeholder">
                  <ElIcon :size="40"><FolderOpened /></ElIcon>
                  <span class="placeholder-text">点击选择文件</span>
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
      <!-- NEW: 文件类型筛选选择器 -->
      <ElSelect
        v-model="selectedFileType"
        placeholder="按文件类型筛选"
        clearable
        class="dialog-filter-select"
        @change="handleFileTypeChange"
      >
        <ElOption v-for="type in fileTypeOptions" :key="type" :label="type" :value="type" />
      </ElSelect>

      <!-- UPDATE: 更新无限滚动和加载状态的逻辑 -->
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
  padding: 24px;
  background-color: #ffffff;
  border-radius: 12px;
}

.form-item-enhanced {
  margin-bottom: 24px;
}

/* --- 标签样式 --- */
.form-item-label {
  font-weight: 600;
  color: #344054;
  font-size: 14px;
}

/* --- 输入框与选择器样式 --- */
.form-input {
  width: 100%;
  height: 44px;
}

.form-input :deep(.el-input__wrapper) {
  width: 100%;
  height: 100%;
  padding: 0 16px;
  background-color: #ffffff;
  border-radius: 8px;
  border: 1px solid #d0d5dd;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
  transition: all 0.2s ease-in-out;
}

.form-input:not(.is-disabled):hover :deep(.el-input__wrapper) {
  border-color: var(--el-color-primary-light-5);
}

.form-input :deep(.el-input__wrapper.is-focus) {
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

.file-tag:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.file-tag .el-icon {
  margin-right: 8px;
  transition: color 0.2s ease-in-out;
}

.file-tag :deep(.el-tag__close) {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  border-radius: 50%;
  width: 18px;
  height: 18px;
}

.file-tag :deep(.el-tag__close:hover) {
  background-color: var(--el-color-primary);
  color: white;
  transform: scale(1.1);
}

/* --- 对话框样式 --- */
.file-dialog .el-dialog__body {
  padding-top: 10px;
  padding-bottom: 10px;
}

/* NEW: 对话框内筛选选择器的样式 */
.dialog-filter-select {
  width: 240px;
  margin-bottom: 16px;
}

@media (max-width: 768px) {
  .el-col {
    width: 100% !important;
    flex: 0 0 100%;
    max-width: 100%;
  }
}
</style>
