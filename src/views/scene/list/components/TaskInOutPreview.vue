<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { DArrowRight, DocumentCopy } from '@element-plus/icons-vue';
import { fetchTaskInOut } from '@/service/api/task';

const props = defineProps<{
  taskId: number | null;
}>();

const loading = ref(false);
const inputContent = ref('');
// 输出改为数组类型，适配 JSON 结构
const outputContent = ref<any[]>([]);

// 获取数据
const getInOutData = async () => {
  if (!props.taskId) return;

  loading.value = true;
  inputContent.value = '';
  outputContent.value = [];

  try {
    const { data } = await fetchTaskInOut(props.taskId);
    if (data) {
      inputContent.value = data.input || '无输入内容';
      // 判断 output 是否为数组，如果是则直接赋值，否则尝试解析或置空
      if (Array.isArray(data.output)) {
        outputContent.value = data.output;
      } else {
        // 兼容旧数据或错误格式
        outputContent.value = [];
      }
    }
  } catch (error) {
    console.error(error);
    inputContent.value = '数据加载失败';
  } finally {
    loading.value = false;
  }
};

// 计算表格的列（动态获取 JSON 对象的 Key）
const tableColumns = computed(() => {
  if (outputContent.value.length > 0) {
    return Object.keys(outputContent.value[0]);
  }
  return [];
});

// 复制功能
const handleCopy = async (content: string | any[]) => {
  if (!content) return;

  let textToCopy = '';

  // 如果是数组（表格数据），转换为格式化的 JSON 字符串供复制
  if (Array.isArray(content)) {
    if (content.length === 0) return;
    textToCopy = JSON.stringify(content, null, 2);
  } else {
    textToCopy = content;
  }

  try {
    await navigator.clipboard.writeText(textToCopy);
    ElMessage.success('复制成功');
  } catch (e) {
    console.error(e);
    ElMessage.error('复制失败，请手动复制');
  }
};

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
          <span class="label">输入文件预览 (Head)</span>
        </div>
        <ElButton link size="small" :icon="DocumentCopy" @click="handleCopy(inputContent)">复制</ElButton>
      </div>
      <div class="code-wrapper light-theme">
        <pre>{{ inputContent }}</pre>
      </div>
    </div>

    <div class="flow-arrow">
      <ElIcon><DArrowRight /></ElIcon>
    </div>

    <div class="preview-panel output-panel">
      <div class="panel-header">
        <div class="header-title">
          <span class="badge output-badge">OUTPUT</span>
          <span class="label">输出文件预览 (Head)</span>
        </div>
        <ElButton link size="small" :icon="DocumentCopy" @click="handleCopy(outputContent)">复制 JSON</ElButton>
      </div>
      <div class="table-wrapper">
        <ElTable
          v-if="outputContent.length > 0"
          :data="outputContent"
          border
          stripe
          height="100%"
          style="width: 100%"
          :header-cell-style="{ background: '#f5f7fa', color: '#606266' }"
        >
          <ElTableColumn
            v-for="col in tableColumns"
            :key="col"
            :prop="col"
            :label="col"
            min-width="120"
            show-overflow-tooltip
          />
        </ElTable>
        <div v-else class="empty-text">暂无输出数据</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inout-container {
  display: flex;
  align-items: stretch;
  gap: 16px;
  width: 100%;
  margin-top: 20px;
  height: 400px; /* 固定整体高度，确保表格滚动 */
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
  min-width: 0; /* 防止 flex 子项撑开 */
}

.preview-panel:hover {
  box-shadow: 0 4px 16px 0 rgba(0, 0, 0, 0.1);
  border-color: #dcdfe6;
}

/* 头部样式 */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0; /* 防止头部被压缩 */
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

/* 徽章样式 */
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

/* --- 输入区域样式 (修改为白底黑字) --- */
.code-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* 亮色主题 */
.code-wrapper.light-theme {
  background: #ffffff; /* 白底 */
}

.code-wrapper.light-theme pre {
  margin: 0;
  padding: 12px;
  color: #303133; /* 黑字 (深灰) */
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  height: 100%;
  overflow-y: auto;
}

/* 亮色滚动条 */
.code-wrapper.light-theme pre::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.code-wrapper.light-theme pre::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 3px;
}
.code-wrapper.light-theme pre::-webkit-scrollbar-track {
  background: #f5f7fa;
}

/* --- 输出区域样式 (表格容器) --- */
.table-wrapper {
  flex: 1;
  padding: 0;
  overflow: hidden; /* 让 el-table 处理滚动 */
  position: relative;
}

.empty-text {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #909399;
  font-size: 13px;
}

/* 中间箭头 */
.flow-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
  font-size: 20px;
}
</style>
