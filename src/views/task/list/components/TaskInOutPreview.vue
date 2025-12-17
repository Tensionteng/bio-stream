<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { DArrowRight } from '@element-plus/icons-vue';
import { fetchTaskInOut } from '@/service/api/task';

const props = defineProps<{
  taskId: number | null;
}>();

const loading = ref(false);

// 初始化数据状态
const inputData = ref<Api.Task.TaskInOutItem>({ type: 'txt', datas: '' });
const outputData = ref<Api.Task.TaskInOutItem>({ type: 'txt', datas: '' });

// 获取数据
const getInOutData = async () => {
  if (!props.taskId) return;

  loading.value = true;
  inputData.value = { type: 'txt', datas: '' };
  outputData.value = { type: 'txt', datas: '' };

  try {
    const { data } = await fetchTaskInOut(props.taskId);
    if (data) {
      if (data.input) {
        inputData.value = {
          type: data.input.type || 'txt',
          datas: data.input.datas || ''
        };
      }
      if (data.output) {
        outputData.value = {
          type: data.output.type || 'txt',
          datas: data.output.datas || ''
        };
      }
    }
  } catch (error) {
    console.error(error);
    inputData.value.datas = '数据加载失败';
  } finally {
    loading.value = false;
  }
};

// 动态获取表格列
const getTableColumns = (dataList: any) => {
  if (Array.isArray(dataList) && dataList.length > 0) {
    return Object.keys(dataList[0]);
  }
  return [];
};

const inputColumns = computed(() => getTableColumns(inputData.value.datas));
const outputColumns = computed(() => getTableColumns(outputData.value.datas));

watch(
  () => props.taskId,
  newId => {
    if (newId) getInOutData();
  },
  { immediate: true }
);
</script>

<template>
  <div v-loading="loading" class="inout-container" element-loading-text="加载文件预览中...">
    <div class="input-panel preview-panel">
      <div class="panel-header">
        <div class="header-title">
          <span class="badge input-badge">INPUT</span>
          <span class="label">输入预览 ({{ inputData.type?.toUpperCase() }})</span>
        </div>
      </div>

      <div v-if="inputData.type === 'txt'" class="code-wrapper light-theme">
        <pre>{{ inputData.datas }}</pre>
      </div>

      <div v-else-if="inputData.type === 'csv'" class="table-wrapper">
        <ElTable
          v-if="Array.isArray(inputData.datas) && inputData.datas.length > 0"
          :data="inputData.datas"
          border
          stripe
          height="100%"
          style="width: 100%"
          :header-cell-style="{ background: '#f5f7fa', color: '#606266' }"
        >
          <ElTableColumn
            v-for="col in inputColumns"
            :key="col"
            :prop="col"
            :label="col"
            min-width="120"
            show-overflow-tooltip
            align="left"
            header-align="left"
          >
            <template #default="scope">
              {{ scope.row[col] }}
            </template>
          </ElTableColumn>
        </ElTable>
        <div v-else class="empty-text">暂无表格数据</div>
      </div>
    </div>

    <div class="flow-arrow">
      <ElIcon><DArrowRight /></ElIcon>
    </div>

    <div class="preview-panel output-panel">
      <div class="panel-header">
        <div class="header-title">
          <span class="badge output-badge">OUTPUT</span>
          <span class="label">输出预览 ({{ outputData.type?.toUpperCase() }})</span>
        </div>
      </div>

      <div v-if="outputData.type === 'txt'" class="code-wrapper light-theme">
        <pre>{{ outputData.datas }}</pre>
      </div>

      <div v-else-if="outputData.type === 'csv'" class="table-wrapper">
        <ElTable
          v-if="Array.isArray(outputData.datas) && outputData.datas.length > 0"
          :data="outputData.datas"
          border
          stripe
          height="100%"
          style="width: 100%"
          :header-cell-style="{ background: '#f5f7fa', color: '#606266' }"
        >
          <ElTableColumn
            v-for="col in outputColumns"
            :key="col"
            :prop="col"
            :label="col"
            min-width="120"
            show-overflow-tooltip
            align="left"
            header-align="left"
          >
            <template #default="scope">
              {{ scope.row[col] }}
            </template>
          </ElTableColumn>
        </ElTable>
        <div v-else class="empty-text">暂无表格数据</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 样式保持不变 */
.inout-container {
  display: flex;
  align-items: stretch;
  gap: 16px;
  width: 100%;
  margin-top: 20px;
  height: 400px;
}

.preview-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  transition: all 0.3s;
  min-width: 0;
}

.preview-panel:hover {
  box-shadow: 0 4px 16px 0 rgba(0, 0, 0, 0.1);
  border-color: #dcdfe6;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}

.badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  font-family: monospace;
}

.input-badge {
  background: #ecf5ff;
  color: #409eff;
  border: 1px solid #d9ecff;
}

.output-badge {
  background: #f0f9eb;
  color: #67c23a;
  border: 1px solid #e1f3d8;
}

.code-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.code-wrapper.light-theme {
  background: #ffffff;
}

.code-wrapper.light-theme pre {
  margin: 0;
  padding: 12px;
  color: #303133;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  height: 100%;
  overflow-y: auto;
}

.code-wrapper.light-theme pre::-webkit-scrollbar,
:deep(.el-table__body-wrapper::-webkit-scrollbar) {
  width: 6px;
  height: 6px;
}
.code-wrapper.light-theme pre::-webkit-scrollbar-thumb,
:deep(.el-table__body-wrapper::-webkit-scrollbar-thumb) {
  background: #c0c4cc;
  border-radius: 3px;
}
.code-wrapper.light-theme pre::-webkit-scrollbar-track,
:deep(.el-table__body-wrapper::-webkit-scrollbar-track) {
  background: #f5f7fa;
}

.table-wrapper {
  flex: 1;
  padding: 0;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.empty-text {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #909399;
  font-size: 13px;
}

.flow-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
  font-size: 20px;
}

:deep(.el-table th.el-table__cell) {
  background-color: #f5f7fa !important;
}

:deep(.el-table thead th:first-child .cell) {
  padding-left: 24px;
}

:deep(.el-table tbody td:first-child .cell) {
  padding-left: 24px;
}
</style>
