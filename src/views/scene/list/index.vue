<script setup lang="ts">
/**
 * 场景任务运行记录页
 *
 * - 上半部分：任务列表 + 筛选、分页、清理空间
 * - 下半部分：选中任务的可视化结果（文本 / PDF / CSV / 图像 / 图谱）
 */
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
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
// === API 接口 ===
import { cleanTaskFiles, fetchTaskFileSize, fetchTaskList, fetchTotalFileSize } from '@/service/api/task';
import { fetchTaskInfo, fetchTaskResult } from '@/service/api/visulizaiton';
import { usePermissionGuard } from '@/hooks/business/permission-guard';
import { getServiceBaseURL } from '@/utils/service';
import { localStg } from '@/utils/storage';
import TaskDetailDialog from './components/TaskDetailDialog.vue';

/**
 * # ==========================================
 *
 * ECharts 初始化
 */
use([CanvasRenderer, GraphChart, TooltipComponent]);

/**
 * # ==========================================
 *
 * Part 1: 任务列表逻辑 负责：任务表格数据、筛选、分页以及详情弹窗
 */
// 任务表格是否处于加载中
const loading = ref(false);
// 当前页的任务列表数据
const tasks = ref<Api.Task.TaskListItem[]>([]);
// 所有任务文件占用空间统计（单位：字节）
const totalSize = ref(0);
// 当前路由对象，用于读取 URL 查询参数（如 task_id）
const route = useRoute();
// 筛选状态，对应页面顶部的查询表单
const filterParams = reactive({
  id: undefined as number | undefined, // 任务 ID
  name: '', // 流程名称
  status: '' as Api.Task.TaskStatus | '' // 任务状态
});

// 对话框控制 (详情)
// 是否显示任务详情弹窗
const isDetailDialogVisible = ref(false);
// 当前正在查看详情的任务 ID
const selectedDetailTaskId = ref<number | null>(null);

/**
 * # ==========================================
 *
 * Part 1.5: 清理文件逻辑
 */
// 是否显示清理弹窗
const isDeleteDialogVisible = ref(false);
// 清理确认按钮的 loading 状态
const deleteLoading = ref(false);
// 当前正在执行清理操作的任务 ID
const currentDeleteTaskId = ref<number | null>(null);
// 清理级别（0~3，不同级别保留的文件不同）
const deleteLevel = ref<number>(3);

// 存储当前选中任务在各个清理级别下预计释放的空间大小
const deletePreviewSizes = ref<Record<string, number>>({});

// 清理选项配置
const deleteOptions = [
  { value: 2, label: '保留最终文件+可视化' },
  { value: 3, label: '清理中间文件（保留init、final、visual三个文件夹的文件）' },
  { value: 1, label: '仅保留可视化文件' },
  { value: 0, label: '彻底清理 (全部删除)' }
];

/**
 * 格式化字节大小
 *
 * @param bytes 原始字节数
 * @param decimals 保留的小数位数
 * @returns 带单位的可读字符串，如 "1.23 GB"
 */
function formatBytes(bytes: number, decimals = 2) {
  if (Number(bytes) === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

/**
 * 根据清理级别获取「预计释放空间」文案
 *
 * @param level 清理级别（0~3）
 */
const getPreviewSizeText = (level: number) => {
  const key = `size_${level}`;
  const size = deletePreviewSizes.value[key];
  if (size === undefined || size === null) return '';
  return `(预计释放 ${formatBytes(size)})`;
};

/**
 * 打开任务文件清理弹窗
 *
 * - 记录当前要清理的任务 ID
 * - 默认选中推荐清理级别（2）
 * - 请求后端接口，预估不同清理级别释放的空间大小
 */
function openDeleteDialog(row: Api.Task.TaskListItem) {
  currentDeleteTaskId.value = row.id;
  deleteLevel.value = 2; // 重置为默认推荐值
  isDeleteDialogVisible.value = true;
  deletePreviewSizes.value = {};
  fetchTaskFileSize(row.id)
    .then(res => {
      if (res.data) deletePreviewSizes.value = res.data;
    })
    .catch(() => {});
}

/** 获取所有任务文件占用空间总和 用于页面头部的「总占用空间」展示 */
async function getTaskSize() {
  try {
    const res = await fetchTotalFileSize();
    if (res) totalSize.value = res.data?.total_size ?? 0;
  } catch {
    ElMessage.error('获取空间统计失败');
  }
}

/**
 * 提交任务文件清理
 *
 * - 调用后端清理接口
 * - 成功后刷新空间统计并关闭弹窗
 */
async function handleDeleteSubmit() {
  if (!currentDeleteTaskId.value) return;
  deleteLoading.value = true;
  try {
    const res = await cleanTaskFiles(currentDeleteTaskId.value, deleteLevel.value);
    if (res) {
      const freedSpace = res.data?.free_size_size !== undefined ? formatBytes(res.data.free_size_size) : '0 B';
      ElMessage.success(`清理成功！已释放空间：${freedSpace}`);
      isDeleteDialogVisible.value = false;
      getTaskSize();
    }
  } catch (error: any) {
    ElMessage.error(error.message || '清理失败');
  } finally {
    deleteLoading.value = false;
  }
}

// 筛选选项：任务状态下拉框的数据源
const statusOptions = [
  { label: '运行中', value: 'RUNNING' },
  { label: '成功', value: 'SUCCESS' },
  { label: '失败', value: 'FAILED' },
  { label: '已取消', value: 'CANCELLED' },
  { label: '等待中', value: 'PENDING' }
];

/**
 * 将 ISO 时间字符串格式化为「YYYY-MM-DD HH:mm:ss」
 *
 * @param isoString 后端返回的时间字符串
 */
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

/**
 * 将任务状态映射为 Element Plus Tag 组件的类型
 *
 * @param status 任务状态
 */
const statusTagType = (status: string | Api.Task.TaskStatus | undefined | null) => {
  if (!status) return 'info';
  const s = status.toString().toUpperCase();
  if (s === 'SUCCESS') return 'success';
  if (s === 'RUNNING') return 'primary';
  if (s === 'FAILED') return 'danger';
  if (s === 'PENDING') return 'warning';
  return 'info';
};

// 分页状态，和分页组件双向绑定
const pagination = reactive({ page: 1, pageSize: 10, itemCount: 0 });

/**
 * 获取任务列表数据
 *
 * - 根据筛选条件和分页参数调用后端接口
 * - 更新表格数据与总条数
 */
async function getTasks() {
  loading.value = true;
  try {
    const params: Api.Task.TaskListParams = {
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
    ElMessage.error('获取任务列表失败');
  } finally {
    loading.value = false;
  }
}

/** 分页：切换当前页 */
function handlePageChange(currentPage: number) {
  pagination.page = currentPage;
  getTasks();
}
/** 分页：切换每页条数时重置到第一页 */
function handleSizeChange(pageSize: number) {
  pagination.pageSize = pageSize;
  pagination.page = 1;
  getTasks();
}
/** 点击查询按钮时，从第一页开始重新拉取数据 */
function handleSearch() {
  pagination.page = 1;
  getTasks();
}
/** 重置筛选条件并重新查询 */
function handleReset() {
  filterParams.id = undefined;
  filterParams.name = '';
  filterParams.status = '';
  handleSearch();
}

/** 打开任务详情弹窗 */
function showDetailsDialog(taskId: number) {
  selectedDetailTaskId.value = taskId;
  isDetailDialogVisible.value = true;
}
/**
 * 子组件中任务被重新发起运行时的回调
 *
 * - 关闭详情弹窗
 * - 刷新任务列表
 */
function handleTaskRestarted() {
  isDetailDialogVisible.value = false;
  getTasks();
}

/**
 * # ==========================================
 *
 * Part 2: 可视化逻辑 负责：根据任务和文件类型，请求可视化数据并在下方卡片中展示
 */
// 可视化结果区域 DOM 引用，用于滚动定位
const visSectionRef = ref<HTMLElement | null>(null);
// 可视化内容是否处于加载中
const visualizationLoading = ref(false);
// 当前正在查看可视化结果的任务 ID
const currentVisTaskId = ref<number | null>(null);
// 当前任务可查看的文件类型列表（txt / pdf / csv / image / graph / vcf）
const availableFileTypes = ref<Api.Visualization.FileType[]>([]);
// 当前选中的文件类型
const selectedFileType = ref<Api.Visualization.FileType | ''>('');
// 当前选中文件类型对应的可视化结果数据
const visualizationResult = ref<Api.Visualization.Result | null>(null);

// CSV 视图下：当前选中的子表（count / fpk / tpm）
const selectedCsvTable = ref<'count_csv' | 'fpk_csv' | 'tpm_csv'>('count_csv');
// CSV 子表选项
const csvTableOptions = [
  { label: 'Count CSV', value: 'count_csv' },
  { label: 'FPK CSV', value: 'fpk_csv' },
  { label: 'TPM CSV', value: 'tpm_csv' }
];

// 当前 CSV 表格展示的数据
const currentCsvData = computed(() => {
  if (visualizationResult.value?.type === 'csv') {
    return visualizationResult.value.data[selectedCsvTable.value] || [];
  }
  return [];
});

// 图片类型结果：过滤掉没有 url 的项
const imageList = computed(() => {
  if (visualizationResult.value?.type === 'image') {
    return visualizationResult.value.data.filter((img: any) => Boolean(img.url));
  }
  return [];
});
// 图片预览组件所需的图片地址数组
const imagePreviewUrls = computed(() => imageList.value.map((img: any) => img.url));

/**
 * 根据当前环境配置，对后端返回的 PDF URL 做统一适配
 *
 * - 开发/代理场景下，将同源的 URL 走统一代理前缀
 */
const normalizePdfUrl = (url: string) => {
  if (!url) return '';
  const isHttpUrl = /^https?:\/\//i.test(url);
  if (!isHttpUrl) return url;
  try {
    const pdfUrl = new URL(url);
    const serviceBase = import.meta.env.VITE_SERVICE_BASE_URL;
    if (!serviceBase) return url;
    const serviceUrl = new URL(serviceBase);
    // 场景任务通常走默认代理
    if (pdfUrl.origin === serviceUrl.origin) {
      const proxyPrefix = '/proxy-default';
      return `${proxyPrefix}${pdfUrl.pathname}${pdfUrl.search}`;
    }
    return url;
  } catch {
    return url;
  }
};

/**
 * 根据任务 ID 和文件类型获取可视化数据
 *
 * - 统一处理 PDF Blob URL，防止内存泄漏
 * - 其它类型（txt/csv/image/graph/vcf）直接透传后端结果
 */
const fetchVisualizationData = async (taskId: number, fileType: Api.Visualization.FileType) => {
  // [关键] 清理旧的 PDF Blob URL 防止内存泄漏
  if (visualizationResult.value?.type === 'pdf' && visualizationResult.value.data.startsWith('blob:')) {
    window.URL.revokeObjectURL(visualizationResult.value.data);
  }

  try {
    visualizationLoading.value = true;
    selectedFileType.value = fileType;
    // 先置空，给用户反馈
    visualizationResult.value = null;

    const { data: resultData } = await fetchTaskResult(taskId.toString(), fileType);

    if (resultData && resultData.type === 'pdf') {
      const pdfUrl = normalizePdfUrl(resultData.data);
      const token = localStg.get('token');

      const response = await axios.get(pdfUrl, {
        responseType: 'blob',
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const localPdfUrl = window.URL.createObjectURL(blob);

      visualizationResult.value = {
        type: 'pdf',
        data: localPdfUrl
      };
    } else {
      visualizationResult.value = resultData ?? null;
    }
  } catch (error) {
    console.error('获取数据失败:', error);
    visualizationResult.value = null;
    ElMessage.error('数据加载失败');
  } finally {
    visualizationLoading.value = false;
  }
};

/** 顶部类型 Tab 点击事件 切换不同文件类型时重新请求可视化数据 */
function handleFileTypeClick(fileType: Api.Visualization.FileType) {
  if (currentVisTaskId.value) {
    fetchVisualizationData(currentVisTaskId.value, fileType);
  }
}

// 组件卸载时清理 PDF 资源，防止 Blob URL 占用内存
onUnmounted(() => {
  if (visualizationResult.value?.type === 'pdf' && visualizationResult.value.data.startsWith('blob:')) {
    window.URL.revokeObjectURL(visualizationResult.value.data);
  }
});

/**
 * 下载当前任务的原始结果文件
 *
 * - 调用后端下载接口
 * - 从响应头中解析文件名
 * - 通过动态创建 a 标签触发浏览器下载
 */
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
      headers: { Authorization: token ? `Bearer ${token}` : '', Accept: '*/*' },
      responseType: 'blob'
    });

    const contentDisposition = response.headers['content-disposition'];
    let fileName = '';
    if (contentDisposition) {
      const filenameStarMatch = contentDisposition.match(/filename\*=utf-8''(.+?)(;|$)/);
      if (filenameStarMatch && filenameStarMatch[1]) {
        fileName = decodeURIComponent(filenameStarMatch[1]);
      } else {
        const filenameMatch = contentDisposition.match(/filename="?(.+?)"?(;|$)/);
        if (filenameMatch && filenameMatch[1]) fileName = decodeURIComponent(filenameMatch[1]);
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

/**
 * 点击「可视化」按钮
 *
 * - 如果重复点击同一个任务：只做滚动定位
 * - 如果切换任务：清理旧资源，重新拉取可视化元数据
 */
async function handleVisualize(taskId: number) {
  if (currentVisTaskId.value === taskId) {
    scrollToVis();
    return;
  }
  // 切换任务时清理旧资源
  if (visualizationResult.value?.type === 'pdf' && visualizationResult.value.data.startsWith('blob:')) {
    window.URL.revokeObjectURL(visualizationResult.value.data);
  }

  currentVisTaskId.value = taskId;
  selectedFileType.value = '';
  visualizationResult.value = null;
  availableFileTypes.value = [];
  selectedCsvTable.value = 'count_csv'; // 重置表格选择

  nextTick(() => scrollToVis());

  visualizationLoading.value = true;
  try {
    const { data } = await fetchTaskInfo();
    const targetTask = data?.find((t: any) => t.task_id === taskId);

    if (targetTask && targetTask.file_type && targetTask.file_type.length > 0) {
      availableFileTypes.value = targetTask.file_type;
      // 默认选中第一个
      handleFileTypeClick(targetTask.file_type[0]);
    } else {
      ElMessage.warning(`任务 #${taskId} 暂无可视化数据`);
      currentVisTaskId.value = null;
    }
  } catch (error) {
    console.error('获取可视化元数据失败:', error);
    ElMessage.error('无法加载该任务的可视化配置');
  } finally {
    visualizationLoading.value = false;
  }
}

/** 将页面滚动到可视化区域 */
function scrollToVis() {
  visSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** 文件类型枚举转为中文展示文案 */
const getFileTypeLabel = (fileType: Api.Visualization.FileType) => {
  const labels: Record<string, string> = {
    txt: '文本日志',
    pdf: '分析报告 (PDF)',
    vcf: '变异数据 (VCF)',
    csv: '数据表格',
    image: '结果图表',
    graph: '关系图谱'
  };
  return labels[fileType] || fileType.toUpperCase();
};

/**
 * # ==========================================
 *
 * Part 2.1: Graph 图谱逻辑 (增强版) 将后端返回的节点关系数据转换为 ECharts 所需的数据结构
 */

/**
 * 将后端返回的 from/to 关系数组转换为 ECharts graph 所需的节点和边
 *
 * @param graphData 后端返回的图谱数据
 */
const transformGraphDataToECharts = (graphData: any[]) => {
  const nodeMap = new Map<string, any>();
  const links: any[] = [];
  graphData.forEach(item => {
    if (!nodeMap.has(item.from)) nodeMap.set(item.from, { id: item.from, name: item.from });
    if (!nodeMap.has(item.to)) nodeMap.set(item.to, { id: item.to, name: item.to });
    links.push({ source: item.from, target: item.to });
  });
  return { nodes: Array.from(nodeMap.values()), links };
};

/** 计算属性：根据可视化结果生成 ECharts 图谱配置项 */
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
        // [新增] 箭头配置，使流程图更有方向感
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: [0, 10],
        label: { show: true, position: 'bottom', fontSize: 12, color: '#333' },
        emphasis: {
          focus: 'adjacency',
          label: { show: true, fontSize: 14, fontWeight: 'bold' },
          lineStyle: { width: 3, color: '#4a90e2' }
        },
        force: {
          repulsion: 800,
          edgeLength: 180,
          gravity: 0.1,
          layoutAnimation: true
        },
        lineStyle: { color: 'source', width: 2, curveness: 0.1, opacity: 0.8 },
        itemStyle: { borderColor: '#fff', borderWidth: 2, shadowBlur: 5, shadowColor: 'rgba(0, 0, 0, 0.1)' },
        symbol: 'circle',
        // [新增] 动态计算节点大小：连接线越多，节点越大
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

/**
 * 根据数据自动推断表格列
 *
 * - 遍历所有行，收集所有 key 作为表头
 */
const getTableColumns = (data: any[]) => {
  if (!data || data.length === 0) return [];
  const allKeys = new Set<string>();
  data.forEach(row => Object.keys(row).forEach(key => allKeys.add(key)));
  return Array.from(allKeys);
};

/** 在新窗口中打开 PDF，便于全屏查看 */
const openPdfInNewWindow = (url: string) => {
  window.open(url, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
};

// 监听 CSV 子表选择变化，给出轻提示
watch(selectedCsvTable, newVal => {
  if (visualizationResult.value?.type === 'csv') {
    const label = csvTableOptions.find(opt => opt.value === newVal)?.label;
    ElMessage.success(`已切换数据视图：${label}`);
  }
});
// 当可视化结果切换为 CSV 类型时，默认展示 count 表
watch(visualizationResult, () => {
  if (visualizationResult.value?.type === 'csv') {
    selectedCsvTable.value = 'count_csv';
  }
});

/**
 * 页面挂载时：
 *
 * 1. 先做权限校验（无权限则直接返回）
 * 2. 如果 URL 中带有 task_id，则自动帮用户定位到对应任务
 * 3. 拉取任务列表和空间统计
 */
onMounted(async () => {
  const { checkPermissionAndNotify } = usePermissionGuard();
  const hasPermission = await checkPermissionAndNotify('scene');
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
    <!-- 上半部分：任务运行记录列表卡片 -->
    <ElCard shadow="never" class="main-card list-card">
      <template #header>
        <!-- 卡片头部：标题 + 总占用空间统计 + 刷新按钮 -->
        <div class="card-header">
          <div class="header-title-area">
            <span>运行记录</span>
            <div class="size-stat-badge">
              <ElIcon class="mr-1"><Odometer /></ElIcon>
              <span class="stat-label">总占用空间:</span>
              <span class="stat-value">{{ formatBytes(totalSize) }}</span>
            </div>
          </div>
          <ElButton :icon="Refresh" circle size="small" title="刷新列表" @click="getTasks" />
        </div>
      </template>

      <!-- 筛选条件表单 -->
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

      <!-- 任务列表表格 -->
      <ElTable v-loading="loading" :data="tasks" empty-text="暂无任务数据" style="flex: 1; height: 0">
        <ElTableColumn prop="id" label="ID" width="80" align="center">
          <template #default="{ row }">
            <span class="text-mono">#{{ row.id }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="name" label="流程名称" min-width="150">
          <template #default="{ row }">
            <span class="text-gray-700 font-medium">{{ row.name }}</span>
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

      <!-- 分页条：控制当前页与每页条数 -->
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

    <!-- 下半部分：选中任务的可视化结果区域 -->
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
            <div class="vis-tabs-left">
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

              <div
                v-if="selectedFileType === 'csv' && visualizationResult?.type === 'csv'"
                class="ml-4 flex items-center"
              >
                <span class="mr-2 text-sm text-gray-500">表类型:</span>
                <ElSelect v-model="selectedCsvTable" size="small" class="csv-select-width">
                  <ElOption v-for="opt in csvTableOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </ElSelect>
              </div>
            </div>

            <div class="vis-actions">
              <ElButton type="primary" :icon="Download" @click="handleDownload">下载文件</ElButton>
            </div>
          </div>

          <!-- 根据不同 type 渲染不同的可视化视图 -->
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

    <!-- 任务详情弹窗（子组件） -->
    <TaskDetailDialog
      v-model="isDetailDialogVisible"
      :task-id="selectedDetailTaskId"
      @task-restarted="handleTaskRestarted"
    />

    <!-- 任务文件清理确认弹窗 -->
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
/* [修改点]
  页面容器样式重构：
  1. 使用 height: 100% 替代 min-height: 100vh，防止超出屏幕导致父级裁切。
  2. 使用 Flex 布局。
  3. overflow-y: auto 允许在可视化面板出现时，页面可以滚动查看。
*/
.page-container {
  padding: 24px;
  background: #f5f7fb;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
}

/* [修改点]
  列表卡片样式：
  1. height: calc(100vh - 48px);
     强制限制卡片高度（视口高度减去上下padding），这会迫使表格在卡片内部滚动。
     这是解决“分页栏看不到”最核心的修改。
  2. flex-shrink: 0; 防止在 Flex 布局中被压缩变形。
  3. overflow: hidden; 确保圆角和内部内容不溢出。
*/
.main-card.list-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
  transition: all 0.3s;
  height: calc(100vh - 48px);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* [修改点]
  深度选择器控制 ElCard 内部：
  让 el-card__body 变成 Flex 列布局，并占据所有空间。
  这样 ElTable 就可以通过 flex: 1 自动计算高度了。
*/
.main-card.list-card :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding-bottom: 12px;
}

/* 其他样式保持不变 */
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

.pagination-container {
  margin-top: auto;
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}

/* Visualization Styles */
.vis-section-wrapper {
  animation: slideIn 0.4s ease-out;
  margin-top: 24px;
  flex-shrink: 0;
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

/* Graph 样式 */
.graph-viewer {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  padding: 10px;
}

/* 清理弹窗样式 */
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
.csv-select-width {
  width: 140px;
}
.full-width-table {
  width: 100%;
}
.ml-4 {
  margin-left: 16px;
}
</style>
