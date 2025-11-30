<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
  ElTooltip,
  type FormItemRule,
  type FormRules
} from 'element-plus';
import {
  ArrowLeft,
  CircleCheckFilled,
  Document,
  Files,
  FolderOpened,
  InfoFilled,
  Operation,
  Promotion,
  Search
} from '@element-plus/icons-vue';
// 引入 API
import {
  type StartTaskChainParams,
  type TaskChainDetailInput,
  type TaskChainDetailParameter,
  fetchTaskChainDetail,
  startTaskChainAnalysis
} from '@/service/api/task_chain';
import { request } from '@/service/request';

// --- 类型定义 ---
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

interface TaskChainParamItem extends TaskChainDetailParameter {
  name: string;
  type: string;
  limit: any;
  min: number | null;
  max: number | null;
  enum: any[] | null;
  default?: any;
}

interface FetchFileListParams {
  page: number;
  pageSize: number;
  fileType?: string;
  file_name?: string;
  meta_ids?: string[];
}

// 获取文件列表封装
function fetchFileList({ page, pageSize, fileType, file_name, meta_ids }: FetchFileListParams) {
  const params: Record<string, any> = { page, page_size: pageSize };
  if (fileType) params.file_type = fileType;
  if (file_name) params.file_name = file_name;
  if (meta_ids && meta_ids.length > 0) {
    params.meta_ids = meta_ids.join(',');
  }
  return request<PaginatedFilesResponse>({ url: '/files/list', method: 'get', params });
}

// --- 状态管理 ---
const route = useRoute();
const router = useRouter();
const taskChainId = Number(route.params.id);
const taskChainName = ref('');
const loadingDetail = ref(false);
const submitting = ref(false);

const chainInputDefs = ref<TaskChainDetailInput[]>([]);
const chainParamDefs = ref<TaskChainParamItem[]>([]);
const formModel = reactive({
  filesMap: {} as Record<string, FileInfo[]>,
  paramsMap: {} as Record<string, any>
});

const dynamicRules = ref<FormRules>({});
const formRef = ref();

// --- 文件弹窗相关 ---
const fileDialogVisible = ref(false);
const currentActiveInputName = ref<string>('');
const currentMetaIds = ref<string[]>([]);
const availableFiles = ref<FileInfo[]>([]);
const loadingFiles = ref(false);
const searchKeyword = ref('');
const pagination = ref({ page: 1, pageSize: 10, total: 0, hasNextPage: true });
const tempSelection = ref<FileInfo[]>([]);
const dialogTableRef = ref();

// --- 初始化逻辑 ---
async function initData() {
  if (!taskChainId) return;
  loadingDetail.value = true;
  try {
    const res = await fetchTaskChainDetail(taskChainId);
    if (res.data) {
      const data = res.data;
      taskChainName.value = data.name;

      chainInputDefs.value = data.input || [];
      chainInputDefs.value.forEach(def => {
        if (def.file_name) formModel.filesMap[def.file_name] = [];
      });

      chainParamDefs.value = (data.parameters || []) as TaskChainParamItem[];

      const rules: FormRules = {};
      chainParamDefs.value.forEach(p => {
        let defaultValue = p.default;
        if (defaultValue === undefined) {
          if (p.type === 'boolean') defaultValue = false;
          else if (p.type === 'enum' && p.enum && p.enum.length > 0) defaultValue = p.enum[0];
          else defaultValue = null;
        }
        formModel.paramsMap[p.name] = defaultValue;

        const itemRules: FormItemRule[] = [{ required: true, message: '此项必填', trigger: 'change' }];

        if ((p.type === 'integer' || p.type === 'float') && (p.min !== null || p.max !== null)) {
          itemRules.push({
            validator: (_rule: any, value: number, callback: any) => {
              if (value === null || value === undefined) return callback();
              if (p.min !== null && value < p.min) return callback(new Error(`不能小于 ${p.min}`));
              if (p.max !== null && value > p.max) return callback(new Error(`不能大于 ${p.max}`));
              return callback();
            },
            trigger: 'blur'
          });
        }
        rules[p.name] = itemRules;
      });
      dynamicRules.value = rules;
    }
  } catch {
    ElMessage.error('加载任务链详情失败');
  } finally {
    loadingDetail.value = false;
  }
}

// --- 文件选择逻辑 ---
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`;
};

const openFileDialog = (inputName: string) => {
  currentActiveInputName.value = inputName;
  searchKeyword.value = '';
  availableFiles.value = [];
  // 重置分页状态
  pagination.value = { page: 1, pageSize: 10, total: 0, hasNextPage: true };
  tempSelection.value = [...(formModel.filesMap[inputName] || [])];

  const def = chainInputDefs.value.find(i => i.file_name === inputName);
  if (def && def.meta_id) {
    currentMetaIds.value = [String(def.meta_id)];
  } else {
    currentMetaIds.value = [];
  }

  loadFilesPage();
  fileDialogVisible.value = true;
};

// 【修复核心】：加载文件列表逻辑修改
async function loadFilesPage() {
  if (loadingFiles.value) return;
  loadingFiles.value = true;
  try {
    const res = await fetchFileList({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      file_name: searchKeyword.value,
      meta_ids: currentMetaIds.value
    });
    if (res?.data?.results) {
      // 1. 传统翻页是替换数据，不是追加(push)
      availableFiles.value = res.data.results;

      pagination.value.total = res.data.count;

      // 2. 重新计算是否有下一页
      const currentLoadedCount = pagination.value.page * pagination.value.pageSize;
      pagination.value.hasNextPage = currentLoadedCount < res.data.count;

      // 3. 【已删除】 pagination.value.page += 1;  <-- 这里之前是导致显示第2页的原因
    }
  } catch {
    ElMessage.error('加载文件失败');
  } finally {
    loadingFiles.value = false;
  }
}

const confirmFileSelection = () => {
  if (currentActiveInputName.value) {
    formModel.filesMap[currentActiveInputName.value] = [...tempSelection.value];
  }
  fileDialogVisible.value = false;
};

const handleSelectionChange = (val: FileInfo[]) => {
  const currentDef = chainInputDefs.value.find(i => i.file_name === currentActiveInputName.value);
  const isMultiple = currentDef?.multiple ?? false;

  if (!isMultiple && val.length > 1) {
    const last = val[val.length - 1];
    if (dialogTableRef.value) {
      dialogTableRef.value.clearSelection();
      dialogTableRef.value.toggleRowSelection(last, true);
    }
    tempSelection.value = [last];
    return;
  }
  tempSelection.value = val;
};

const handleRowClick = (row: FileInfo) => {
  const currentDef = chainInputDefs.value.find(i => i.file_name === currentActiveInputName.value);
  const isMultiple = currentDef?.multiple ?? false;

  if (!isMultiple) {
    if (dialogTableRef.value) {
      dialogTableRef.value.clearSelection();
      dialogTableRef.value.toggleRowSelection(row, true);
    }
    tempSelection.value = [row];
  } else if (dialogTableRef.value) {
    dialogTableRef.value.toggleRowSelection(row);
  }
};

watch(fileDialogVisible, visible => {
  if (visible) {
    setTimeout(() => {
      if (!dialogTableRef.value) return;
      dialogTableRef.value.clearSelection();
      const selectedIds = new Set(tempSelection.value.map(f => f.file_id));
      availableFiles.value.forEach(row => {
        if (selectedIds.has(row.file_id)) {
          dialogTableRef.value!.toggleRowSelection(row, true);
        }
      });
    }, 100);
  }
});

const handleSearch = () => {
  availableFiles.value = [];
  pagination.value = { page: 1, pageSize: 20, total: 0, hasNextPage: true };
  loadFilesPage();
};

const goPrevPage = () => {
  if (pagination.value.page <= 1) return;
  pagination.value.page -= 1;
  loadFilesPage();
};

const goNextPage = () => {
  if (!pagination.value.hasNextPage) return;
  pagination.value.page += 1;
  loadFilesPage();
};

// --- 提交逻辑 ---
const handleSubmit = async () => {
  // 1. 校验文件必填
  for (const def of chainInputDefs.value) {
    const files = formModel.filesMap[def.file_name!] || [];
    if (files.length === 0) {
      ElMessage.warning(`请选择输入文件：${def.file_name}`);
      return;
    }
  }

  if (!formRef.value) return;

  // 2. 校验参数并提交
  await formRef.value.validate(async (valid: boolean) => {
    if (valid) {
      const parameter_json: Record<string, any> = {};

      // 将所有文件统一放入 inputFiles 数组
      const allSelectedFiles: { file_id: number }[] = [];
      Object.keys(formModel.filesMap).forEach(key => {
        const files = formModel.filesMap[key];
        files.forEach(f => {
          allSelectedFiles.push({ file_id: f.file_id });
        });
      });
      parameter_json.inputFiles = allSelectedFiles;

      // 组装普通参数
      Object.keys(formModel.paramsMap).forEach(key => {
        parameter_json[key] = formModel.paramsMap[key];
      });

      const payload: StartTaskChainParams = {
        task_chain_id: taskChainId,
        parameter_json
      };

      submitting.value = true;
      try {
        await startTaskChainAnalysis(payload);
        ElMessage.success('任务创建成功！');
        router.push('/task/list');
      } catch {
        ElMessage.error('提交失败');
      } finally {
        submitting.value = false;
      }
    } else {
      ElMessage.warning('请检查参数填写是否正确');
    }
  });
};

onMounted(() => {
  initData();
});
</script>

<template>
  <div class="create-task-page">
    <div class="page-content">
      <div class="page-header">
        <div class="header-left">
          <ElButton class="back-btn" :icon="ArrowLeft" circle @click="router.back()" />
          <div class="header-info">
            <div class="header-title">提交任务链分析</div>
            <div class="header-meta">
              任务链：
              <span class="value">{{ taskChainName }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-loading="loadingDetail" class="form-wrapper">
        <ElForm ref="formRef" :model="formModel.paramsMap" :rules="dynamicRules" label-position="top" class="main-form">
          <div class="section-container">
            <div class="section-header">
              <div class="title-left">
                <div class="icon-box blue-icon">
                  <ElIcon><Files /></ElIcon>
                </div>
                <span class="title-text">输入文件 (Inputs)</span>
              </div>
            </div>

            <div v-if="chainInputDefs.length === 0" class="empty-placeholder">此任务无需输入文件</div>

            <div v-else class="input-grid">
              <div
                v-for="inputDef in chainInputDefs"
                :key="inputDef.file_name ?? ''"
                class="input-card"
                :class="{ 'is-filled': formModel.filesMap[inputDef.file_name!]?.length > 0 }"
                @click="openFileDialog(inputDef.file_name!)"
              >
                <div class="card-top">
                  <div class="input-name" :title="inputDef.file_name ?? undefined">
                    <span class="required-mark">*</span>
                    {{ inputDef.file_name }}
                  </div>
                  <div class="card-badges">
                    <ElTag v-if="inputDef.multiple" size="small" type="primary" effect="plain" round>多文件</ElTag>
                    <ElTag v-else size="small" type="warning" effect="plain" round>单文件</ElTag>
                  </div>
                </div>

                <div class="card-body">
                  <div v-if="!formModel.filesMap[inputDef.file_name!]?.length" class="empty-state">
                    <div class="upload-icon-circle">
                      <ElIcon><FolderOpened /></ElIcon>
                    </div>
                    <span class="hint-text">点击选择文件</span>
                  </div>

                  <div v-else class="file-list-preview">
                    <div
                      v-for="file in formModel.filesMap[inputDef.file_name!].slice(0, 3)"
                      :key="file.file_id"
                      class="mini-file-item"
                    >
                      <div class="file-icon-wrap">
                        <ElIcon><Document /></ElIcon>
                      </div>
                      <span class="fname">{{ file.file_name }}</span>
                    </div>
                    <div v-if="formModel.filesMap[inputDef.file_name!].length > 3" class="more-count">
                      +{{ formModel.filesMap[inputDef.file_name!].length - 3 }} 个文件
                    </div>
                  </div>
                </div>

                <div class="card-footer-status">
                  <span v-if="formModel.filesMap[inputDef.file_name!]?.length" class="status-text success">
                    <ElIcon><CircleCheckFilled /></ElIcon>
                    已就绪
                  </span>
                  <span v-else class="status-text pending">待选择</span>
                  <div class="action-btn">选择</div>
                </div>
              </div>
            </div>
          </div>

          <div class="section-container">
            <div class="section-header">
              <div class="title-left">
                <div class="icon-box purple-icon">
                  <ElIcon><Operation /></ElIcon>
                </div>
                <span class="title-text">参数配置 (Parameters)</span>
              </div>
            </div>

            <div v-if="chainParamDefs.length === 0" class="empty-placeholder">此任务无额外参数</div>

            <div v-else class="params-grid-layout">
              <div v-for="param in chainParamDefs" :key="param.name" class="param-grid-item">
                <div class="custom-label">
                  <span class="p-name">{{ param.name }}</span>
                  <div class="p-meta">
                    <span class="p-type">{{ param.type }}</span>
                    <ElTooltip v-if="param.limit" :content="param.limit" placement="top">
                      <ElIcon class="help-icon"><InfoFilled /></ElIcon>
                    </ElTooltip>
                  </div>
                </div>

                <ElFormItem :prop="param.name" class="compact-form-item">
                  <ElSelect
                    v-if="(param.type === 'enum' || param.enum) && param.enum!.length > 0"
                    v-model="formModel.paramsMap[param.name]"
                    placeholder="请选择"
                    class="full-width"
                    size="large"
                  >
                    <ElOption v-for="opt in param.enum" :key="String(opt)" :label="String(opt)" :value="opt" />
                  </ElSelect>

                  <div v-else-if="param.type === 'boolean'" class="switch-wrapper">
                    <ElSwitch
                      v-model="formModel.paramsMap[param.name]"
                      inline-prompt
                      active-text="ON"
                      inactive-text="OFF"
                      size="large"
                    />
                    <span class="switch-status">{{ formModel.paramsMap[param.name] ? '启用' : '禁用' }}</span>
                  </div>

                  <ElInputNumber
                    v-else-if="param.type === 'integer' || param.type === 'float'"
                    v-model="formModel.paramsMap[param.name]"
                    :min="param.min ?? -Infinity"
                    :max="param.max ?? Infinity"
                    :precision="param.type === 'float' ? 2 : 0"
                    controls-position="right"
                    placeholder="请输入数值"
                    class="full-width"
                    size="large"
                  />

                  <ElInput v-else v-model="formModel.paramsMap[param.name]" placeholder="请输入参数值" size="large" />
                </ElFormItem>
              </div>
            </div>
          </div>

          <div class="form-actions-area">
            <ElButton
              type="primary"
              size="large"
              :loading="submitting"
              :icon="Promotion"
              class="submit-btn-lg"
              @click="handleSubmit"
            >
              提交运行任务
            </ElButton>
            <div class="cancel-link" @click="router.back()">取消并返回</div>
          </div>
        </ElForm>
      </div>
    </div>

    <ElDialog
      v-model="fileDialogVisible"
      title="选择输入文件"
      width="800px"
      append-to-body
      class="file-select-dialog"
      destroy-on-close
    >
      <div class="dialog-toolbar">
        <div class="search-wrapper">
          <ElInput
            v-model="searchKeyword"
            placeholder="搜索文件名..."
            class="search-input"
            clearable
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          >
            <template #prefix>
              <ElIcon class="search-icon"><Search /></ElIcon>
            </template>
          </ElInput>
          <ElButton type="primary" class="search-btn" @click="handleSearch">查询</ElButton>
        </div>

        <div v-if="currentMetaIds.length" class="filter-info">
          <span class="filter-label">自动过滤:</span>
          <ElTag v-for="id in currentMetaIds" :key="id" size="small" type="info" effect="plain">TYPE {{ id }}</ElTag>
        </div>
      </div>

      <div class="table-container">
        <ElTable
          ref="dialogTableRef"
          v-loading="loadingFiles && !availableFiles.length"
          :data="availableFiles"
          height="420px"
          :row-key="(row: any) => String(row.file_id)"
          class="custom-table"
          @selection-change="handleSelectionChange"
          @row-click="handleRowClick"
        >
          <ElTableColumn type="selection" width="50" align="center" />

          <ElTableColumn label="文件名" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="file-name-cell">
                <div class="file-icon-box">
                  <ElIcon><Document /></ElIcon>
                </div>
                <span class="fname-text">{{ row.file_name }}</span>
              </div>
            </template>
          </ElTableColumn>

          <ElTableColumn prop="file_type" label="类型" width="120">
            <template #default="{ row }">
              <ElTag class="type-tag" size="small">{{ row.file_type }}</ElTag>
            </template>
          </ElTableColumn>

          <ElTableColumn prop="file_size" label="大小" width="100">
            <template #default="{ row }">
              <span class="size-text">{{ formatFileSize(row.file_size) }}</span>
            </template>
          </ElTableColumn>

          <ElTableColumn prop="created_time" label="上传时间" width="160">
            <template #default="{ row }">
              <span class="time-text">{{ row.created_time?.split('T')[0] }}</span>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>

      <template #footer>
        <div class="dialog-footer-row">
          <div class="pagination-simple">
            <ElButton circle size="small" :disabled="pagination.page <= 1" @click="goPrevPage">
              <ElIcon><ArrowLeft /></ElIcon>
            </ElButton>
            <span class="page-info">第 {{ pagination.page }} 页</span>
            <ElButton circle size="small" :disabled="!pagination.hasNextPage" @click="goNextPage">
              <ElIcon><ArrowLeft class="arrow-rotate-180" /></ElIcon>
            </ElButton>
          </div>

          <div class="action-group">
            <span v-if="tempSelection.length" class="selection-hint">已选 {{ tempSelection.length }} 项</span>
            <ElButton @click="fileDialogVisible = false">取消</ElButton>
            <ElButton type="primary" class="confirm-btn" @click="confirmFileSelection">确认选择</ElButton>
          </div>
        </div>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
/* 全局容器 */
.create-task-page {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding-bottom: 60px;
}

.page-content {
  width: 98%;
  max-width: 1800px; /* 宽屏适配 */
  margin: 0 auto;
  padding: 24px;
}

/* Header */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.header-left {
  display: flex;
  align-items: center;
}
.back-btn {
  margin-right: 16px;
  border: 1px solid #e4e7ed;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}
.back-btn:hover {
  background-color: #ecf5ff;
  color: #409eff;
  border-color: #c6e2ff;
}
.header-info {
  display: flex;
  flex-direction: column;
}
.header-title {
  font-size: 22px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.2;
}
.header-meta {
  font-size: 13px;
  color: #6b7280;
  margin-top: 4px;
}
.header-meta .value {
  color: #409eff;
  font-weight: 500;
  background: #ecf5ff;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 4px;
}

/* 通用 Section */
.section-container {
  background: #fff;
  border-radius: 12px;
  padding: 28px;
  margin-bottom: 24px;
  box-shadow:
    0 1px 3px rgba(0, 21, 41, 0.02),
    0 4px 8px rgba(0, 0, 0, 0.02);
  border: 1px solid #f0f0f0;
}
.section-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px dashed #e5e7eb;
}
.title-left {
  display: flex;
  align-items: center;
}
.icon-box {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  font-size: 20px;
}
.blue-icon {
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  color: #0284c7;
}
.purple-icon {
  background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
  color: #9333ea;
}
.title-text {
  font-size: 18px;
  font-weight: 600;
  color: #374151;
}

/* Grid for Inputs */
.input-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 24px;
}
.input-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background-color: #fff;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 200px;
}
.input-card:hover {
  border-color: #3b82f6;
  box-shadow:
    0 10px 15px -3px rgba(59, 130, 246, 0.1),
    0 4px 6px -2px rgba(59, 130, 246, 0.05);
  transform: translateY(-3px);
}
.input-card.is-filled {
  border-color: #93c5fd;
  background-color: #fdfdff;
}

/* 卡片细节 */
.card-top {
  padding: 14px 18px;
  background-color: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.input-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 65%;
}
.required-mark {
  color: #ef4444;
  margin-right: 2px;
}
.card-badges {
  display: flex;
  gap: 6px;
}

.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 12px;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #94a3b8;
}
.upload-icon-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-bottom: 10px;
  transition: all 0.3s;
  color: #cbd5e1;
}
.input-card:hover .upload-icon-circle {
  background: #dbeafe;
  color: #3b82f6;
}
.hint-text {
  font-size: 13px;
  font-weight: 500;
}

.file-list-preview {
  width: 100%;
  padding: 0 8px;
}
.mini-file-item {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #475569;
  margin-bottom: 6px;
  background: rgba(255, 255, 255, 0.8);
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}
.file-icon-wrap {
  margin-right: 8px;
  color: #64748b;
  display: flex;
}
.fname {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.more-count {
  font-size: 12px;
  color: #64748b;
  text-align: center;
  margin-top: 6px;
  background: #e2e8f0;
  border-radius: 10px;
  display: inline-block;
  padding: 2px 8px;
  margin-left: 50%;
  transform: translateX(-50%);
}

.card-footer-status {
  padding: 10px 18px;
  border-top: 1px dashed #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  background: #fff;
}
.status-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}
.status-text.pending {
  color: #94a3b8;
}
.status-text.success {
  color: #10b981;
}
.action-btn {
  color: #409eff;
  font-weight: 500;
}

/* --- 参数配置 Grid --- */
.params-grid-layout {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.custom-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.p-name {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}
.p-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}
.p-type {
  font-size: 11px;
  background: #f3f4f6;
  color: #6b7280;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  letter-spacing: 0.5px;
}
.help-icon {
  color: #9ca3af;
  cursor: help;
  font-size: 15px;
  transition: color 0.2s;
}
.help-icon:hover {
  color: #60a5fa;
}

.compact-form-item {
  margin-bottom: 0 !important;
}
.full-width {
  width: 100%;
}
.switch-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 40px;
  background: #f9fafb;
  padding: 0 12px;
  border-radius: 4px;
  border: 1px solid #e5e7eb;
}
.switch-status {
  font-size: 13px;
  color: #4b5563;
  font-weight: 500;
}

/* --- 底部提交区 --- */
.form-actions-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: 40px;
  gap: 16px;
  padding-top: 32px;
  border-top: 1px solid #e5e7eb;
}

.submit-btn-lg {
  width: 280px;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 24px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
  transition: all 0.3s ease;
}
.submit-btn-lg:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
  filter: brightness(1.1);
}
.submit-btn-lg:active {
  transform: translateY(1px);
}

.cancel-link {
  font-size: 14px;
  color: #6b7280;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 4px;
}
.cancel-link:hover {
  color: #1f2937;
}

/* --- 弹窗美化 --- */
:deep(.file-select-dialog) {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
}
:deep(.file-select-dialog .el-dialog__header) {
  margin: 0;
  padding: 20px 24px;
  border-bottom: 1px solid #f0f0f0;
}
:deep(.file-select-dialog .el-dialog__title) {
  font-weight: 600;
  color: #1f2937;
}
:deep(.file-select-dialog .el-dialog__body) {
  padding: 0;
  background-color: #f9fafb;
}
:deep(.file-select-dialog .el-dialog__footer) {
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
  background-color: #fff;
}

.dialog-toolbar {
  padding: 16px 24px;
  background-color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
}
.search-wrapper {
  display: flex;
  gap: 12px;
  align-items: center;
  width: 100%;
  max-width: 400px;
}
.search-input :deep(.el-input__wrapper) {
  border-radius: 20px;
  background-color: #f3f4f6;
  box-shadow: none !important;
  padding-left: 12px;
}
.search-input :deep(.el-input__wrapper.is-focus) {
  background-color: #fff;
  box-shadow: 0 0 0 1px #409eff !important;
}
.search-icon {
  color: #9ca3af;
}
.search-btn {
  border-radius: 20px;
  padding: 8px 20px;
}
.filter-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #6b7280;
}

.table-container {
  padding: 0 24px 24px 24px;
  background-color: #fff;
}
.custom-table {
  --el-table-header-bg-color: #fff;
  --el-table-row-hover-bg-color: #f0f9ff;
}
:deep(.el-table th.el-table__cell) {
  font-weight: 600;
  color: #374151;
  background-color: #fff !important;
  border-bottom: 2px solid #f3f4f6;
}

.file-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.file-icon-box {
  width: 32px;
  height: 32px;
  background-color: #eff6ff;
  color: #3b82f6;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}
.fname-text {
  font-weight: 500;
  color: #1f2937;
}
.type-tag {
  background-color: #f3f4f6;
  border-color: #e5e7eb;
  color: #4b5563;
  border-radius: 4px;
}
.size-text {
  font-family: monospace;
  color: #6b7280;
}
.time-text {
  color: #9ca3af;
  font-size: 12px;
}

.dialog-footer-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.pagination-simple {
  display: flex;
  align-items: center;
  gap: 12px;
}
.page-info {
  font-size: 13px;
  color: #4b5563;
  font-variant-numeric: tabular-nums;
}
.action-group {
  display: flex;
  align-items: center;
  gap: 16px;
}
.selection-hint {
  font-size: 13px;
  color: #409eff;
  font-weight: 500;
}
.confirm-btn {
  padding: 8px 24px;
  font-weight: 500;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);
  transition: all 0.2s;
}
.confirm-btn:hover {
  box-shadow: 0 6px 15px rgba(37, 99, 235, 0.3);
  transform: translateY(-1px);
}

.arrow-rotate-180 {
  transform: rotate(180deg);
}
</style>
