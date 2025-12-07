<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import {
  Close,
  DataAnalysis,
  Delete,
  Document,
  Download,
  Odometer,
  Refresh,
  Search,
  View,
  Warning
} from '@element-plus/icons-vue';
// === ECharts 相关引入 ===
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { GraphChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import VChart from 'vue-echarts';
// === API 和 工具引入 ===
import { cleanTaskFiles, fetchTaskFileSize, fetchTaskList, fetchTotalFileSize } from '@/service/api/task';
import { fetchTaskInfo, fetchTaskResult } from '@/service/api/visulizaiton'; // 请确认这里路径拼写是否是你的实际路径
import { usePermissionGuard } from '@/hooks/business/permission-guard';
import { getServiceBaseURL } from '@/utils/service';
import { localStg } from '@/utils/storage';
import TaskDetailDialog from './components/TaskDetailDialog.vue';

// 注册 ECharts 组件
use([CanvasRenderer, GraphChart, TooltipComponent]);

// ==========================================
// Part 1: 任务列表 & 基础逻辑
// ==========================================

const loading = ref(false);
const tasks = ref<Api.Task.TaskListItem[]>([]);
const totalSize = ref(0);
const route = useRoute();

// 筛选表单
const filterParams = reactive({
  id: undefined as number | undefined,
  name: '',
  status: '' as Api.Task.TaskStatus | ''
});

// 详情弹窗控制
const isDetailDialogVisible = ref(false);
const selectedDetailTaskId = ref<number | null>(null);

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0
});

// 状态枚举
const statusOptions = [
  { label: '运行中', value: 'RUNNING' },
  { label: '成功', value: 'SUCCESS' },
  { label: '失败', value: 'FAILED' },
  { label: '已取消', value: 'CANCELLED' },
  { label: '等待中', value: 'PENDING' }
];

// 获取任务列表
async function getTasks() {
  loading.value = true;
  try {
    const params: Api.Task.TaskListParams = {
      page: pagination.page,
      page_size: pagination.pageSize,
      status: filterParams.status || undefined,
      task_id: filterParams.id || undefined,
      name: filterParams.name || undefined,
      task_source_type: 'task_chain'
    };

    const { data } = await fetchTaskList(params);
    if (data) {
      tasks.value = data.results || [];
      pagination.itemCount = data.count || 0;
    }
  } catch {
    ElMessage.error('获取任务列表失败');
  } finally {
    loading.value = false;
  }
}

// 获取总空间
async function getTaskSize() {
  try {
    const res = await fetchTotalFileSize();
    if (res) totalSize.value = res.data?.total_size ?? 0;
  } catch {
    /* ignore */
  }
}

// 格式化工具
function formatBytes(bytes: number, decimals = 2) {
  if (Number(bytes) === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

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
    return isoString;
  }
}

const statusTagType = (status: string | Api.Task.TaskStatus | undefined | null) => {
  const s = status?.toString().toUpperCase();
  if (s === 'SUCCESS') return 'success';
  if (s === 'RUNNING') return 'primary';
  if (s === 'FAILED') return 'danger';
  if (s === 'PENDING') return 'warning';
  return 'info';
};

// 分页事件
function handlePageChange(p: number) {
  pagination.page = p;
  getTasks();
}
function handleSizeChange(s: number) {
  pagination.pageSize = s;
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

// 详情与重启
function showDetailsDialog(id: number) {
  selectedDetailTaskId.value = id;
  isDetailDialogVisible.value = true;
}
function handleTaskRestarted() {
  isDetailDialogVisible.value = false;
  getTasks();
}

// ==========================================
// Part 2: 可视化逻辑 (核心修改)
// ==========================================

const visSectionRef = ref<HTMLElement | null>(null);
const currentVisTaskId = ref<number | null>(null);
const currentVisProcessName = ref(''); // 用于显示当前任务名
const visualizationLoading = ref(false);
const visualizationResult = ref<any>(null);
const availableFileTypes = ref<Api.Visualization.FileType[]>([]);
const selectedFileType = ref<Api.Visualization.FileType | ''>('');
const selectedCsvTable = ref<'count_csv' | 'fpk_csv' | 'tpm_csv'>('count_csv');

// PDF URL 规范化工具
const normalizePdfUrl = (url: string) => {
  if (!url) return '';
  const isHttpUrl = /^https?:\/\//i.test(url);
  if (!isHttpUrl) return url;
  try {
    const pdfUrl = new URL(url);
    const serviceBase = import.meta.env.VITE_SERVICE_BASE_URL;
    if (!serviceBase) return url;
    const serviceUrl = new URL(serviceBase);
    // 只有同源才走代理
    if (pdfUrl.origin === serviceUrl.origin) {
      const proxyPrefix = '/proxy-default'; // 确保这里前缀与后端Nginx配置一致
      return `${proxyPrefix}${pdfUrl.pathname}${pdfUrl.search}`;
    }
    return url;
  } catch {
    return url;
  }
};

// 加载可视化数据 (含 PDF Blob 修复逻辑)
async function loadVisData(fileType: Api.Visualization.FileType) {
  if (!currentVisTaskId.value) return;

  // 清理旧的 Blob URL 防止内存泄漏
  if (visualizationResult.value?.type === 'pdf' && visualizationResult.value.data.startsWith('blob:')) {
    window.URL.revokeObjectURL(visualizationResult.value.data);
  }

  visualizationLoading.value = true;
  selectedFileType.value = fileType;
  visualizationResult.value = null; // 清空旧数据

  try {
    const { data: resultData } = await fetchTaskResult(currentVisTaskId.value.toString(), fileType);

    if (resultData && resultData.type === 'pdf') {
      // === 核心修复：PDF 使用 Axios 下载流转 Blob ===
      const pdfUrl = normalizePdfUrl(resultData.data);
      const token = localStg.get('token');

      const response = await axios.get(pdfUrl, {
        responseType: 'blob', // 关键：指定响应类型为 blob
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const localPdfUrl = window.URL.createObjectURL(blob);

      visualizationResult.value = {
        type: 'pdf',
        data: localPdfUrl // iframe 加载这个本地 blob url
      };
    } else {
      // 其他类型 (TXT, CSV, Image, Graph) 直接使用
      visualizationResult.value = resultData ?? null;
    }
  } catch (error) {
    console.error('加载可视化数据失败:', error);
    ElMessage.error('加载数据失败，请检查网络或权限');
  } finally {
    visualizationLoading.value = false;
  }
}

// 点击“可视化”按钮触发
async function handleVisualize(row: Api.Task.TaskListItem) {
  if (currentVisTaskId.value === row.id) {
    visSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  currentVisTaskId.value = row.id;
  currentVisProcessName.value = row.name;
  visualizationResult.value = null;
  selectedFileType.value = '';
  availableFileTypes.value = [];

  visualizationLoading.value = true;

  nextTick(() => {
    visSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  try {
    // 1. 获取任务信息以确定有哪些文件类型
    const { data } = await fetchTaskInfo();
    const targetTask = data?.find((t: any) => t.task_id === row.id);

    if (targetTask && Array.isArray(targetTask.file_type) && targetTask.file_type.length > 0) {
      availableFileTypes.value = targetTask.file_type as Api.Visualization.FileType[];
      // 2. 默认加载第一个类型
      loadVisData(availableFileTypes.value[0]);
    } else {
      ElMessage.warning('该任务暂无生成的可视化文件');
      visualizationLoading.value = false;
    }
  } catch {
    ElMessage.error('获取可视化配置失败');
    visualizationLoading.value = false;
  }
}

// 关闭面板并清理
const closeVisPanel = () => {
  if (visualizationResult.value?.type === 'pdf' && visualizationResult.value.data.startsWith('blob:')) {
    window.URL.revokeObjectURL(visualizationResult.value.data);
  }
  currentVisTaskId.value = null;
  visualizationResult.value = null;
};

// 组件销毁时清理
onUnmounted(() => {
  if (visualizationResult.value?.type === 'pdf' && visualizationResult.value.data.startsWith('blob:')) {
    window.URL.revokeObjectURL(visualizationResult.value.data);
  }
});

// 处理下载
const handleDownload = async () => {
  if (!currentVisTaskId.value || !selectedFileType.value) {
    ElMessage.warning('请先选择任务和文件类型');
    return;
  }

  try {
    const token = localStg.get('token');
    const isHttpProxy = import.meta.env.DEV && import.meta.env.VITE_HTTP_PROXY === 'Y';
    const { baseURL } = getServiceBaseURL(import.meta.env, isHttpProxy);

    const response = await axios({
      url: `${baseURL}/visualization/tasks/download/${currentVisTaskId.value}`,
      method: 'GET',
      params: { type: selectedFileType.value },
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        Accept: '*/*'
      },
      responseType: 'blob'
    });

    const contentDisposition = response.headers['content-disposition'];
    let fileName = '';
    if (contentDisposition) {
      // 优先尝试匹配 RFC 5987 标准的 UTF-8 文件名 (filename*=utf-8''...)
      const filenameStarMatch = contentDisposition.match(/filename\*=utf-8''(.+?)(;|$)/);

      if (filenameStarMatch && filenameStarMatch[1]) {
        fileName = decodeURIComponent(filenameStarMatch[1]);
      } else {
        // 如果没有，再尝试匹配普通文件名 (filename="...")
        const filenameMatch = contentDisposition.match(/filename="?(.+?)"?(;|$)/);
        if (filenameMatch && filenameMatch[1]) {
          fileName = decodeURIComponent(filenameMatch[1]);
        }
      }
    }

    if (!fileName) {
      const type = selectedFileType.value;
      fileName = `task_${currentVisTaskId.value}_${type}_${Date.now()}`;
      const extensions: Record<string, string> = {
        txt: '.txt',
        pdf: '.pdf',
        vcf: '.vcf',
        csv: '.csv',
        image: '.zip',
        graph: '.json'
      };
      fileName += extensions[type] || '';
    }

    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    ElMessage.success('文件下载成功');
  } catch (error) {
    console.error('文件下载失败:', error);
    ElMessage.error('文件下载失败');
  }
};

// 工具：获取类型标签
const getFileTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    txt: '文本日志',
    pdf: '分析报告',
    vcf: '变异数据',
    csv: '数据表格',
    image: '结果图表',
    graph: '关系图谱'
  };
  return map[type] || type.toUpperCase();
};

// CSV 选项
const csvTableOptions = [
  { label: 'Count CSV', value: 'count_csv' },
  { label: 'FPK CSV', value: 'fpk_csv' },
  { label: 'TPM CSV', value: 'tpm_csv' }
];

// Computed
const currentCsvData = computed(() => {
  if (visualizationResult.value?.type === 'csv') {
    return visualizationResult.value.data[selectedCsvTable.value] || [];
  }
  return [];
});

const imageList = computed(() => {
  if (visualizationResult.value?.type === 'image') {
    return visualizationResult.value.data.filter((img: any) => Boolean(img.url));
  }
  return [];
});
const imagePreviewUrls = computed(() => imageList.value.map((img: any) => img.url));

const getTableColumns = (data: any[]) => {
  if (!data || !data.length) return [];
  const allKeys = new Set<string>();
  data.forEach(row => Object.keys(row).forEach(key => allKeys.add(key)));
  return Array.from(allKeys);
};

const openPdfInNewWindow = (url: string) => {
  window.open(url, '_blank');
};

// ==========================================
// Part 2.1: Graph 图谱逻辑
// ==========================================

const transformGraphDataToECharts = (graphData: any[]) => {
  const nodeMap = new Map<string, any>();
  const links: any[] = [];

  graphData.forEach(item => {
    if (!nodeMap.has(item.from)) nodeMap.set(item.from, { id: item.from, name: item.from, symbolSize: 30 });
    if (!nodeMap.has(item.to)) nodeMap.set(item.to, { id: item.to, name: item.to, symbolSize: 30 });
    links.push({ source: item.from, target: item.to });
  });

  return { nodes: Array.from(nodeMap.values()), links };
};

const graphChartOption = computed<any>(() => {
  if (!visualizationResult.value || visualizationResult.value.type !== 'graph') return null;
  const { nodes, links } = transformGraphDataToECharts(visualizationResult.value.data);
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (params.dataType === 'node') return `节点: ${params.data.name}`;
        if (params.dataType === 'edge') return `${params.data.source} → ${params.data.target}`;
        return '';
      }
    },
    animationDuration: 1500,
    animationEasingUpdate: 'quinticInOut',
    series: [
      {
        type: 'graph',
        layout: 'force',
        data: nodes,
        links,
        roam: true,
        label: { show: true, position: 'bottom', fontSize: 12, color: '#333' },
        emphasis: {
          focus: 'adjacency',
          label: { show: true, fontSize: 14, fontWeight: 'bold' }
        },
        force: { repulsion: 1000, edgeLength: 150 },
        lineStyle: { color: 'source', width: 2, curveness: 0.1, opacity: 0.7 },
        itemStyle: { borderColor: '#2c5aa0', borderWidth: 2, shadowBlur: 10 },
        symbol: 'circle',
        symbolSize: (value: any, params: any) => {
          const nodeId = params?.data?.id || value?.id || '';
          const relatedLinks = links.filter((link: any) => link.source === nodeId || link.target === nodeId);
          return Math.max(30, Math.min(60, 30 + relatedLinks.length * 5));
        }
      }
    ]
  };
});

// ==========================================
// Part 3: 清理文件逻辑
// ==========================================

const isDeleteDialogVisible = ref(false);
const deleteLoading = ref(false);
const currentDeleteTaskId = ref<number | null>(null);
const deleteLevel = ref<number>(3);
const deletePreviewSizes = ref<Record<string, number>>({});

const deleteOptions = [
  { value: 2, label: '保留最终文件+可视化' },
  { value: 3, label: '清理中间文件（保留init、final、visual三个文件夹的文件）' },
  { value: 1, label: '仅保留可视化文件' },
  { value: 0, label: '彻底清理 (全部删除)' }
];

function openDeleteDialog(row: Api.Task.TaskListItem) {
  currentDeleteTaskId.value = row.id;
  deleteLevel.value = 2;
  isDeleteDialogVisible.value = true;
  deletePreviewSizes.value = {};
  fetchTaskFileSize(row.id)
    .then(res => {
      if (res.data) deletePreviewSizes.value = res.data;
    })
    .catch(() => {});
}

async function handleDeleteSubmit() {
  if (!currentDeleteTaskId.value) return;
  deleteLoading.value = true;
  try {
    const res = await cleanTaskFiles(currentDeleteTaskId.value, deleteLevel.value);
    if (res) {
      const freedSpace =
        res.data && res.data.free_size_size !== undefined ? formatBytes(res.data.free_size_size) : '0 B';
      ElMessage.success(`清理成功！已释放空间：${freedSpace}`);
      isDeleteDialogVisible.value = false;
      getTaskSize();
    }
  } catch (e: any) {
    ElMessage.error(e.message || '清理失败');
  } finally {
    deleteLoading.value = false;
  }
}
const getPreviewSizeText = (level: number) => {
  const s = deletePreviewSizes.value[`size_${level}`];
  return s !== undefined ? `(预计释放 ${formatBytes(s)})` : '';
};

// 页面初始化
onMounted(async () => {
  const { checkPermissionAndNotify } = usePermissionGuard();
  const hasPermission = await checkPermissionAndNotify('scene'); // 或 'task'
  if (!hasPermission) return;

  if (route.query.task_id) {
    filterParams.id = Number(route.query.task_id);
    ElMessage.info(`已为您定位到任务 ${route.query.task_id}`);
  }
  getTasks();
  getTaskSize();
});
</script>

<template>
  <div class="page-container">
    <ElCard shadow="never" class="main-card list-card">
      <template #header>
        <div class="card-header">
          <div class="header-title-area">
            <span>任务列表</span>
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
            placeholder="ID"
            clearable
            @clear="handleSearch"
          />
        </ElFormItem>
        <ElFormItem label="流程名称">
          <ElInput
            v-model="filterParams.name"
            class="filter-input"
            placeholder="名称"
            clearable
            @clear="handleSearch"
          />
        </ElFormItem>
        <ElFormItem label="状态">
          <ElSelect
            v-model="filterParams.status"
            class="filter-input filter-select"
            placeholder="状态"
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
            <ElTag :type="statusTagType(row.status)" effect="plain" round size="small">{{ row.status }}</ElTag>
          </template>
        </ElTableColumn>

        <ElTableColumn label="操作" width="240" fixed="right" align="center">
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
                @click="handleVisualize(row)"
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
              <span class="vis-title">任务 #{{ currentVisTaskId }} 可视化结果</span>
              <ElTag size="small" effect="dark" type="primary" class="ml-2">{{ currentVisProcessName }}</ElTag>
            </div>
            <ElButton circle size="small" :icon="Close" title="关闭面板" @click="closeVisPanel" />
          </div>
        </template>

        <div v-loading="visualizationLoading" class="vis-body">
          <div v-if="availableFileTypes.length > 0" class="vis-tabs">
            <div class="vis-tabs-left">
              <div class="vis-tabs-label">选择查看内容：</div>
              <div class="vis-tabs-group">
                <div
                  v-for="type in availableFileTypes"
                  :key="type"
                  class="vis-tab-item"
                  :class="{ active: selectedFileType === type }"
                  @click="loadVisData(type)"
                >
                  {{ getFileTypeLabel(type) }}
                </div>
              </div>
            </div>

            <div class="vis-actions">
              <ElButton type="primary" :icon="Download" @click="handleDownload">下载文件</ElButton>
            </div>
          </div>

          <div v-if="selectedFileType === 'csv' && visualizationResult?.type === 'csv'" class="vis-sub-filter">
            <span class="sub-label">数据视图：</span>
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
                  />
                  <div class="image-name">{{ img.name }}</div>
                </div>
              </div>
              <ElEmpty v-else description="暂无图片数据" />
            </div>

            <div v-else-if="visualizationResult?.type === 'graph'" class="graph-viewer">
              <VChart
                v-if="graphChartOption"
                :option="graphChartOption"
                autoresize
                class="w-full border border-gray-200 rounded bg-white"
                style="height: 600px; width: 100%"
              />
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
            <div class="radio-indicator"><div class="radio-inner"></div></div>
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
/* 基础布局 */
.page-container {
  padding: 24px;
  background: #f5f7fa;
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

/* 空间统计 */
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

/* 筛选栏 */
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
  border-radius: 999px;
  margin-left: 10px;
}

/* 表格样式 */
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
.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

/* === 可视化面板样式 === */
.vis-section-wrapper {
  animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
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
  font-weight: 600;
}
.vis-body {
  padding: 8px 0;
}

/* Tab 切换布局 */
.vis-tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  border-bottom: 1px solid #f0f2f5;
  padding-bottom: 12px;
}

.vis-tabs-left {
  display: flex;
  align-items: center;
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
  flex-wrap: wrap;
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

/* 内容展示区 */
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
  margin: 0;
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
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
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
  height: 200px;
  background: #f9f9f9;
  border-radius: 4px;
  margin-bottom: 8px;
  display: block;
}
.image-name {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Graph 样式 */
.graph-viewer {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  padding: 10px;
}

/* 清理弹窗 */
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

/* 工具类 */
.text-muted {
  color: #c0c4cc;
}
.mr-1 {
  margin-right: 4px;
}
.ml-2 {
  margin-left: 8px;
}
.csv-select-width {
  width: 160px;
}
.full-width-table {
  width: 100%;
}
</style>
