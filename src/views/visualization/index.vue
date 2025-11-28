<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
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
import { fetchTaskInfo, fetchTaskResult } from '@/service/api/visulizaiton';
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

// 获取可视化结果
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

const fetchVisualizationData = async (fileType: Api.Visualization.FileType) => {
  if (!selectedTaskId.value || !fileType) return;

  try {
    visualizationLoading.value = true;
    selectedFileType.value = fileType;
    const { data: resultData } = await fetchTaskResult(selectedTaskId.value.toString(), fileType);

    if (resultData && resultData.type === 'pdf') {
      visualizationResult.value = {
        type: 'pdf',
        data: normalizePdfUrl(resultData.data)
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
      image: '图片数据加载成功'
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
  selectedFileType.value = '';
  visualizationResult.value = null;
  selectedCsvTable.value = 'count_csv'; // 重置CSV表格选择
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

// 获取文件类型显示名称
const getFileTypeLabel = (fileType: Api.Visualization.FileType) => {
  const labels = {
    txt: 'TXT 文本',
    pdf: 'PDF 文档',
    vcf: 'VCF 变异',
    csv: 'CSV 表格',
    image: '图片'
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

// 处理PDF在新窗口打开 - 移除iframe，直接打开新窗口
const openPdfInNewWindow = (url: string) => {
  window.open(url, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
};

// 页面初始化
onMounted(() => {
  fetchTasks();
});
</script>

<template>
  <div v-loading="loading" class="visualization-container">
    <!-- 空状态页面 -->
    <template v-if="!loading && !hasData">
      <ExceptionBase type="111" />
    </template>

    <!-- 有数据时的正常页面 -->
    <template v-else>
      <!-- 上部分：选择区域 -->
      <ElCard class="selection-card" shadow="never">
        <div class="selection-content">
          <div class="selection-item">
            <label class="selection-label">任务ID:</label>
            <ElSelect v-model="selectedTaskId" placeholder="请选择任务" style="width: 240px">
              <ElOption v-for="option in taskOptions" :key="option.value" :label="option.label" :value="option.value" />
            </ElSelect>
          </div>

          <div v-if="availableFileTypes.length > 0" class="selection-item">
            <label class="selection-label">可视化类型:</label>
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

          <!-- CSV表格类型选择 - 只在选择CSV类型且有结果时显示 -->
          <div v-if="selectedFileType === 'csv' && visualizationResult?.type === 'csv'" class="selection-item">
            <label class="selection-label">CSV表格类型:</label>
            <ElSelect v-model="selectedCsvTable" placeholder="请选择表格类型" style="width: 150px">
              <ElOption
                v-for="option in csvTableOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </ElSelect>
          </div>
        </div>
      </ElCard>

      <!-- 下部分：可视化内容 -->
      <ElCard class="content-card" shadow="never">
        <div v-loading="visualizationLoading" class="visualization-content">
          <!-- 有可视化结果时展示 -->
          <div v-if="!visualizationLoading && visualizationResult">
            <!-- TXT 文件展示 -->
            <template v-if="visualizationResult.type === 'txt'">
              <div class="txt-content">
                <pre>{{ visualizationResult.data }}</pre>
              </div>
            </template>

            <!-- PDF 文件展示 - 改回iframe -->
            <template v-else-if="visualizationResult.type === 'pdf'">
              <div class="pdf-content">
                <div class="pdf-header">
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

                <!-- iframe显示PDF -->
                <div class="pdf-iframe-container">
                  <iframe :src="visualizationResult.data" frameborder="0" width="100%" height="600px" />
                </div>
              </div>
            </template>

            <!-- VCF 表格展示 -->
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

            <!-- CSV 表格展示 -->
            <template v-else-if="visualizationResult.type === 'csv'">
              <div class="csv-container">
                <ElTable :data="currentCsvData" border stripe class="max-h[600px] w-full">
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

            <!-- 图片展示 -->
            <template v-else-if="visualizationResult.type === 'image'">
              <div v-if="imageList.length" class="image-grid">
                <div v-for="(image, index) in imageList" :key="image.url || index" class="image-item">
                  <div class="image-thumb-wrapper">
                    <ElImage
                      class="image-thumb"
                      :src="image.url"
                      :preview-src-list="imagePreviewUrls"
                      :initial-index="index"
                      :preview-teleported="true"
                      fit="cover"
                      :lazy="true"
                    />
                  </div>
                  <p v-if="image.name" class="image-caption">{{ image.name }}</p>
                </div>
              </div>
              <div v-else class="no-image-hint">
                <ElAlert title="当前没有可展示的图片" type="info" :closable="false" show-icon />
              </div>
            </template>
          </div>

          <!-- 未选择任务时的提示 -->
          <div v-else-if="!visualizationLoading && !selectedTaskId" class="select-hint">
            <ElAlert title="请先选择一个任务" type="info" :closable="false" show-icon />
          </div>

          <!-- 未选择可视化类型时的提示 -->
          <div
            v-else-if="!visualizationLoading && selectedTaskId && !selectedFileType && availableFileTypes.length > 0"
            class="select-hint"
          >
            <ElAlert title="请选择可视化类型来查看内容" type="info" :closable="false" show-icon />
          </div>

          <!-- 无可用的可视化类型 -->
          <div v-else-if="!visualizationLoading && selectedTaskId && availableFileTypes.length === 0" class="no-types">
            <ElAlert title="当前任务暂无可视化类型" type="warning" :closable="false" show-icon />
          </div>
        </div>
      </ElCard>
    </template>
  </div>
</template>

<style scoped>
.visualization-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.selection-card {
  flex-shrink: 0;
}

.selection-content {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.selection-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selection-label {
  font-weight: 500;
  color: #606266;
  white-space: nowrap;
}

.content-card {
  flex: 1;
  min-height: 0;
}

.visualization-content {
  min-height: 400px;
}

.txt-content {
  background-color: #f5f7fa;
  border-radius: 4px;
  padding: 16px;
  max-height: 600px;
  overflow: auto;
}

.txt-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
}

.pdf-content {
  border-radius: 4px;
  overflow: hidden;
}

.pdf-header {
  margin-bottom: 16px;
}

.pdf-iframe-container {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  background-color: #f8f9fa;
}

.pdf-info {
  text-align: center;
  margin-bottom: 32px;
}

.pdf-info h3 {
  margin: 0 0 16px 0;
  font-size: 24px;
  color: #303133;
  font-weight: 600;
}

.pdf-info p {
  margin: 0;
  color: #606266;
  font-size: 16px;
}

.pdf-actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
}

.csv-container {
  display: flex;
  flex-direction: column;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}

.image-item {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background-color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.2s ease;
  overflow: hidden;
}

.image-item:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}

.image-thumb-wrapper {
  position: relative;
  width: 100%;
  padding-top: 100%;
  background-color: #f5f7fa;
}

.image-thumb {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.image-thumb :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-caption {
  margin: 8px 12px 12px;
  font-size: 14px;
  color: #606266;
  text-align: center;
  line-height: 1.4;
}

.no-image-hint {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.select-hint,
.no-types {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.el-button-group .el-button {
  margin: 0;
}
</style>
