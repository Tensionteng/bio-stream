<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  ElAlert,
  ElButton,
  ElButtonGroup,
  ElCard,
  ElImage,
  ElMessage,
  ElOption,
  ElSelect,
  ElTable,
  ElTableColumn
} from 'element-plus';
import axios from 'axios';
import { Download } from '@element-plus/icons-vue';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { GraphChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import VChart from 'vue-echarts';
import { fetchTaskInfo, fetchTaskResult } from '@/service/api/visulizaiton';
import { usePermissionGuard } from '@/hooks/business/permission-guard';
import { getServiceBaseURL } from '@/utils/service';
import { localStg } from '@/utils/storage';

// 注册 ECharts 组件
use([CanvasRenderer, GraphChart, TooltipComponent]);

// 响应式数据
const loading = ref(false);
const visualizationLoading = ref(false);
const tasks = ref<Api.Visualization.TaskInfo[]>([]);
const selectedTaskId = ref<number | ''>('');
const selectedFileType = ref<Api.Visualization.FileType | ''>('');
const visualizationResult = ref<Api.Visualization.Result | null>(null);

// 新增CSV表格选择相关状态
const selectedCsvTable = ref<'count_csv' | 'fpk_csv' | 'tpm_csv'>('count_csv');

// 计算属性
const taskOptions = computed(() =>
  tasks.value.map(task => ({
    label: `任务 ${task.task_id}`,
    value: task.task_id
  }))
);

const currentTask = computed(() => tasks.value.find(task => task.task_id === selectedTaskId.value));

const availableFileTypes = computed(() => currentTask.value?.file_type || []);

const hasData = computed(() => tasks.value && tasks.value.length > 0);

// CSV表格选项
const csvTableOptions = [
  { label: 'Count CSV', value: 'count_csv' },
  { label: 'FPK CSV', value: 'fpk_csv' },
  { label: 'TPM CSV', value: 'tpm_csv' }
];

// 获取当前选中的CSV数据
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

// 获取任务列表
const fetchTasks = async () => {
  try {
    loading.value = true;
    const { data } = await fetchTaskInfo();

    if (data && data.length > 0) {
      tasks.value = data;
      selectedTaskId.value = data[0].task_id;
      // 清空文件类型选择和可视化结果
      selectedFileType.value = '';
      visualizationResult.value = null;
    } else {
      tasks.value = [];
    }
  } catch (error) {
    console.error('获取任务列表失败:', error);
    tasks.value = [];
  } finally {
    loading.value = false;
  }
};

// 获取可视化结果 - URL 规范化工具
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

    const proxyPrefix = '/proxy-media';
    const pdfPathWithQuery = `${pdfUrl.pathname}${pdfUrl.search}`;
    return `${proxyPrefix}${pdfPathWithQuery}`;
  } catch (error) {
    console.warn('normalizePdfUrl error => ', error);
    return url;
  }
};

// [核心修改] 获取可视化数据
const fetchVisualizationData = async (fileType: Api.Visualization.FileType) => {
  if (!selectedTaskId.value || !fileType) return;

  // 1. 清理之前的 Blob 资源，防止内存泄漏
  if (visualizationResult.value?.type === 'pdf' && visualizationResult.value.data.startsWith('blob:')) {
    window.URL.revokeObjectURL(visualizationResult.value.data);
  }

  try {
    visualizationLoading.value = true;
    selectedFileType.value = fileType;
    // 先置空，给用户加载中的反馈
    visualizationResult.value = null;

    const { data: resultData } = await fetchTaskResult(selectedTaskId.value.toString(), fileType);

    if (resultData && resultData.type === 'pdf') {
      // 2. [修改点] PDF 使用 Axios 下载 Blob 并创建本地 URL
      const pdfUrl = normalizePdfUrl(resultData.data);
      const token = localStg.get('token');

      const response = await axios.get(pdfUrl, {
        responseType: 'blob', // 关键
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);

      visualizationResult.value = {
        type: 'pdf',
        data: blobUrl
      };
    } else {
      visualizationResult.value = resultData ?? null;
    }

    // 根据文件类型显示不同的消息通知
    const messages: Record<Api.Visualization.FileType, string> = {
      txt: 'TXT文本数据加载成功',
      pdf: 'PDF文档加载成功',
      vcf: 'VCF变异数据加载成功',
      csv: 'CSV表格数据加载成功',
      image: '图片数据加载成功',
      graph: '图谱可视化加载成功'
    };
    ElMessage.success(messages[fileType]);
  } catch (error) {
    console.error('获取可视化数据失败:', error);
    visualizationResult.value = null;
    ElMessage.error('获取可视化数据失败');
  } finally {
    visualizationLoading.value = false;
  }
};

// 当任务ID变化时，清空选择的文件类型和可视化结果
watch(selectedTaskId, () => {
  // 切换任务时也要清理旧的 Blob
  if (visualizationResult.value?.type === 'pdf' && visualizationResult.value.data.startsWith('blob:')) {
    window.URL.revokeObjectURL(visualizationResult.value.data);
  }
  selectedFileType.value = '';
  visualizationResult.value = null;
  selectedCsvTable.value = 'count_csv'; // 重置CSV表格选择
});

// 组件销毁时清理
onUnmounted(() => {
  if (visualizationResult.value?.type === 'pdf' && visualizationResult.value.data.startsWith('blob:')) {
    window.URL.revokeObjectURL(visualizationResult.value.data);
  }
});

// 当可视化结果变化时，重置CSV表格选择
watch(visualizationResult, () => {
  if (visualizationResult.value?.type === 'csv') {
    selectedCsvTable.value = 'count_csv';
  }
});

// 处理CSV表格类型变化
watch(selectedCsvTable, newValue => {
  if (visualizationResult.value?.type === 'csv') {
    const label = csvTableOptions.find(opt => opt.value === newValue)?.label;
    ElMessage.success(`已切换到: ${label}`);
  }
});

// 处理文件类型按钮点击
const handleFileTypeClick = (fileType: Api.Visualization.FileType) => {
  fetchVisualizationData(fileType);
};

// 处理下载
const handleDownload = async () => {
  if (!selectedTaskId.value || !selectedFileType.value) {
    ElMessage.warning('请先选择任务和文件类型');
    return;
  }

  try {
    const token = localStg.get('token');
    const isHttpProxy = import.meta.env.DEV && import.meta.env.VITE_HTTP_PROXY === 'Y';
    const { baseURL } = getServiceBaseURL(import.meta.env, isHttpProxy);

    const response = await axios({
      url: `${baseURL}/visualization/tasks/download/${selectedTaskId.value}`,
      method: 'GET',
      params: { type: selectedFileType.value },
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        Accept: '*/*'
      },
      responseType: 'blob'
    });

    // 从响应头获取文件名
    const contentDisposition = response.headers['content-disposition'];
    let fileName = '';

    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
      if (fileNameMatch && fileNameMatch.length === 2) {
        fileName = decodeURIComponent(fileNameMatch[1]);
      }
    }

    // 如果没有在header中找到文件名，则使用默认名称
    if (!fileName) {
      const type = selectedFileType.value;
      fileName = `task_${selectedTaskId.value}_${type}_${Date.now()}`;
      // 根据类型添加扩展名
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

    // 创建下载链接
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();

    // 清理
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    ElMessage.success('文件下载成功');
  } catch (error) {
    console.error('文件下载失败:', error);
    ElMessage.error('文件下载失败');
  }
};

// 获取文件类型显示名称
const getFileTypeLabel = (fileType: Api.Visualization.FileType) => {
  const labels = {
    txt: 'TXT 文本',
    pdf: 'PDF 文档',
    vcf: 'VCF 变异',
    csv: 'CSV 表格',
    image: '图片',
    graph: '关系图谱'
  };
  return labels[fileType] || fileType.toUpperCase();
};

// 动态生成表格列
const getTableColumns = (data: any[]) => {
  if (!data || data.length === 0) return [];

  // 收集所有行中出现的键，确保所有列都被包含
  const allKeys = new Set<string>();
  data.forEach(row => {
    Object.keys(row).forEach(key => allKeys.add(key));
  });

  return Array.from(allKeys);
};

// 将graph数据转换为ECharts需要的nodes和links格式
const transformGraphDataToECharts = (graphData: Api.Visualization.GraphData) => {
  const nodeMap = new Map<string, any>();
  const links: any[] = [];

  // 收集所有节点
  graphData.forEach(item => {
    if (!nodeMap.has(item.from)) {
      nodeMap.set(item.from, {
        id: item.from,
        name: item.from,
        symbolSize: 30
      });
    }
    if (!nodeMap.has(item.to)) {
      nodeMap.set(item.to, {
        id: item.to,
        name: item.to,
        symbolSize: 30
      });
    }

    // 添加边
    links.push({
      source: item.from,
      target: item.to
    });
  });

  return {
    nodes: Array.from(nodeMap.values()),
    links
  };
};

// Graph 图表配置
const graphChartOption = computed<any>(() => {
  if (!visualizationResult.value || visualizationResult.value.type !== 'graph') {
    return null;
  }

  const { nodes, links } = transformGraphDataToECharts(visualizationResult.value.data);

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          return `节点: ${params.data.name}`;
        }
        if (params.dataType === 'edge') {
          return `${params.data.source} → ${params.data.target}`;
        }
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
        label: {
          show: true,
          position: 'bottom',
          fontSize: 12,
          color: '#333'
        },
        emphasis: {
          focus: 'adjacency',
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
            color: '#000'
          },
          lineStyle: {
            width: 4,
            color: '#4a90e2'
          }
        },
        force: {
          repulsion: 1000,
          edgeLength: 150,
          gravity: 0.1,
          layoutAnimation: true
        },
        lineStyle: {
          color: 'source',
          width: 2,
          curveness: 0.1,
          opacity: 0.7
        },
        itemStyle: {
          borderColor: '#2c5aa0',
          borderWidth: 2,
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.1)'
        },
        symbol: 'circle',
        symbolSize: (value: any, params: any) => {
          // 根据节点连接数动态调整大小
          const nodeId = params?.data?.id || value?.id || '';
          const relatedLinks = links.filter((link: any) => link.source === nodeId || link.target === nodeId);
          return Math.max(30, Math.min(60, 30 + relatedLinks.length * 5));
        }
      }
    ]
  };
});

// 处理PDF在新窗口打开
const openPdfInNewWindow = (url: string) => {
  window.open(url, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
};

// 页面初始化
onMounted(async () => {
  // 检查任务管理权限（可视化页面需要 task 权限）
  const { checkPermissionAndNotify } = usePermissionGuard();
  const hasPermission = await checkPermissionAndNotify('task');
  if (!hasPermission) {
    return;
  }

  fetchTasks();
});
</script>

<template>
  <div v-loading="loading" class="h-full flex flex-col gap-4">
    <template v-if="!loading && !hasData">
      <ExceptionBase type="111" />
    </template>

    <template v-else>
      <ElCard class="flex-shrink-0" shadow="never">
        <div class="flex flex-wrap items-center gap-6">
          <div class="flex items-center gap-2">
            <label class="whitespace-nowrap text-gray-600 font-medium">任务ID:</label>
            <ElSelect v-model="selectedTaskId" placeholder="请选择任务" style="width: 240px">
              <ElOption v-for="option in taskOptions" :key="option.value" :label="option.label" :value="option.value" />
            </ElSelect>
          </div>

          <div v-if="availableFileTypes.length > 0" class="flex items-center gap-2">
            <label class="whitespace-nowrap text-gray-600 font-medium">可视化类型:</label>
            <ElButtonGroup>
              <ElButton
                v-for="fileType in availableFileTypes"
                :key="fileType"
                :type="selectedFileType === fileType ? 'primary' : 'default'"
                @click="handleFileTypeClick(fileType)"
              >
                {{ getFileTypeLabel(fileType) }}
              </ElButton>
            </ElButtonGroup>
          </div>

          <div v-if="selectedFileType === 'csv' && visualizationResult?.type === 'csv'" class="flex items-center gap-2">
            <label class="whitespace-nowrap text-gray-600 font-medium">CSV表格类型:</label>
            <ElSelect v-model="selectedCsvTable" placeholder="请选择表格类型" style="width: 150px">
              <ElOption
                v-for="option in csvTableOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </ElSelect>
          </div>

          <div v-if="selectedTaskId && selectedFileType" class="flex items-center gap-2">
            <ElButton type="primary" :icon="Download" @click="handleDownload">下载文件</ElButton>
          </div>
        </div>
      </ElCard>

      <ElCard class="min-h-0 flex-1" shadow="never">
        <div v-loading="visualizationLoading" class="min-h-96">
          <div v-if="!visualizationLoading && visualizationResult">
            <template v-if="visualizationResult.type === 'txt'">
              <div class="max-h-screen overflow-auto rounded bg-gray-50 p-4">
                <pre class="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed font-mono">{{
                  visualizationResult.data
                }}</pre>
              </div>
            </template>

            <template v-else-if="visualizationResult.type === 'pdf'">
              <div class="overflow-hidden rounded">
                <div class="mb-4">
                  <ElAlert type="info" :closable="false" show-icon>
                    <template #title>
                      <span>PDF文件预览</span>
                      <ElButton
                        type="primary"
                        size="small"
                        style="margin-left: 16px"
                        @click="openPdfInNewWindow(visualizationResult.data)"
                      >
                        在新窗口打开
                      </ElButton>
                    </template>
                  </ElAlert>
                </div>

                <div class="overflow-hidden border border-gray-300 rounded bg-gray-50">
                  <iframe :src="visualizationResult.data" frameborder="0" width="100%" height="600px" />
                </div>
              </div>
            </template>

            <template v-else-if="visualizationResult.type === 'vcf'">
              <ElTable :data="visualizationResult.data" border stripe class="max-h[600px] w-full">
                <ElTableColumn
                  v-for="column in getTableColumns(visualizationResult.data)"
                  :key="column"
                  :prop="column"
                  :label="column"
                  min-width="120"
                  show-overflow-tooltip
                />
              </ElTable>
            </template>

            <template v-else-if="visualizationResult.type === 'csv'">
              <div class="flex flex-col">
                <ElTable :data="currentCsvData" border stripe class="max-h-[600px] w-full">
                  <ElTableColumn
                    v-for="column in getTableColumns(currentCsvData)"
                    :key="column"
                    :prop="column"
                    :label="column"
                    min-width="120"
                    show-overflow-tooltip
                  />
                </ElTable>
              </div>
            </template>

            <template v-else-if="visualizationResult.type === 'image'">
              <div v-if="imageList.length" class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
                <div
                  v-for="(image, index) in imageList"
                  :key="image.url || index"
                  class="overflow-hidden border border-gray-200 rounded-lg bg-white shadow-sm transition-shadow duration-200 hover:shadow-md"
                >
                  <div class="relative w-full bg-gray-50 pt-full">
                    <ElImage
                      class="absolute inset-0 h-full w-full"
                      :src="image.url"
                      :preview-src-list="imagePreviewUrls"
                      :initial-index="index"
                      :preview-teleported="true"
                      fit="cover"
                      :lazy="true"
                    />
                  </div>
                  <p v-if="image.name" class="mx-3 my-2 text-center text-sm text-gray-600 leading-snug">
                    {{ image.name }}
                  </p>
                </div>
              </div>
              <div v-else class="min-h-48 flex items-center justify-center">
                <ElAlert title="当前没有可展示的图片" type="info" :closable="false" show-icon />
              </div>
            </template>

            <template v-else-if="visualizationResult.type === 'graph'">
              <VChart
                v-if="graphChartOption"
                :option="graphChartOption"
                autoresize
                class="w-full border border-gray-200 rounded bg-white"
                style="height: 600px"
              />
            </template>
          </div>

          <div v-else-if="!visualizationLoading && !selectedTaskId" class="min-h-48 flex items-center justify-center">
            <ElAlert title="请先选择一个任务" type="info" :closable="false" show-icon />
          </div>

          <div
            v-else-if="!visualizationLoading && selectedTaskId && !selectedFileType && availableFileTypes.length > 0"
            class="min-h-48 flex items-center justify-center"
          >
            <ElAlert title="请选择可视化类型来查看内容" type="info" :closable="false" show-icon />
          </div>

          <div
            v-else-if="!visualizationLoading && selectedTaskId && availableFileTypes.length === 0"
            class="min-h-48 flex items-center justify-center"
          >
            <ElAlert title="当前任务暂无可视化类型" type="warning" :closable="false" show-icon />
          </div>
        </div>
      </ElCard>
    </template>
  </div>
</template>
