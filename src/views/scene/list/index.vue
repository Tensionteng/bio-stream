<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Close,
  DataAnalysis,
  Delete,
  Document,
  Odometer,
  Refresh,
  Search,
  View,
  Warning
} from '@element-plus/icons-vue';
// 引入 API (请确保 fetchTaskFileSize 已添加到 api/task.ts)
import {
  type TaskListItem,
  type TaskListParams,
  type TaskStatus,
  cleanTaskFiles,
  fetchTaskFileSize,
  fetchTaskList,
  fetchTotalFileSize
} from '@/service/api/task';
import { fetchTaskInfo, fetchTaskResult } from '@/service/api/visulizaiton';
import TaskDetailDialog from './components/TaskDetailDialog.vue';

// =======================
// Part 1: 任务列表逻辑
// =======================

const loading = ref(false);
const tasks = ref<TaskListItem[]>([]);
const totalSize = ref(0);

// 筛选状态
const filterParams = reactive({
  id: undefined as number | undefined,
  name: '',
  status: '' as TaskStatus | ''
});

// 对话框控制 (详情)
const isDetailDialogVisible = ref(false);
const selectedDetailTaskId = ref<number | null>(null);

// =======================
// Part 1.5: 清理文件逻辑
// =======================
const isDeleteDialogVisible = ref(false);
const deleteLoading = ref(false);
const currentDeleteTaskId = ref<number | null>(null);
const deleteLevel = ref<number>(3);

// [新增] 存储当前选中任务的预览大小数据
const deletePreviewSizes = ref<Record<string, number>>({});

// 清理选项配置
const deleteOptions = [
  { value: 2, label: '保留最终文件+可视化' },
  { value: 3, label: '清理中间文件（保留init、final、visual三个文件夹的文件）' },
  { value: 1, label: '仅保留可视化文件' },
  { value: 0, label: '彻底清理 (全部删除)' }
];

// 格式化字节大小
function formatBytes(bytes: number, decimals = 2) {
  if (Number(bytes) === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

// [新增] 获取对应级别的预览大小文本
const getPreviewSizeText = (level: number) => {
  const key = `size_${level}`;
  const size = deletePreviewSizes.value[key];
  if (size === undefined || size === null) return ''; // 数据还没回来时不显示
  return `(预计释放 ${formatBytes(size)})`;
};

// 打开清理弹窗
function openDeleteDialog(row: TaskListItem) {
  currentDeleteTaskId.value = row.id;
  deleteLevel.value = 2; // 重置为默认推荐值
  isDeleteDialogVisible.value = true;

  // [新增] 重置并获取该任务的文件大小预览
  deletePreviewSizes.value = {};
  fetchTaskFileSize(row.id)
    .then(res => {
      if (res.data) {
        deletePreviewSizes.value = res.data;
      }
    })
    .catch(() => {
      // 忽略错误或记录日志
      // console.warn('获取清理预览大小失败', err);
    });
}

// 获取总占用空间
async function getTaskSize() {
  try {
    const res = await fetchTotalFileSize();
    if (res) {
      totalSize.value = res.data && res.data.total_size ? res.data.total_size : 0;
    }
  } catch {
    // 修复：移除未使用的 _error 变量
    ElMessage.error('获取空间统计失败');
  }
}

// 执行清理
async function handleDeleteSubmit() {
  if (!currentDeleteTaskId.value) return;

  deleteLoading.value = true;
  try {
    const res = await cleanTaskFiles(currentDeleteTaskId.value, deleteLevel.value);

    if (res) {
      const freedSpace =
        res.data && res.data.free_size_size !== undefined ? formatBytes(res.data.free_size_size) : '0 B';
      ElMessage.success({
        message: `清理成功！已释放空间：${freedSpace}`,
        duration: 3000
      });
      isDeleteDialogVisible.value = false;

      // 清理成功后，刷新总空间显示
      getTaskSize();
    }
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error(error);
    ElMessage.error(error.message || '请求异常，请稍后重试');
  } finally {
    deleteLoading.value = false;
  }
}

// 筛选选项
const statusOptions = [
  { label: '运行中', value: 'RUNNING' },
  { label: '成功', value: 'SUCCESS' },
  { label: '失败', value: 'FAILED' },
  { label: '已取消', value: 'CANCELLED' },
  { label: '等待中', value: 'PENDING' }
];

function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    // 修复：移除未使用的 _error
    return isoString;
  }
}

const statusTagType = (status: string | TaskStatus | undefined | null) => {
  if (!status) return 'info';
  const upperStatus = status.toString().toUpperCase();
  switch (upperStatus) {
    case 'SUCCESS':
      return 'success';
    case 'RUNNING':
      return 'primary';
    case 'FAILED':
      return 'danger';
    case 'CANCELLED':
      return 'info';
    case 'PENDING':
      return 'warning';
    default:
      return 'info';
  }
};

const pagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0
});

async function getTasks() {
  loading.value = true;
  try {
    const params: TaskListParams = {
      page: pagination.page,
      page_size: pagination.pageSize,
      status: filterParams.status || undefined,
      task_id: filterParams.id || undefined,
      name: filterParams.name || undefined,
      task_source_type: 'process'
    };

    const { data } = await fetchTaskList(params);
    if (data) {
      tasks.value = data.results || [];
      pagination.itemCount = data.count || 0;
    }
  } catch {
    // 修复：移除未使用的 _error
    ElMessage.error('获取任务列表失败');
  } finally {
    loading.value = false;
  }
}

function handlePageChange(currentPage: number) {
  pagination.page = currentPage;
  getTasks();
}
function handleSizeChange(pageSize: number) {
  pagination.pageSize = pageSize;
  pagination.page = 1;
  getTasks();
}
function handleSearch() {
  pagination.page = 1;
  getTasks();
}
function handleReset() {
  filterParams.id = undefined;
  filterParams.name = '';
  filterParams.status = '';
  handleSearch();
}

function showDetailsDialog(taskId: number) {
  selectedDetailTaskId.value = taskId;
  isDetailDialogVisible.value = true;
}

function handleTaskRestarted() {
  isDetailDialogVisible.value = false;
  getTasks();
}

// =======================
// Part 2: 可视化逻辑
// =======================

const visSectionRef = ref<HTMLElement | null>(null);
const visualizationLoading = ref(false);
const currentVisTaskId = ref<number | null>(null);
const availableFileTypes = ref<Api.Visualization.FileType[]>([]);
const selectedFileType = ref<Api.Visualization.FileType | ''>('');
const visualizationResult = ref<Api.Visualization.Result | null>(null);

const selectedCsvTable = ref<'count_csv' | 'fpk_csv' | 'tpm_csv'>('count_csv');
const csvTableOptions = [
  { label: 'Count CSV', value: 'count_csv' },
  { label: 'FPK CSV', value: 'fpk_csv' },
  { label: 'TPM CSV', value: 'tpm_csv' }
];

const currentCsvData = computed(() => {
  if (visualizationResult.value?.type === 'csv') {
    return visualizationResult.value.data[selectedCsvTable.value] || [];
  }
  return [];
});

const imageList = computed(() => {
  if (visualizationResult.value?.type === 'image') {
    return visualizationResult.value.data.filter(image => Boolean(image.url));
  }
  return [];
});
const imagePreviewUrls = computed(() => imageList.value.map(image => image.url));

const normalizePdfUrl = (url: string) => {
  if (!url) return '';
  const isHttpUrl = /^https?:\/\//i.test(url);
  if (!isHttpUrl) return url;
  try {
    const pdfUrl = new URL(url);
    const serviceBase = import.meta.env.VITE_SERVICE_BASE_URL;
    if (!serviceBase) return url;
    const serviceUrl = new URL(serviceBase);
    const isSameOrigin = pdfUrl.origin === serviceUrl.origin;
    if (!isSameOrigin) return url;
    const proxyPrefix = '/proxy-default';
    const pdfPathWithQuery = `${pdfUrl.pathname}${pdfUrl.search}`;
    return `${proxyPrefix}${pdfPathWithQuery}`;
  } catch {
    // 修复：移除未使用的 _error
    return url;
  }
};

const fetchVisualizationData = async (taskId: number, fileType: Api.Visualization.FileType) => {
  try {
    visualizationLoading.value = true;
    selectedFileType.value = fileType;
    const { data: resultData } = await fetchTaskResult(taskId.toString(), fileType);

    if (resultData && resultData.type === 'pdf') {
      visualizationResult.value = {
        type: 'pdf',
        data: normalizePdfUrl(resultData.data)
      };
    } else {
      visualizationResult.value = resultData ?? null;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('获取数据失败:', error);
    visualizationResult.value = null;
    ElMessage.error('数据加载失败');
  } finally {
    visualizationLoading.value = false;
  }
};

// 修复：将 handleFileTypeClick 移动到使用它的函数 (handleVisualize) 之前
function handleFileTypeClick(fileType: Api.Visualization.FileType) {
  if (currentVisTaskId.value) {
    fetchVisualizationData(currentVisTaskId.value, fileType);
  }
}

async function handleVisualize(taskId: number) {
  if (currentVisTaskId.value === taskId) {
    scrollToVis();
    return;
  }
  currentVisTaskId.value = taskId;
  selectedFileType.value = '';
  visualizationResult.value = null;
  availableFileTypes.value = [];

  nextTick(() => scrollToVis());

  visualizationLoading.value = true;
  try {
    const { data } = await fetchTaskInfo();
    const targetTask = data?.find(t => t.task_id === taskId);

    if (targetTask && targetTask.file_type && targetTask.file_type.length > 0) {
      availableFileTypes.value = targetTask.file_type;
      handleFileTypeClick(targetTask.file_type[0]);
    } else {
      ElMessage.warning(`任务 #${taskId} 暂无可视化数据`);
      currentVisTaskId.value = null;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('获取可视化元数据失败:', error);
    ElMessage.error('无法加载该任务的可视化配置');
  } finally {
    visualizationLoading.value = false;
  }
}

function scrollToVis() {
  visSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const getFileTypeLabel = (fileType: Api.Visualization.FileType) => {
  const labels: Record<string, string> = {
    txt: '文本日志',
    pdf: '分析报告 (PDF)',
    vcf: '变异数据 (VCF)',
    csv: '数据表格',
    image: '结果图表'
  };
  return labels[fileType] || fileType.toUpperCase();
};

const getTableColumns = (data: any[]) => {
  if (!data || data.length === 0) return [];
  const allKeys = new Set<string>();
  data.forEach(row => Object.keys(row).forEach(key => allKeys.add(key)));
  return Array.from(allKeys);
};

const openPdfInNewWindow = (url: string) => {
  window.open(url, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
};

watch(selectedCsvTable, () => {});
watch(visualizationResult, () => {
  if (visualizationResult.value?.type === 'csv') {
    selectedCsvTable.value = 'count_csv';
  }
});

onMounted(() => {
  getTasks();
  getTaskSize(); // 获取总大小
});
</script>

<template>
  <div class="page-container">
    <ElCard shadow="never" class="main-card list-card">
      <template #header>
        <div class="card-header">
          <div class="header-title-area">
            <span>场景任务列表</span>

            <div class="size-stat-badge">
              <ElIcon class="mr-1"><Odometer /></ElIcon>
              <span class="stat-label">总占用空间:</span>
              <span class="stat-value">{{ formatBytes(totalSize) }}</span>
            </div>
          </div>

          <ElButton :icon="Refresh" circle size="small" title="刷新列表" @click="getTasks" />
        </div>
      </template>

      <ElForm :model="filterParams" inline class="filter-bar" @submit.prevent="handleSearch">
        <ElFormItem label="任务ID">
          <ElInput
            v-model.number="filterParams.id"
            class="filter-input"
            placeholder="按ID搜索"
            clearable
            @clear="handleSearch"
          />
        </ElFormItem>
        <ElFormItem label="流程名称">
          <ElInput
            v-model="filterParams.name"
            class="filter-input"
            placeholder="按名称搜索"
            clearable
            @clear="handleSearch"
          />
        </ElFormItem>
        <ElFormItem label="状态">
          <ElSelect
            v-model="filterParams.status"
            class="filter-input filter-select"
            placeholder="选择状态"
            clearable
            @change="handleSearch"
          >
            <ElOption v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem>
          <ElButton class="filter-primary-btn" type="primary" native-type="submit" :loading="loading">
            <ElIcon><Search /></ElIcon>
            查询
          </ElButton>
          <ElButton class="filter-ghost-btn" @click="handleReset">重置</ElButton>
        </ElFormItem>
      </ElForm>

      <ElTable v-loading="loading" :data="tasks" empty-text="暂无任务数据">
        <ElTableColumn prop="id" label="ID" width="80" align="center">
          <template #default="{ row }">
            <span class="text-mono">#{{ row.id }}</span>
          </template>
        </ElTableColumn>

        <ElTableColumn prop="name" label="流程名称" min-width="150">
          <template #default="{ row }">
            <div class="flex flex-col">
              <span class="text-gray-700 font-medium">{{ row.name }}</span>
            </div>
          </template>
        </ElTableColumn>

        <ElTableColumn prop="file_ids" label="文件ID" min-width="120">
          <template #default="{ row }">
            <div v-if="Array.isArray(row.file_ids) && row.file_ids.length" class="file-info">
              <ElIcon class="file-icon"><Document /></ElIcon>
              <span class="file-ids-text">{{ row.file_ids.join(', ') }}</span>
            </div>
            <span v-else class="text-muted">-</span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="start_time" label="开始时间" min-width="170">
          <template #default="{ row }">
            <span class="text-gray-600">{{ formatDateTime(row.start_time) }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <ElTag :type="statusTagType(row.status)" effect="plain" round size="small" class="status-tag">
              {{ row.status }}
            </ElTag>
          </template>
        </ElTableColumn>

        <ElTableColumn label="操作" width="220" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-buttons">
              <ElButton link type="info" class="action-btn" @click="showDetailsDialog(row.id)">
                <ElIcon><View /></ElIcon>
                详情
              </ElButton>

              <ElButton
                v-if="row.status?.toUpperCase() === 'SUCCESS'"
                link
                type="primary"
                class="action-btn is-vis"
                @click="handleVisualize(row.id)"
              >
                <ElIcon><DataAnalysis /></ElIcon>
                可视化
              </ElButton>

              <ElButton
                v-if="row.status?.toUpperCase() !== 'RUNNING'"
                link
                type="warning"
                class="action-btn"
                @click="openDeleteDialog(row)"
              >
                <ElIcon><Delete /></ElIcon>
                清理
              </ElButton>
            </div>
          </template>
        </ElTableColumn>
      </ElTable>

      <div class="pagination-container">
        <ElPagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="pagination.itemCount"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </ElCard>

    <div v-if="currentVisTaskId" ref="visSectionRef" class="vis-section-wrapper">
      <ElCard shadow="never" class="main-card vis-card">
        <template #header>
          <div class="card-header vis-header">
            <div class="header-left">
              <span class="vis-title">任务 #{{ currentVisTaskId }} 结果分析</span>
              <ElTag size="small" effect="dark" type="primary" class="ml-2">Visualization</ElTag>
            </div>
            <ElButton circle size="small" :icon="Close" title="关闭面板" @click="currentVisTaskId = null" />
          </div>
        </template>

        <div v-loading="visualizationLoading" class="vis-body">
          <div v-if="availableFileTypes.length > 0" class="vis-tabs">
            <div class="vis-tabs-label">查看类型：</div>
            <div class="vis-tabs-group">
              <div
                v-for="type in availableFileTypes"
                :key="type"
                class="vis-tab-item"
                :class="{ active: selectedFileType === type }"
                @click="handleFileTypeClick(type)"
              >
                {{ getFileTypeLabel(type) }}
              </div>
            </div>
          </div>

          <div v-if="selectedFileType === 'csv' && visualizationResult?.type === 'csv'" class="vis-sub-filter">
            <span class="sub-label">表格数据：</span>
            <!-- 修复：移除行内样式，添加 class -->
            <ElSelect v-model="selectedCsvTable" size="small" class="csv-select-width">
              <ElOption v-for="opt in csvTableOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
            </ElSelect>
          </div>

          <div class="vis-content-area">
            <div v-if="visualizationResult?.type === 'txt'" class="txt-viewer">
              <pre>{{ visualizationResult.data }}</pre>
            </div>
            <div v-else-if="visualizationResult?.type === 'pdf'" class="pdf-viewer">
              <div class="pdf-toolbar">
                <ElButton type="primary" link @click="openPdfInNewWindow(visualizationResult.data)">
                  <ElIcon class="mr-1"><View /></ElIcon>
                  新窗口全屏查看
                </ElButton>
              </div>
              <iframe :src="visualizationResult.data" class="pdf-iframe" />
            </div>
            <div
              v-else-if="visualizationResult?.type === 'vcf' || visualizationResult?.type === 'csv'"
              class="table-viewer"
            >
              <!-- 修复：移除行内样式 :style -->
              <ElTable
                :data="visualizationResult.type === 'csv' ? currentCsvData : visualizationResult.data"
                border
                stripe
                height="500px"
                class="full-width-table"
              >
                <ElTableColumn
                  v-for="col in getTableColumns(
                    visualizationResult.type === 'csv' ? currentCsvData : visualizationResult.data
                  )"
                  :key="col"
                  :prop="col"
                  :label="col"
                  min-width="120"
                  show-overflow-tooltip
                />
              </ElTable>
            </div>
            <div v-else-if="visualizationResult?.type === 'image'" class="image-viewer">
              <div v-if="imageList.length" class="image-grid">
                <div v-for="(img, idx) in imageList" :key="idx" class="image-card">
                  <ElImage
                    :src="img.url"
                    :preview-src-list="imagePreviewUrls"
                    :initial-index="idx"
                    fit="contain"
                    class="image-entity"
                    loading="lazy"
                  />
                  <div class="image-name">{{ img.name }}</div>
                </div>
              </div>
              <ElEmpty v-else description="暂无图片数据" />
            </div>
            <ElEmpty v-else-if="!visualizationLoading && !visualizationResult" description="请选择上方类型以查看数据" />
          </div>
        </div>
      </ElCard>
    </div>

    <TaskDetailDialog
      v-model="isDetailDialogVisible"
      :task-id="selectedDetailTaskId"
      @task-restarted="handleTaskRestarted"
    />

    <ElDialog v-model="isDeleteDialogVisible" title="任务文件清理" width="520px" align-center class="cleanup-dialog">
      <div class="delete-dialog-content">
        <div class="warning-banner">
          <div class="icon-wrapper">
            <ElIcon><Warning /></ElIcon>
          </div>
          <div class="warning-text">
            <p class="warning-title">清理操作不可逆</p>
            <p class="warning-desc">请仔细确认您需要保留的文件级别，清理后无法恢复。</p>
          </div>
        </div>

        <div class="section-title">选择清理级别</div>

        <div class="options-container">
          <div
            v-for="opt in deleteOptions"
            :key="opt.value"
            class="option-card"
            :class="{ 'is-active': deleteLevel === opt.value }"
            @click="deleteLevel = opt.value"
          >
            <div class="radio-indicator">
              <div class="radio-inner"></div>
            </div>

            <div class="option-content">
              <div class="option-header">
                <span class="option-title">{{ opt.label }}</span>

                <span v-if="getPreviewSizeText(opt.value)" class="size-preview-text">
                  {{ getPreviewSizeText(opt.value) }}
                </span>

                <ElTag v-if="opt.value === 2" type="danger" size="small" effect="plain" round class="recommend-tag">
                  推荐
                </ElTag>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer-actions">
          <ElButton class="cancel-btn" @click="isDeleteDialogVisible = false">取消</ElButton>
          <ElButton type="danger" :loading="deleteLoading" class="confirm-btn" @click="handleDeleteSubmit">
            确认清理
          </ElButton>
        </div>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
/* 基础样式 */
.page-container {
  padding: 24px;
  background: #f5f7fb;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.main-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
  transition: all 0.3s;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  font-size: 16px;
  color: #303133;
}
.header-title-area {
  display: flex;
  align-items: center;
  position: relative;
  padding-left: 12px;
}
.header-title-area::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 16px;
  border-radius: 4px;
  background: linear-gradient(180deg, #409eff, #66b1ff);
}

/* === 空间统计样式 === */
.size-stat-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 20px;
  background: #f0f9eb;
  color: #67c23a;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: normal;
}
.stat-label {
  margin-right: 4px;
  color: #606266;
}
.stat-value {
  font-weight: 700;
  font-family: 'Consolas', monospace;
}

.filter-bar {
  margin-bottom: 16px;
  margin-top: 6px;
}
.filter-input {
  width: 180px;
}
.filter-select {
  width: 140px;
}
.filter-input :deep(.el-input__wrapper),
.filter-input :deep(.el-select__wrapper) {
  border-radius: 99px;
  box-shadow: 0 0 0 1px #dcdfe6 inset;
}
.filter-primary-btn {
  border-radius: 99px;
  background: linear-gradient(135deg, #8c9dff, #5c7cff);
  border: none;
  box-shadow: 0 4px 12px rgba(92, 124, 255, 0.3);
}
.filter-primary-btn:hover {
  background: linear-gradient(135deg, #7b90ff, #4c6dff);
  transform: translateY(-1px);
}
.filter-ghost-btn {
  border-radius: 99px;
  margin-left: 10px;
}
.text-mono {
  font-family: monospace;
  color: #909399;
}
.file-info {
  display: inline-flex;
  align-items: center;
  background: #f8f9fa;
  padding: 2px 8px;
  border-radius: 4px;
  color: #606266;
  font-size: 12px;
}
.file-ids-text {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: 4px;
  font-family: monospace;
}
.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
}
.action-btn {
  font-size: 13px;
}
.action-btn.is-vis {
  color: #626aef;
  font-weight: 600;
}
.action-btn.is-vis:hover {
  color: #4e56de;
}
.vis-section-wrapper {
  animation: slideIn 0.4s ease-out;
}
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.vis-header {
  border-bottom: none;
  padding-bottom: 0;
}
.header-left {
  display: flex;
  align-items: center;
}
.vis-title {
  font-size: 18px;
  color: #1a1a1a;
}
.vis-body {
  padding: 8px 0;
}
.vis-tabs {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #f0f2f5;
  padding-bottom: 12px;
}
.vis-tabs-label {
  font-size: 14px;
  font-weight: 600;
  color: #606266;
  margin-right: 16px;
}
.vis-tabs-group {
  display: flex;
  gap: 8px;
}
.vis-tab-item {
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #606266;
  background: #f5f7fa;
  transition: all 0.2s;
}
.vis-tab-item:hover {
  background: #e6e8eb;
  color: #303133;
}
.vis-tab-item.active {
  background: #ecf5ff;
  color: #409eff;
  font-weight: 600;
}
.vis-sub-filter {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}
.sub-label {
  font-size: 13px;
  color: #606266;
  margin-right: 8px;
}
.vis-content-area {
  min-height: 400px;
}
.txt-viewer pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 8px;
  font-family: 'Consolas', monospace;
  font-size: 13px;
  max-height: 600px;
  overflow: auto;
}
.pdf-viewer {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
}
.pdf-toolbar {
  background: #f5f7fa;
  padding: 8px;
  text-align: right;
  border-bottom: 1px solid #e4e7ed;
}
.pdf-iframe {
  width: 100%;
  height: 700px;
  border: none;
  display: block;
}
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}
.image-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  transition: all 0.3s;
  background: #fff;
}
.image-card:hover {
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}
.image-entity {
  width: 100%;
  height: 180px;
  background: #f9f9f9;
  border-radius: 4px;
  margin-bottom: 8px;
}
.image-name {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.text-xs {
  font-size: 12px;
}
.text-gray-400 {
  color: #9ca3af;
}
.mt-1 {
  margin-top: 4px;
}
.flex-col {
  flex-direction: column;
  display: flex;
}

/* === 清理弹窗样式 (UI优化) === */
.cleanup-dialog :deep(.el-dialog__body) {
  padding-top: 10px;
  padding-bottom: 20px;
}
.warning-banner {
  background: #fff1f0;
  border: 1px solid #ffccc7;
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}
.icon-wrapper {
  color: #ff4d4f;
  font-size: 18px;
  padding-top: 2px;
}
.warning-text {
  flex: 1;
}
.warning-title {
  font-weight: 600;
  color: #1f1f1f;
  font-size: 14px;
  margin: 0 0 4px 0;
}
.warning-desc {
  color: #595959;
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
}
.section-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 12px;
  padding-left: 4px;
}
.options-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.option-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  padding: 16px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  background: #fff;
}
.option-card:hover {
  border-color: #ff7875;
  background-color: #fffbfb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}
.option-card.is-active {
  border-color: #ff4d4f;
  background-color: #fff1f0;
  box-shadow: 0 0 0 1px #ff4d4f inset;
}
.radio-indicator {
  width: 18px;
  height: 18px;
  border: 2px solid #dcdfe6;
  border-radius: 50%;
  margin-right: 14px;
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  flex-shrink: 0;
  transition: all 0.2s;
}
.option-card.is-active .radio-indicator {
  border-color: #ff4d4f;
  background: #ff4d4f;
}
.radio-inner {
  width: 8px;
  height: 8px;
  background: #fff;
  border-radius: 50%;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.2s;
}
.option-card.is-active .radio-inner {
  opacity: 1;
  transform: scale(1);
}
.option-content {
  flex: 1;
}
.option-header {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}
.option-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-right: 8px;
}
/* 新增样式：文件大小预览文本 */
.size-preview-text {
  font-size: 13px;
  color: #909399;
  margin-right: 8px;
  font-family: 'Consolas', monospace;
}
.recommend-tag {
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
}
.dialog-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.confirm-btn {
  padding: 8px 24px;
}

/* === 新增/修改的工具类样式 (解决 inline style warning) === */
.csv-select-width {
  width: 160px;
}
.full-width-table {
  width: 100%;
}
</style>
