<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus'; // 移除了 useClipboard
import { DArrowRight, DocumentCopy } from '@element-plus/icons-vue';
import { fetchTaskInOut } from '@/service/api/task'; // 引入上面定义的 API

const props = defineProps<{
  taskId: number | null;
}>();

const loading = ref(false);
const inputContent = ref('');
const outputContent = ref('');

// 获取数据
const getInOutData = async () => {
  if (!props.taskId) return;

  loading.value = true;
  inputContent.value = '';
  outputContent.value = '';

  try {
    const { data } = await fetchTaskInOut(props.taskId);
    if (data) {
      inputContent.value = data.input || '无输入内容';
      outputContent.value = data.output || '无输出内容';
    }
  } catch (error) {
    console.error(error);
    inputContent.value = '数据加载失败';
    outputContent.value = '数据加载失败';
  } finally {
    loading.value = false;
  }
};

// 复制功能 - 使用浏览器原生 API
const handleCopy = async (text: string) => {
  if (!text) return;
  try {
    // 使用原生 clipboard API，无需额外依赖
    await navigator.clipboard.writeText(text);
    ElMessage.success('复制成功');
  } catch (e) {
    console.error(e);
    ElMessage.error('复制失败，请手动复制');
  }
};

// 监听 taskId 变化或组件挂载时加载
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
    <div class="preview-panel input-panel">
      <div class="panel-header">
        <div class="header-title">
          <span class="badge input-badge">INPUT</span>
          <span class="label">输入文件预览 (Head)</span>
        </div>
        <ElButton link size="small" :icon="DocumentCopy" @click="handleCopy(inputContent)">复制</ElButton>
      </div>
      <div class="code-wrapper">
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
        <ElButton link size="small" :icon="DocumentCopy" @click="handleCopy(outputContent)">复制</ElButton>
      </div>
      <div class="code-wrapper">
        <pre>{{ outputContent }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inout-container {
  display: flex;
  align-items: stretch; /* 让左右高度一致 */
  gap: 16px;
  width: 100%;
  margin-top: 20px;
  min-height: 200px;
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

/* 代码区域样式 */
.code-wrapper {
  flex: 1;
  background: #1e1e1e; /* 暗色背景 */
  position: relative;
  overflow: hidden;
  min-height: 240px;
}

.code-wrapper pre {
  margin: 0;
  padding: 12px;
  color: #d4d4d4;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap; /* 自动换行 */
  word-break: break-all;
  height: 100%;
  overflow-y: auto;
  max-height: 350px; /* 限制最大高度，出现滚动条 */
}

/* 滚动条美化 */
.code-wrapper pre::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.code-wrapper pre::-webkit-scrollbar-thumb {
  background: #4a4a4a;
  border-radius: 3px;
}
.code-wrapper pre::-webkit-scrollbar-track {
  background: #1e1e1e;
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
