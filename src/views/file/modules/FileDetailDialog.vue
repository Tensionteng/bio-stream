<script lang="ts" setup>
/**
 * FileDetailDialog.vue - 文件详情展示组件
 * 功能：
 * 1. 显示单个文件的完整信息（基本属性、大小、上传时间等）
 * 2. 展示文件的描述信息（JSON格式）
 * 3. 列出该文件上传的所有子文件（如果有）
 * 4. 支持查看文件哈希值、上传用户等元数据
 */

import { ref } from 'vue';
import { ElMessage, ElDialog, ElIcon, ElDescriptions, ElDescriptionsItem, ElDivider, ElTable, ElTableColumn, ElButton, ElCollapse } from 'element-plus';
import { fetchFileDetail } from '@/service/api/file';

// ============ Props 属性 ============
const props = defineProps<{
  modelValue: boolean;  // 弹窗显示状态
  fileId?: number;      // 要查看的文件ID
}>();

// ============ Emits 事件发射 ============
const emit = defineEmits<{
  'update:modelValue': [value: boolean]; // 更新弹窗可见性
}>();

// ============ 本地状态 ============
const fileDetailLoading = ref(false);   // 加载中标志
const fileDetailData = ref<any>(null);  // 文件详情数据

// ============ 功能函数 ============

/**
 * 异步获取文件详情数据
 * 功能：
 * 1. 调用后端API获取文件完整信息
 * 2. 处理响应数据并存储到本地状态
 * 3. 捕获错误并显示提示信息
 * @param {number} file_id - 文件ID
 */
async function fetchDetail(file_id: number) {
  fileDetailLoading.value = true;  // 显示加载状态
  fileDetailData.value = null;     // 清空旧数据
  try {
    const res = await fetchFileDetail(file_id);
    console.log('file detail response:', res);
    
    // 处理不同的响应结构（兼容axios和原生fetch）
    const file_detail = res.data || res.response.data;
    if (file_detail) {
      fileDetailData.value = file_detail;
    } else {
      ElMessage.error('未获取到文件详情');
    }
  } catch (e: any) {
    ElMessage.error(`获取文件详情失败: ${e.message || '未知错误'}`);
  } finally {
    fileDetailLoading.value = false; // 隐藏加载状态
  }
}

/**
 * 打开文件详情弹窗
 * 功能：加载指定文件的详细信息
 * @param {number} fileId - 文件ID
 */
function openDialog(fileId: number) {
  fetchDetail(fileId);
}

/**
 * 关闭文件详情弹窗
 * 功能：关闭弹窗并清理数据
 */
function closeDialog() {
  emit('update:modelValue', false);
  fileDetailData.value = null; // 清除数据避免闪烁
}

// ============ 暴露给父组件的公开API ============
defineExpose({
  openDialog,   // 打开弹窗并加载数据
  closeDialog   // 关闭弹窗
});
</script>

<template>
  <!-- 文件详情弹窗 -->
  <ElDialog
    :model-value="props.modelValue"
    title="文件详情"
    width="750px"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    :show-close="true"
    align-center
    class="file-detail-dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- 加载状态：显示Loading图标 -->
    <div v-if="fileDetailLoading" class="file-detail-loading">
      <ElIcon><i class="el-icon-loading"></i></ElIcon>
      加载中...
    </div>
    
    <!-- 文件详情内容：包含基本信息、描述、子文件列表 -->
    <div v-else-if="fileDetailData">
      <!-- 第一部分：文件基本信息（使用Descriptions组件展示） -->
      <ElDescriptions :column="2" border class="file-detail-desc">
        <ElDescriptionsItem label="文件ID">{{ fileDetailData.file_id }}</ElDescriptionsItem>
        <ElDescriptionsItem label="文件名">{{ fileDetailData.file_name }}</ElDescriptionsItem>
        <ElDescriptionsItem label="类型">{{ fileDetailData.file_type }}</ElDescriptionsItem>
        <ElDescriptionsItem label="大小">{{ fileDetailData.file_size }} 字节</ElDescriptionsItem>
        <ElDescriptionsItem label="上传时间">{{ fileDetailData.created_time }}</ElDescriptionsItem>
        <ElDescriptionsItem label="上传用户">
          <span v-if="fileDetailData.upload_user">
            {{ fileDetailData.upload_user.username }} (ID: {{ fileDetailData.upload_user.user_id }})
          </span>
        </ElDescriptionsItem>
      </ElDescriptions>
      
      <!-- 第二部分：描述信息（JSON格式，可折叠展示） -->
      <ElDivider content-position="left">描述信息</ElDivider>
      <div class="desc-json-area">
        <ElCollapse>
          <div class="desc-json-scroll">
            <pre class="desc-json-pre">{{ JSON.stringify(fileDetailData.description_json, null, 2) }}</pre>
          </div>
        </ElCollapse>
      </div>
      
      <!-- 第三部分：子文件列表（表格形式显示） -->
      <ElDivider content-position="left">子文件列表</ElDivider>
      <ElTable
        v-if="fileDetailData.uploaded_subfiles && fileDetailData.uploaded_subfiles.length"
        :data="fileDetailData.uploaded_subfiles"
        size="small"
        border
        class="file-detail-subfile-table"
      >
        <ElTableColumn prop="origin_filename" label="原始文件名" show-overflow-tooltip />
        <ElTableColumn prop="field_name" label="字段名" show-overflow-tooltip />
        <ElTableColumn prop="file_type" label="类型" show-overflow-tooltip />
        <ElTableColumn prop="file_size" label="大小(字节)" show-overflow-tooltip />
        <ElTableColumn prop="file_hash" label="哈希值" show-overflow-tooltip />
        <ElTableColumn prop="upload_time" label="上传时间" show-overflow-tooltip />
      </ElTable>
      <!-- 无子文件时的提示信息 -->
      <div v-else style="color: #aaa; text-align: center">无子文件</div>
    </div>
    
    <!-- 无数据状态 -->
    <div v-else style="color: #aaa; text-align: center">无详情数据</div>
    
    <!-- 弹窗页脚：关闭按钮 -->
    <template #footer>
      <ElButton type="primary" @click="closeDialog">关闭</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
/* ============ 加载状态样式 ============ */
/* 显示加载中的图标和文字 */
.file-detail-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 8px;
}

/* ============ 描述列表样式 ============ */
/* 文件基本信息的表格样式 */
.file-detail-desc {
  margin-bottom: 16px;
}

/* ============ JSON展示区域样式 ============ */
/* 可滚动的JSON内容容器 */
.desc-json-area {
  margin-bottom: 16px;
}

/* JSON内容的可滚动区域 */
.desc-json-scroll {
  max-height: 300px;  /* 限制高度，超出部分可滚动 */
  overflow-y: auto;   /* 允许竖直滚动 */
  background-color: #f5f7fa;
  border-radius: 4px;
  padding: 12px;
}

/* JSON预格式化文本 */
.desc-json-pre {
  margin: 0;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  color: #333;
  white-space: pre-wrap;  /* 保留换行和空格 */
  word-break: break-word; /* 长字符自动换行 */
}

/* ============ 子文件表格样式 ============ */
/* 子文件列表表格 */
.file-detail-subfile-table {
  margin-top: 12px;
}

/* ============ 深色模式适配 ============ */
@media (prefers-color-scheme: dark) {
  .desc-json-scroll {
    background-color: var(--el-bg-color);  /* 适配深色主题背景 */
  }

  .desc-json-pre {
    color: var(--el-text-color-primary);   /* 适配深色主题文字颜色 */
  }
}
</style>
