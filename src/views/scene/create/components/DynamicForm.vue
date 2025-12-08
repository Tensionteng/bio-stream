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
  ElPagination, // [新增] 引入分页组件
  ElRow,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag
} from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { Document, FolderOpened, Search, UploadFilled } from '@element-plus/icons-vue';
import { request } from '@/service/request';

/**
 * # ==========================================
 *
 * 类型定义
 */
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

interface FetchFileListParams {
  page: number;
  pageSize: number;
  fileType?: string;
  keyword?: string;
}

/**
 * # ==========================================
 *
 * API
 */
function fetchFileList({ page, pageSize, fileType, keyword }: FetchFileListParams) {
  const params: any = { page, page_size: pageSize };
  if (fileType) params.file_type = fileType;
  if (keyword) params.file_name = keyword;
  return request<PaginatedFilesResponse>({ url: '/files/list', method: 'get', params });
}

/**
 * # ==========================================
 *
 * Props & Emits
 */
const props = defineProps<{
  schema: Record<string, any>;
  modelValue: Record<string, any>;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, any>): void;
}>();

/**
 * # ==========================================
 *
 * 表单状态 & 弹窗状态
 */
const formRef = ref<FormInstance | null>(null);
const localModel = ref<Record<string, any>>({});
const fileDialogVisible = ref(false);
const availableFiles = ref<FileInfo[]>([]);
const loadingFiles = ref(false);
const currentFileSelectionKey = ref<string | null>(null);
const tempSelection = ref<FileInfo[]>([]);

// 搜索相关状态
const selectedFileType = ref<string>(''); // 手动输入的类型
const searchKeyword = ref<string>('');

// [修改] 分页状态：移除 hasNextPage，仅保留标准分页所需字段
const pagination = ref({
  page: 1,
  pageSize: 10, // 建议弹窗内一页显示10条，避免太长
  total: 0
});

const dialogTableRef = ref();

/**
 * # ==========================================
 *
 * Watchers
 *
 * 负责同步外部表单数据、控制弹窗选择状态
 */
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

watch(fileDialogVisible, isVisible => {
  if (isVisible && dialogTableRef.value && currentFileSelectionKey.value) {
    setTimeout(() => {
      dialogTableRef.value.clearSelection();
      const currentFiles = localModel.value[currentFileSelectionKey.value!] || [];
      const selectedIds = new Set(currentFiles.map((f: any) => f.file_id));
      availableFiles.value
        .filter(f => selectedIds.has(f.file_id))
        .forEach(row => {
          dialogTableRef.value.toggleRowSelection(row, true);
        });
    }, 100);
  }
});

/**
 * # ==========================================
 *
 * 工具方法
 */
const isNumericType = (p: any) =>
  Array.isArray(p.type)
    ? p.type.some((t: string) => ['number', 'integer'].includes(t))
    : ['number', 'integer'].includes(p.type);
const formatLabel = (k: string) =>
  k
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
const formatFileSize = (b: number) =>
  b === 0
    ? '0 B'
    : `${(b / 1024 ** Math.floor(Math.log(b) / Math.log(1024))).toFixed(2)} ${['B', 'KB', 'MB', 'GB', 'TB'][Math.floor(Math.log(b) / Math.log(1024))]}`;

/**
 * # ==========================================
 *
 * 计算属性
 */
const formRules = computed<FormRules>(() => {
  const rules: FormRules = {};
  if (!props.schema?.properties) return {};
  for (const key in props.schema.properties) {
    if (props.schema.required?.includes(key)) {
      const prop = props.schema.properties[key];
      let trigger = 'blur';
      let message = `请输入 ${formatLabel(key)}`;
      let validator;
      if (prop.type === 'array') {
        trigger = 'change';
        message = '请选择至少一个文件';
        validator = (_r: any, v: any, cb: any) => (!v || v.length === 0 ? cb(new Error(message)) : cb());
      } else if (prop.type === 'string' && prop.enum) {
        trigger = 'change';
        message = `请选择 ${formatLabel(key)}`;
      }
      rules[key] = [validator ? { validator, trigger } : { required: true, message, trigger }];
    }
  }
  return rules;
});

const fileIdMap = computed(() => {
  const map = new Map<number, FileInfo>();
  availableFiles.value.forEach(f => map.set(f.file_id, f));
  Object.values(localModel.value).forEach((val: any) => {
    if (Array.isArray(val))
      val.forEach(f => {
        if (!map.has(f.file_id)) map.set(f.file_id, { file_name: `文件ID: ${f.file_id}` } as FileInfo);
      });
  });
  return map;
});

const getFileName = (id: number) => fileIdMap.value.get(id)?.file_name ?? `ID: ${id}`;

/**
 * # ==========================================
 *
 * 文件选择弹窗逻辑
 */

// 加载逻辑：标准分页模式（覆盖数据）
async function loadFilesPage() {
  loadingFiles.value = true;
  try {
    const res = await fetchFileList({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      fileType: selectedFileType.value,
      keyword: searchKeyword.value
    });

    if (res?.data?.results) {
      // 覆盖当前列表
      availableFiles.value = res.data.results;
      // 更新总数
      pagination.value.total = res.data.count;
    } else {
      availableFiles.value = [];
      pagination.value.total = 0;
    }
  } catch {
    ElMessage.error('加载文件失败');
    availableFiles.value = [];
  } finally {
    loadingFiles.value = false;
  }
}

// [新增] 页码切换事件
const handlePageChange = (newPage: number) => {
  pagination.value.page = newPage;
  loadFilesPage();
};

// [修改] 搜索：重置到第一页并加载
const handleSearch = () => {
  pagination.value.page = 1;
  loadFilesPage();
};

// [修改] 打开弹窗：重置状态并立即加载
const openFileDialog = (key: string) => {
  currentFileSelectionKey.value = key;
  selectedFileType.value = '';
  searchKeyword.value = '';

  // 重置分页和数据
  pagination.value.page = 1;
  availableFiles.value = [];

  fileDialogVisible.value = true;

  // 必须手动加载一次，因为不再依赖无限滚动指令
  loadFilesPage();
};

const confirmFileSelection = () => {
  if (currentFileSelectionKey.value) {
    localModel.value[currentFileSelectionKey.value] = tempSelection.value.map(f => ({ file_id: f.file_id }));
  }
  fileDialogVisible.value = false;
};

const removeFile = (key: string, id: number) => {
  if (localModel.value[key]) localModel.value[key] = localModel.value[key].filter((f: any) => f.file_id !== id);
};

const handleRowClick = (row: FileInfo) => {
  if (dialogTableRef.value) {
    dialogTableRef.value.toggleRowSelection(row);
  }
};

/** 对外暴露的校验方法，供父组件调用 */
const validate = async () => {
  if (!formRef.value) return false;
  try {
    await formRef.value.validate();
    return true;
  } catch {
    return false;
  }
};

defineExpose({ validate });
</script>

<template>
  <div class="dynamic-form-wrapper">
    <!-- 参数渲染区：根据 schema properties 循环绘制 -->
    <ElForm ref="formRef" :model="localModel" :rules="formRules" label-position="top" class="modern-form">
      <ElRow :gutter="24">
        <template v-for="(property, key) in schema.properties" :key="String(key)">
          <ElCol :span="property.type === 'array' ? 24 : 12">
            <ElFormItem :prop="String(key)" class="custom-form-item">
              <template #label>
                <div class="field-label">
                  <span>{{ formatLabel(String(key)) }}</span>
                  <span v-if="schema.required?.includes(String(key))" class="required-dot">*</span>
                </div>
              </template>

              <ElInputNumber
                v-if="isNumericType(property)"
                v-model="localModel[key]"
                :min="property.minimum"
                :max="property.maximum"
                placeholder="0"
                class="modern-input-number"
                controls-position="right"
              />

              <ElSwitch v-else-if="property.type === 'boolean'" v-model="localModel[key]" />

              <ElSelect
                v-else-if="property.type === 'string' && property.enum"
                v-model="localModel[key]"
                placeholder="请选择"
                class="modern-select"
                size="large"
              >
                <ElOption v-for="opt in property.enum" :key="opt" :label="opt" :value="opt" />
              </ElSelect>

              <div
                v-else-if="property.type === 'array'"
                class="file-upload-hero"
                :class="{ 'has-files': localModel[key] && localModel[key].length > 0 }"
                @click="openFileDialog(String(key))"
              >
                <div v-if="!localModel[key] || localModel[key].length === 0" class="hero-placeholder">
                  <div class="icon-circle">
                    <ElIcon :size="28"><FolderOpened /></ElIcon>
                  </div>
                  <div class="hero-text">
                    <span class="primary-text">点击选择文件</span>
                    <span class="sub-text">支持批量选择，从数据湖导入</span>
                  </div>
                </div>

                <div v-else class="hero-content">
                  <div class="hero-header">
                    <span class="file-count">已选 {{ localModel[key].length }} 个文件</span>
                    <span class="add-more-btn">
                      <ElIcon><UploadFilled /></ElIcon>
                      继续添加
                    </span>
                  </div>
                  <div class="selected-tags-grid">
                    <div v-for="item in localModel[key]" :key="item.file_id" class="file-chip" @click.stop>
                      <ElIcon class="chip-icon"><Document /></ElIcon>
                      <span class="chip-text">{{ getFileName(item.file_id) }}</span>
                      <div class="chip-close" @click.stop="removeFile(String(key), item.file_id)">×</div>
                    </div>
                  </div>
                </div>
              </div>

              <ElInput
                v-else-if="property.type === 'string'"
                v-model="localModel[key]"
                placeholder="请输入内容"
                class="modern-input"
                size="large"
              />
            </ElFormItem>
          </ElCol>
        </template>
      </ElRow>
    </ElForm>

    <!-- 文件选择弹窗：支持筛选/搜索/分页 -->
    <ElDialog
      v-model="fileDialogVisible"
      title="选择文件"
      width="70%"
      :before-close="
        () => {
          fileDialogVisible = false;
        }
      "
      append-to-body
      class="file-dialog"
    >
      <div class="dialog-header-bar">
        <div class="filter-wrapper">
          <span class="filter-label">类型筛选：</span>
          <ElInput
            v-model="selectedFileType"
            placeholder="输入类型"
            class="pretty-input-short"
            clearable
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </div>

        <div class="search-group">
          <ElInput
            v-model="searchKeyword"
            placeholder="搜索文件名 (回车确认)"
            class="pretty-input"
            clearable
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          >
            <template #prefix>
              <ElIcon class="input-icon"><Search /></ElIcon>
            </template>
          </ElInput>

          <ElButton type="primary" class="pretty-search-btn" @click="handleSearch">
            <ElIcon><Search /></ElIcon>
            <span>查询</span>
          </ElButton>
        </div>
      </div>

      <ElTable
        ref="dialogTableRef"
        v-loading="loadingFiles"
        :data="availableFiles"
        height="400px"
        :row-key="r => String(r.file_id)"
        class="dialog-table"
        @selection-change="val => (tempSelection = val)"
        @row-click="handleRowClick"
      >
        <ElTableColumn type="selection" width="55" reserve-selection />
        <ElTableColumn property="file_name" label="文件名" show-overflow-tooltip>
          <template #default="{ row }">
            <ElIcon class="el-icon--left"><Document /></ElIcon>
            <span>{{ row.file_name }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn property="file_type" label="类型" width="120">
          <template #default="{ row }">
            <ElTag size="small" type="info">{{ row.file_type }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn property="file_size" label="大小" width="100">
          <template #default="{ row }">
            {{ formatFileSize(row.file_size) }}
          </template>
        </ElTableColumn>
        <ElTableColumn property="upload_user.username" label="上传者" width="120" />
      </ElTable>

      <div class="pagination-wrapper">
        <ElPagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :pager-count="5"
          layout="total, prev, pager, next, jumper"
          background
          small
          @current-change="handlePageChange"
        />
      </div>

      <template #footer>
        <span class="dialog-footer">
          <ElButton @click="fileDialogVisible = false">取消</ElButton>
          <ElButton type="primary" @click="confirmFileSelection">确认选择</ElButton>
        </span>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
/* 全局变量 */
.dynamic-form-wrapper {
  --primary-color: #409eff;
  --bg-color-hover: #f5f7fa;
  --border-color: #e4e7ed;
  --input-height: 42px;
}

/* 表单整体布局 */
.modern-form :deep(.el-form-item) {
  margin-bottom: 24px;
}

/* 自定义标签 */
.field-label {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
}
.required-dot {
  color: #f56c6c;
  margin-left: 4px;
}
.modern-form :deep(.el-form-item__label:before) {
  display: none;
}

/* === 输入框与选择框美化 (表单部分) === */
.modern-input :deep(.el-input__wrapper),
.modern-select :deep(.el-select__wrapper),
.modern-input-number :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px #dcdfe6 inset;
  border-radius: 8px;
  height: var(--input-height);
  padding: 0 16px;
  transition: all 0.2s;
}

.modern-input-number {
  width: 100%;
}

.modern-select {
  width: 100%;
}

.modern-input :deep(.el-input__wrapper:hover),
.modern-select :deep(.el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--primary-color) inset;
}

.modern-input :deep(.el-input__wrapper.is-focus),
.modern-select :deep(.el-select__wrapper.is-focused) {
  box-shadow:
    0 0 0 1px var(--primary-color) inset,
    0 0 0 4px rgba(64, 158, 255, 0.1);
}

/* === 核心：大型文件上传区 (Hero Zone) === */
.file-upload-hero {
  width: 100%;
  min-height: 140px;
  background-color: #f9fafb;
  border: 2px dashed #dcdfe6;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  padding: 20px;
  box-sizing: border-box;
}

.file-upload-hero:hover {
  border-color: var(--primary-color);
  background-color: #ecf5ff;
}

/* 占位状态 */
.hero-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.icon-circle {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
  transition: transform 0.3s;
}

.file-upload-hero:hover .icon-circle {
  color: var(--primary-color);
  transform: translateY(-4px);
}

.hero-text {
  text-align: center;
  display: flex;
  flex-direction: column;
}

.primary-text {
  font-size: 15px;
  font-weight: 500;
  color: #606266;
  margin-bottom: 4px;
}

.sub-text {
  font-size: 12px;
  color: #909399;
}

/* 已选文件状态 */
.hero-content {
  width: 100%;
}

.hero-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.05);
  width: 100%;
}

.file-count {
  font-size: 12px;
  font-weight: 600;
  color: #606266;
}

.add-more-btn {
  font-size: 12px;
  color: var(--primary-color);
  display: flex;
  align-items: center;
  gap: 4px;
}

.selected-tags-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}

/* 文件胶囊 (Chip) */
.file-chip {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 8px 0 10px;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 13px;
  color: #606266;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.file-chip:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.chip-icon {
  margin-right: 6px;
  color: #909399;
}

.chip-text {
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip-close {
  margin-left: 8px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  color: #c0c4cc;
}

.chip-close:hover {
  background: #f56c6c;
  color: #fff;
}

/* === 弹窗部分样式 === */
.dialog-table :deep(.el-table__row) {
  cursor: pointer;
}

.dialog-header-bar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
  padding: 16px;
  background-color: #f8f9fb;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}

.filter-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
}

.search-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 圆润的输入框与选择框 */
.pretty-select {
  width: 160px;
}

.pretty-input {
  width: 280px;
}

.pretty-input-short {
  width: 160px;
}

.pretty-select :deep(.el-select__wrapper),
.pretty-input :deep(.el-input__wrapper),
.pretty-input-short :deep(.el-input__wrapper) {
  border-radius: 20px;
  box-shadow: 0 0 0 1px #dcdfe6 inset;
  padding-left: 12px;
}

.pretty-input :deep(.el-input__wrapper.is-focus),
.pretty-input-short :deep(.el-input__wrapper.is-focus) {
  box-shadow:
    0 0 0 1px var(--primary-color) inset,
    0 2px 8px rgba(64, 158, 255, 0.15);
}

.pretty-search-btn {
  height: 32px;
  padding: 0 20px;
  border-radius: 20px;
  border: none;
  background: linear-gradient(135deg, #409eff 0%, #3a8ee6 100%);
  box-shadow: 0 4px 10px rgba(64, 158, 255, 0.3);
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.pretty-search-btn:hover {
  background: linear-gradient(135deg, #66b1ff 0%, #409eff 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 15px rgba(64, 158, 255, 0.4);
}

.pretty-search-btn:active {
  transform: translateY(1px);
  box-shadow: 0 2px 5px rgba(64, 158, 255, 0.2);
}

.input-icon {
  color: #909399;
}

/* 底部区域 */
.file-dialog :deep(.el-dialog__footer) {
  border-top: 1px solid #ebeef5;
  padding: 14px 20px;
  margin-top: 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}

.dialog-footer :deep(.el-button) {
  height: 32px;
  padding: 0 18px;
  border-radius: 20px;
  font-size: 13px;
}

.dialog-footer :deep(.el-button--default) {
  background-color: #fff;
  border-color: #dcdfe6;
  color: #606266;
}

.dialog-footer :deep(.el-button--default:hover) {
  background-color: #f5f7fa;
}

.dialog-footer :deep(.el-button--primary) {
  border: none;
  background: linear-gradient(135deg, #409eff 0%, #3a8ee6 100%);
  box-shadow: 0 4px 10px rgba(64, 158, 255, 0.3);
  font-weight: 500;
}

.dialog-footer :deep(.el-button--primary:hover) {
  background: linear-gradient(135deg, #66b1ff 0%, #409eff 100%);
  box-shadow: 0 6px 15px rgba(64, 158, 255, 0.4);
  transform: translateY(-1px);
}

.dialog-footer :deep(.el-button--primary:active) {
  transform: translateY(1px);
  box-shadow: 0 2px 5px rgba(64, 158, 255, 0.2);
}

/* [新增] 分页容器样式 */
.pagination-wrapper {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end; /* 靠右对齐 */
  padding: 0 8px;
}

/* 调整表格样式 */
.dialog-table {
  width: 100%;
  border-radius: 4px;
  overflow: hidden;
}
</style>
