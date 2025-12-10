<script setup lang="ts">
// =============================================================================
// 1. 依赖引入
// =============================================================================
import { onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
// Element Plus 组件与类型
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
// 图标库
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
// API 接口
import {
  type StartTaskChainParams,
  type TaskChainDetailInput,
  type TaskChainDetailParameter,
  fetchTaskChainDetail,
  startTaskChainAnalysis
} from '@/service/api/task_chain';
import { request } from '@/service/request';

/**
 * # ===========================================================================
 *
 * # 类型定义 (TypeScript Interfaces)
 *
 * # ===========================================================================
 */

// 上传者信息
interface UploadUser {
  user_id: number;
  username: string;
}

// 文件实体信息
interface FileInfo {
  file_id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  created_time: string;
  upload_user: UploadUser;
}

// 文件列表分页响应结构
interface PaginatedFilesResponse {
  count: number;
  page: number;
  page_size: number;
  results: FileInfo[];
}

// 扩展后的参数定义接口：用于前端处理参数限制、默认值等
interface TaskChainParamItem extends TaskChainDetailParameter {
  name: string;
  type: string;
  limit: any; // 参数说明/Tooltip
  min: number | null; // 最小值限制
  max: number | null; // 最大值限制
  enum: any[] | null; // 枚举值列表
  default?: any; // 默认值
}

// 获取文件列表的请求参数
interface FetchFileListParams {
  page: number;
  pageSize: number;
  fileType?: string;
  file_name?: string;
  meta_ids?: string[]; // 根据 meta_id 过滤特定类型文件
}

/**
 * # ===========================================================================
 *
 * # API 封装 (Local API Wrappers)
 *
 * # ===========================================================================
 */

// 封装文件列表请求，处理参数映射
function fetchFileList({ page, pageSize, fileType, file_name, meta_ids }: FetchFileListParams) {
  const params: Record<string, any> = { page, page_size: pageSize };
  if (fileType) params.file_type = fileType;
  if (file_name) params.file_name = file_name;
  // 将数组格式的 meta_ids 转换为逗号分隔字符串传递给后端
  if (meta_ids && meta_ids.length > 0) {
    params.meta_ids = meta_ids.join(',');
  }
  return request<PaginatedFilesResponse>({ url: '/files/list', method: 'get', params });
}

/**
 * # ===========================================================================
 *
 * # 核心逻辑层 (Core Logic)
 *
 * # ===========================================================================
 */

// --- 路由与基础状态 ---
const route = useRoute();
const router = useRouter();
const taskChainId = Number(route.params.id); // 从 URL 获取当前任务链 ID
const taskChainName = ref(''); // 任务链名称
const loadingDetail = ref(false); // 详情加载状态
const submitting = ref(false); // 提交按钮 Loading

// --- 动态表单定义与数据模型 ---
// 后端定义的“需要输入的文件”列表
const chainInputDefs = ref<TaskChainDetailInput[]>([]);
// 后端定义的“需要配置的参数”列表
const chainParamDefs = ref<TaskChainParamItem[]>([]);

// 表单响应式数据模型 (核心)
const formModel = reactive({
  // 文件映射表：key=文件名(槽位名), value=已选文件数组
  filesMap: {} as Record<string, FileInfo[]>,
  // 参数映射表：key=参数名, value=参数值
  paramsMap: {} as Record<string, any>
});

// 动态生成的校验规则
const dynamicRules = ref<FormRules>({});
// Form 实例引用，用于触发表单验证
const formRef = ref();

// --- 文件选择弹窗状态 ---
const fileDialogVisible = ref(false);
const currentActiveInputName = ref<string>(''); // 当前正在为哪个槽位选择文件
const currentMetaIds = ref<string[]>([]); // 当前槽位限制的 Meta ID
const availableFiles = ref<FileInfo[]>([]); // 弹窗内的文件列表数据
const loadingFiles = ref(false); // 文件列表加载中
const searchKeyword = ref(''); // 弹窗搜索词
// 弹窗分页状态
const pagination = ref({ page: 1, pageSize: 10, total: 0, hasNextPage: true });
// 临时选中状态：用户在弹窗中选中但未点“确认”前的数据
const tempSelection = ref<FileInfo[]>([]);
const dialogTableRef = ref(); // 弹窗表格引用

/**
 * # ===========================================================================
 *
 * # 1. 初始化逻辑 (Initialization)
 *
 * # 功能：获取任务链详情，并根据后端返回的元数据构建动态表单
 *
 * # ===========================================================================
 */
async function initData() {
  if (!taskChainId) return;
  loadingDetail.value = true;
  try {
    const res = await fetchTaskChainDetail(taskChainId);
    if (res.data) {
      const data = res.data;
      taskChainName.value = data.name;

      // 1. 初始化文件槽位
      chainInputDefs.value = data.input || [];
      chainInputDefs.value.forEach(def => {
        // 为每个文件槽位在 formModel 中初始化一个空数组
        if (def.file_name) formModel.filesMap[def.file_name] = [];
      });

      // 2. 初始化参数配置
      chainParamDefs.value = (data.parameters || []) as TaskChainParamItem[];

      // 3. 动态生成参数校验规则 & 设置默认值
      const rules: FormRules = {};
      chainParamDefs.value.forEach(p => {
        // --- 设置默认值 ---
        let defaultValue = p.default;
        if (defaultValue === undefined) {
          // 如果后端没给默认值，根据类型自动填充
          if (p.type === 'boolean') defaultValue = false;
          else if (p.type === 'enum' && p.enum && p.enum.length > 0) defaultValue = p.enum[0];
          else defaultValue = null;
        }
        formModel.paramsMap[p.name] = defaultValue;

        // --- 生成校验规则 ---
        const itemRules: FormItemRule[] = [{ required: true, message: '此项必填', trigger: 'change' }];

        // 针对数值类型，添加最大值/最小值校验器
        if ((p.type === 'integer' || p.type === 'float') && (p.min !== null || p.max !== null)) {
          itemRules.push({
            validator: (_rule: any, value: number, callback: any) => {
              if (value === null || value === undefined) return callback();
              if (p.min !== null && value < p.min) return callback(new Error(`不能小于 ${p.min}`));
              if (p.max !== null && value > p.max) return callback(new Error(`不能大于 ${p.max}`));
              return callback();
            },
            trigger: 'blur' // 失去焦点时校验
          });
        }
        rules[p.name] = itemRules;
      });
      dynamicRules.value = rules; // 绑定到 ElForm
    }
  } catch {
    ElMessage.error('加载任务链详情失败');
  } finally {
    loadingDetail.value = false;
  }
}

/**
 * # ===========================================================================
 *
 * # 2. 文件选择弹窗逻辑 (File Selection Modal)
 *
 * # ===========================================================================
 */

// 格式化文件大小工具函数
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`;
};

/**
 * 打开文件选择弹窗
 *
 * @param inputName 当前点击的文件槽位名称（Input Name）
 */
const openFileDialog = (inputName: string) => {
  currentActiveInputName.value = inputName;
  searchKeyword.value = '';
  availableFiles.value = [];
  // 重置分页
  pagination.value = { page: 1, pageSize: 10, total: 0, hasNextPage: true };

  // 【重要】将主表单中已选的文件，复制一份给“临时选中状态”
  // 这样用户在弹窗里操作不会直接影响外面，直到点击确认
  tempSelection.value = [...(formModel.filesMap[inputName] || [])];

  // 查找该槽位是否有 meta_id 限制（例如只能选 fastq 类型文件）
  const def = chainInputDefs.value.find(i => i.file_name === inputName);
  if (def && def.meta_id) {
    currentMetaIds.value = [String(def.meta_id)];
  } else {
    currentMetaIds.value = [];
  }

  loadFilesPage(); // 加载第一页数据
  fileDialogVisible.value = true;
};

// 加载文件列表数据
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
      availableFiles.value = res.data.results;
      pagination.value.total = res.data.count;
      // 计算是否有下一页
      const currentLoadedCount = pagination.value.page * pagination.value.pageSize;
      pagination.value.hasNextPage = currentLoadedCount < res.data.count;
    }
  } catch {
    ElMessage.error('加载文件失败');
  } finally {
    loadingFiles.value = false;
  }
}

// 确认选择：将临时选中数据同步到主表单
const confirmFileSelection = () => {
  if (currentActiveInputName.value) {
    formModel.filesMap[currentActiveInputName.value] = [...tempSelection.value];
  }
  fileDialogVisible.value = false;
};

/** 处理表格选中变化 (Multi-select) 这里包含了“单选强制互斥”的逻辑 */
const handleSelectionChange = (val: FileInfo[]) => {
  const currentDef = chainInputDefs.value.find(i => i.file_name === currentActiveInputName.value);
  const isMultiple = currentDef?.multiple ?? false; // 检查当前槽位是否允许多选

  if (!isMultiple && val.length > 1) {
    // 如果是单选模式，但用户选了多个 -> 保留最后一个选的
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

// 处理行点击：点击行也能选中，体验更好
const handleRowClick = (row: FileInfo) => {
  const currentDef = chainInputDefs.value.find(i => i.file_name === currentActiveInputName.value);
  const isMultiple = currentDef?.multiple ?? false;

  if (!isMultiple) {
    // 单选模式：清除其他，选中当前
    if (dialogTableRef.value) {
      dialogTableRef.value.clearSelection();
      dialogTableRef.value.toggleRowSelection(row, true);
    }
    tempSelection.value = [row];
  } else if (dialogTableRef.value) {
    // 多选模式：切换选中状态
    dialogTableRef.value.toggleRowSelection(row);
  }
};

// 监听弹窗显示：弹窗打开且数据加载后，自动回显已选中的行
watch(fileDialogVisible, visible => {
  if (visible) {
    setTimeout(() => {
      if (!dialogTableRef.value) return;
      dialogTableRef.value.clearSelection();
      // 使用 Set 加速查找
      const selectedIds = new Set(tempSelection.value.map(f => f.file_id));
      availableFiles.value.forEach(row => {
        if (selectedIds.has(row.file_id)) {
          dialogTableRef.value!.toggleRowSelection(row, true);
        }
      });
    }, 100); // 延时确保 DOM/Table 数据已渲染
  }
});

// 搜索处理
const handleSearch = () => {
  availableFiles.value = [];
  pagination.value = { page: 1, pageSize: 20, total: 0, hasNextPage: true };
  loadFilesPage();
};

// 分页处理
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

/**
 * # ===========================================================================
 *
 * # 3. 提交与辅助逻辑 (Submission & Helpers)
 *
 * # ===========================================================================
 */

// 辅助：提取错误信息
function getErrorMessage(error: any): string {
  return error?.response?.data?.message || error?.message || '任务创建失败，请稍后重试';
}
// 辅助：标准化 API 响应（兼容直接返回 data 或包装在 response 对象中的情况）
function normalizeApiResponse(res: any): any {
  return res.data || (res as any).response?.data;
}

/** 提交表单 流程：1. 校验文件 -> 2. 校验参数 -> 3. 组装 JSON -> 4. 发送请求 */
const handleSubmit = async () => {
  // 1. 手动校验：所有定义的文件槽位必须有值
  for (const def of chainInputDefs.value) {
    const files = formModel.filesMap[def.file_name!] || [];
    if (files.length === 0) {
      ElMessage.warning(`请选择输入文件：${def.file_name}`);
      return;
    }
  }

  if (!formRef.value) return;

  // 2. Element Form 校验参数
  await formRef.value.validate(async (valid: boolean) => {
    if (valid) {
      const parameter_json: Record<string, any> = {};

      // 3. 组装 Payload
      // 提取所有文件的 ID 放入 inputFiles 数组
      const allSelectedFiles: { file_id: number }[] = [];
      Object.keys(formModel.filesMap).forEach(key => {
        const files = formModel.filesMap[key];
        files.forEach(f => {
          allSelectedFiles.push({ file_id: f.file_id });
        });
      });
      parameter_json.inputFiles = allSelectedFiles;

      // 合并普通参数
      Object.keys(formModel.paramsMap).forEach(key => {
        parameter_json[key] = formModel.paramsMap[key];
      });

      const payload: StartTaskChainParams = {
        task_chain_id: taskChainId,
        parameter_json
      };

      submitting.value = true;

      // 4. 发送请求
      try {
        const res = await startTaskChainAnalysis(payload);
        const apiResponse = normalizeApiResponse(res);

        // 检查业务 Code
        if (apiResponse?.code && apiResponse.code !== '0000') {
          ElMessage.error(apiResponse.message || '创建失败');
          return;
        }

        const taskInfo = apiResponse.data || apiResponse;
        ElMessage.success(apiResponse?.message || '任务创建成功！');

        // 跳转到任务列表页，并携带新任务 ID 以便高亮
        router.push({
          path: '/task/list',
          query: { task_id: taskInfo?.task_id }
        });
      } catch (error: any) {
        const msg = getErrorMessage(error);
        ElMessage.error(msg);
      } finally {
        submitting.value = false;
      }
    } else {
      ElMessage.warning('请检查参数填写是否正确');
    }
  });
};

onMounted(() => {
  initData(); // 页面加载后启动初始化
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
