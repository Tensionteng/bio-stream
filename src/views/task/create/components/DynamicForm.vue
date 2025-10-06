<script setup lang="ts">
// --- 核心依赖导入 ---
import { computed, ref, watch } from 'vue';
import {
  // 导入 Element Plus 组件，用于构建 UI
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
import type { FormInstance, FormRules } from 'element-plus'; // 导入 Element Plus 的类型定义
import { Document, FolderOpened } from '@element-plus/icons-vue'; // 导入图标
import { request } from '@/service/request'; // 导入封装的请求函数

// --- API 数据类型定义 ---
// 定义了与后端 API 交互时的数据结构，增强了代码的可读性和类型安全。

// 上传用户信息
interface UploadUser {
  user_id: number;
  username: string;
}

// 文件详细信息
interface FileInfo {
  file_id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  created_time: string;
  upload_user: UploadUser;
}

// 分页文件列表的响应体结构
interface PaginatedFilesResponse {
  count: number; // 总文件数
  page: number; // 当前页码
  page_size: number; // 每页大小
  results: FileInfo[]; // 文件列表数据
}

/**
 * 从服务器获取文件列表的 API 请求函数
 *
 * @param {number} page - 请求的页码
 * @param {number} pageSize - 每页请求的数量
 * @param {string} [fileType] - (可选) 按文件类型筛选
 * @returns {Promise<PaginatedFilesResponse>} 包含文件列表数据的 Promise
 */
function fetchFileList(page: number, pageSize: number, fileType?: string) {
  const params: { page: number; page_size: number; File_type?: string } = {
    page,
    page_size: pageSize
  };
  // 如果提供了文件类型，则加入请求参数
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
// `defineProps` 和 `defineEmits` 是 Vue 3 <script setup> 中用于定义组件接口的宏。

const props = defineProps<{
  schema: Record<string, any>; // 表单结构定义 (JSON Schema 格式)，用于动态生成表单项
  modelValue: Record<string, any>; // 通过 v-model 传入的表单数据
}>();

const emit = defineEmits(['update:modelValue']); // 定义 v-model 所需的 update 事件

// --- 内部状态 ---

// `formRef` 用于获取 ElForm 组件实例，以便调用其 validate 等方法
const formRef = ref<FormInstance | null>(null);
// `localModel` 是 `props.modelValue` 的一个本地深拷贝副本。
// 这是 Vue 的最佳实践，避免直接修改 props，并通过 watch 将本地更改同步回父组件。
const localModel = ref<Record<string, any>>({});

// --- 文件选择对话框状态 ---
const fileDialogVisible = ref(false); // 控制文件选择对话框的显示与隐藏
const availableFiles = ref<FileInfo[]>([]); // 存储从 API 获取的可选文件列表
const loadingFiles = ref(false); // 标记文件列表是否正在加载中
const currentFileSelectionKey = ref<string | null>(null); // 存储当前正在选择文件的表单字段名 (key)
const tempSelection = ref<FileInfo[]>([]); // 临时存储在对话框表格中选中的文件
const selectedFileType = ref<string>(''); // 对话框中文件类型筛选器的绑定值
const fileTypeOptions = ref(['BAM输入文件', 'FASTQ输入文件', 'VCF结果文件', '报告文件', '其他类型']); // 文件类型筛选器的选项

// --- 分页状态 ---
// 用于实现文件选择对话框中的无限滚动加载
const pagination = ref({
  page: 1, // 当前页码
  pageSize: 20, // 每页数量
  total: 0, // 文件总数
  hasNextPage: false // 是否还有下一页
});

// --- v-model 同步逻辑 ---

// 监听父组件传入的 `modelValue` 的变化
watch(
  () => props.modelValue,
  newModel => {
    // 只有在数据真正发生变化时才更新本地 `localModel`，避免不必要的重渲染
    if (JSON.stringify(newModel) !== JSON.stringify(localModel.value)) {
      localModel.value = JSON.parse(JSON.stringify(newModel)); // 深拷贝传入的数据
    }
  },
  { deep: true, immediate: true } // `deep` 确保深层对象的变更也能被监听到, `immediate` 确保组件初始化时立即执行一次
);

// 监听本地 `localModel` 的变化
watch(
  localModel,
  newLocalModel => {
    // 当本地数据变化时（例如用户输入），通过 emit `update:modelValue` 事件将变更通知父组件
    emit('update:modelValue', newLocalModel);
  },
  { deep: true }
);

// --- 核心功能: 动态验证规则 ---
// 使用 computed 属性，根据传入的 `schema` 动态生成 Element Plus 的表单验证规则
const formRules = computed<FormRules>(() => {
  const rules: FormRules = {};
  if (!props.schema || !props.schema.properties) {
    return {};
  }

  // 遍历 schema 中的所有属性
  for (const key in props.schema.properties) {
    // 检查该属性是否在 `required` 数组中
    if (props.schema.required?.includes(key)) {
      const property = props.schema.properties[key];
      let trigger: 'blur' | 'change' = 'blur'; // 默认触发时机为 blur
      let message = `请输入 ${formatLabel(key)}`;
      let validator;

      // 根据字段类型定制验证规则
      if (property.type === 'array') {
        // 数组类型（文件选择框）
        trigger = 'change';
        message = `请选择文件`;
        // 自定义验证器，检查数组是否为空
        validator = (value: any, callback: any) => {
          if (!value || value.length === 0) {
            callback(new Error(message));
          } else {
            callback();
          }
        };
      } else if (property.type === 'string' && property.enum) {
        // 字符串且带枚举值（下拉选择框）
        trigger = 'change';
        message = `请选择 ${formatLabel(key)}`;
      }

      // 将生成的规则赋值给对应的 key
      rules[key] = [validator ? { validator, trigger } : { required: true, message, trigger }];
    }
  }
  return rules;
});

// --- 计算属性 ---
// 创建一个文件ID到文件信息的映射，用于快速查找文件名
const fileIdMap = computed(() => {
  const map = new Map<number, FileInfo>();
  // 遍历当前已加载的文件列表
  for (const file of availableFiles.value) {
    map.set(file.file_id, file);
  }
  // 遍历已选择的文件，确保即使文件信息还未从API加载，也能显示一个基础信息
  for (const key in localModel.value) {
    if (Array.isArray(localModel.value[key])) {
      localModel.value[key].forEach((item: any) => {
        if (item.file_id && !map.has(item.file_id)) {
          // 如果映射中不存在，则添加一个临时的文件信息
          map.set(item.file_id, { file_name: `文件ID: ${item.file_id}` } as FileInfo);
        }
      });
    }
  }
  return map;
});

// --- 辅助函数 ---

/** 检查 schema 属性是否为数字类型 */
function isNumericType(property: Record<string, any>): boolean {
  if (!property || !property.type) return false;
  if (Array.isArray(property.type)) {
    return property.type.includes('number') || property.type.includes('integer');
  }
  return property.type === 'number' || property.type === 'integer';
}

/**
 * 将 camelCase 或 snake_case 格式的 key 转换成用户友好的标签文本
 *
 * @example
 *   formatLabel("inputFastqFile") -> "Input Fastq File"
 */
function formatLabel(key: string): string {
  const spacedKey = key.replace(/([A-Z])/g, ' $1'); // 在大写字母前加空格
  return spacedKey
    .replace(/_/g, ' ') // 替换下划线为空格
    .replace(/\b\w/g, char => char.toUpperCase()) // 首字母大写
    .trim();
}
/** 将文件大小（字节）格式化为更易读的单位 (KB, MB, GB) */
function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
/** 根据文件 ID 从 fileIdMap 中获取文件名 */
function getFileName(fileId: number): string {
  return fileIdMap.value.get(fileId)?.file_name ?? `加载中...`;
}

// --- 文件选择与数据加载逻辑 ---

/** 加载一页文件数据，用于无限滚动 */
async function loadFilesPage() {
  // 如果正在加载或已无更多数据，则直接返回
  if (loadingFiles.value || (!pagination.value.hasNextPage && availableFiles.value.length > 0)) return;
  loadingFiles.value = true;
  try {
    const response = await fetchFileList(pagination.value.page, pagination.value.pageSize, selectedFileType.value);
    if (response && response.data && Array.isArray(response.data.results)) {
      // 将新加载的数据追加到现有列表
      availableFiles.value.push(...response.data.results);
      pagination.value.total = response.data.count;
      // 更新是否有下一页的状态
      pagination.value.hasNextPage = availableFiles.value.length < response.data.count;
      if (pagination.value.hasNextPage) {
        // 页码加一，为下一次加载做准备
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

/** 当文件类型筛选器变化时触发 */
const handleFileTypeChange = () => {
  // 重置文件列表和分页状态
  availableFiles.value = [];
  pagination.value = { page: 1, pageSize: 20, total: 0, hasNextPage: true };
  // 重新加载数据
  loadFilesPage();
};
/** 关闭文件选择对话框，并重置相关状态 */
const closeFileDialog = () => {
  fileDialogVisible.value = false;
  currentFileSelectionKey.value = null;
  tempSelection.value = [];
};
/**
 * 打开文件选择对话框
 *
 * @param {string} key - 触发此操作的表单字段名
 */
const openFileDialog = (key: string) => {
  currentFileSelectionKey.value = key;
  // 重置筛选和分页状态
  selectedFileType.value = '';
  availableFiles.value = [];
  pagination.value = { page: 1, pageSize: 20, total: 0, hasNextPage: true };
  loadFilesPage(); // 加载第一页数据
  fileDialogVisible.value = true;
};
/**
 * 处理表格中选项变化的事件
 *
 * @param {FileInfo[]} selection - 当前选中的行数据
 */
const handleTableSelectionChange = (selection: FileInfo[]) => {
  tempSelection.value = selection;
};
/** 用户点击“确认”按钮，将选择的文件更新到 `localModel` */
const confirmFileSelection = () => {
  if (currentFileSelectionKey.value) {
    // 将选中的文件信息转换为 `{ file_id: number }` 的格式
    localModel.value[currentFileSelectionKey.value] = tempSelection.value.map(file => ({
      file_id: file.file_id
    }));
  }
  closeFileDialog();
};
/**
 * 移除一个已选择的文件标签
 *
 * @param {string} key - 表单字段名
 * @param {number} fileIdToRemove - 要移除的文件的 ID
 */
const removeFile = (key: string, fileIdToRemove: number) => {
  if (localModel.value[key]) {
    localModel.value[key] = localModel.value[key].filter(
      (item: { file_id: number }) => item.file_id !== fileIdToRemove
    );
  }
};

// 获取对话框中表格的引用
const dialogTableRef = ref();
// 监听对话框的可见性变化
watch(fileDialogVisible, isVisible => {
  // 当对话框变为可见时，同步已选中的文件状态到表格中
  if (isVisible && dialogTableRef.value) {
    setTimeout(() => {
      // 先清空所有选择
      dialogTableRef.value.clearSelection();
      // 如果当前表单字段已有选中的文件
      if (currentFileSelectionKey.value && localModel.value[currentFileSelectionKey.value]) {
        // 获取已选文件 ID 的集合
        const selectedFileIds = new Set(
          localModel.value[currentFileSelectionKey.value].map((item: any) => item.file_id)
        );
        // 从当前加载的文件中找出需要被勾选的行
        const rowsToSelect = availableFiles.value.filter(file => selectedFileIds.has(file.file_id));
        // 遍历并勾选这些行
        rowsToSelect.forEach(row => {
          dialogTableRef.value.toggleRowSelection(row, true);
        });
      }
    }, 100); // 使用 setTimeout 确保 DOM 更新完成
  }
});

// --- 核心功能: 表单验证方法 ---

/**
 * 触发表单验证
 *
 * @returns {Promise<boolean>} 验证是否通过
 */
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
// 使用 `defineExpose` 将 `validate` 方法暴露出去，
// 这样父组件可以通过 ref 调用子组件的 `validate` 方法。
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
