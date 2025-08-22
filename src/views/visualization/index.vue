<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ElAlert, ElButton, ElButtonGroup, ElCard, ElOption, ElSelect, ElTable, ElTableColumn } from 'element-plus';
import { fetchTaskInfo, fetchTaskResult } from '@/service/api/visulizaiton';
// 响应式数据
const loading = ref(false);
const visualizationLoading = ref(false);
const tasks = ref<Api.Visualization.TaskInfo[]>([]);
const selectedTaskId = ref<number | ''>('');
const selectedFileType = ref<Api.Visualization.FileType | ''>('');
const visualizationResult = ref<Api.Visualization.Result | null>(null);

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

// 获取任务列表
const fetchTasks = async () => {
  try {
    loading.value = true;
    const { data } = await fetchTaskInfo();
    console.log('获取任务列表:', data);

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
const fetchVisualizationData = async (fileType: Api.Visualization.FileType) => {
  if (!selectedTaskId.value || !fileType) return;

  try {
    visualizationLoading.value = true;
    selectedFileType.value = fileType;
    const { data } = await fetchTaskResult(selectedTaskId.value.toString(), fileType);
    visualizationResult.value = data;
  } catch (error) {
    console.error('获取可视化数据失败:', error);
    visualizationResult.value = null;
  } finally {
    visualizationLoading.value = false;
  }
};

// 当任务ID变化时，清空选择的文件类型和可视化结果
watch(selectedTaskId, () => {
  selectedFileType.value = '';
  visualizationResult.value = null;
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
    csv: 'CSV 表格'
  };
  return labels[fileType] || fileType.toUpperCase();
};

// 动态生成表格列
const getTableColumns = (data: any[]) => {
  if (!data || data.length === 0) return [];

  const firstRow = data[0];
  return Object.keys(firstRow);
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

            <!-- PDF 文件展示 -->
            <template v-else-if="visualizationResult.type === 'pdf'">
              <div class="pdf-content">
                <iframe :src="visualizationResult.data" frameborder="0" width="100%" height="600px" />
              </div>
            </template>

            <!-- VCF/CSV 表格展示 -->
            <template v-else-if="visualizationResult.type === 'vcf' || visualizationResult.type === 'csv'">
              <ElTable :data="visualizationResult.data" border stripe style="width: 100%" max-height="600">
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
          </div>

          <!-- 提示选择可视化类型 -->
          <div
            v-else-if="!visualizationLoading && !visualizationResult && availableFileTypes.length > 0"
            class="select-hint"
          >
            <ElAlert title="请选择上方的可视化类型来查看内容" type="info" :closable="false" show-icon />
          </div>

          <!-- 无可用的可视化类型 -->
          <div v-else-if="!visualizationLoading && availableFileTypes.length === 0" class="no-types">
            <ElAlert title="当前任务暂无可用的可视化类型" type="warning" :closable="false" show-icon />
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
  border: 1px solid #dcdfe6;
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
