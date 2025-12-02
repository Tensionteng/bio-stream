<script lang="ts" setup>
import { ref } from 'vue';
import { ElMessage, ElDialog, ElIcon, ElDescriptions, ElDescriptionsItem, ElDivider, ElTable, ElTableColumn, ElButton, ElCollapse } from 'element-plus';
import { fetchFileDetail } from '@/service/api/file';

// Props
const props = defineProps<{
  modelValue: boolean;
  fileId?: number;
}>();

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

// 本地状态
const fileDetailLoading = ref(false);
const fileDetailData = ref<any>(null);

// 格式化时间显示，限制小数位
function formatTime(timeValue: any): string {
  if (!timeValue) return '-';
  
  // 如果是数字（时间戳），转换为字符串
  let timeStr = String(timeValue);
  
  // 如果包含 ISO 格式的 Z 或 +，保持原样
  if (timeStr.includes('Z') || timeStr.includes('+')) {
    return timeStr;
  }
  
  // 如果是带小数点的数字字符串，保留有效的时间部分
  // 例如：2025-12-02 10:30:45.123456 → 2025-12-02 10:30:45
  // 或：2025-12-02T10:30:45.123456Z → 2025-12-02T10:30:45Z
  if (timeStr.includes('.')) {
    const parts = timeStr.split('.');
    return parts[0]; // 只返回小数点前的部分
  }
  
  return timeStr;
}

// 获取文件详情
async function fetchDetail(file_id: number) {
  fileDetailLoading.value = true;
  fileDetailData.value = null;
  try {
    const res = await fetchFileDetail(file_id);
    console.log('file detail response:', res);
    const file_detail = res.data || res.response.data;
    if (file_detail) {
      fileDetailData.value = file_detail;
    } else {
      ElMessage.error('未获取到文件详情');
    }
  } catch (e: any) {
    ElMessage.error(`获取文件详情失败: ${e.message || '未知错误'}`);
  } finally {
    fileDetailLoading.value = false;
  }
}

// 监听 fileId 变化
function openDialog(fileId: number) {
  fetchDetail(fileId);
}

function closeDialog() {
  emit('update:modelValue', false);
  fileDetailData.value = null;
}

// 暴露给父组件
defineExpose({
  openDialog,
  closeDialog
});
</script>

<template>
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
    <div v-if="fileDetailLoading" class="file-detail-loading">
      <ElIcon><i class="el-icon-loading"></i></ElIcon>
      加载中...
    </div>
    <div v-else-if="fileDetailData">
      <ElDescriptions :column="2" border class="file-detail-desc">
        <ElDescriptionsItem label="文件ID">{{ fileDetailData.file_id }}</ElDescriptionsItem>
        <ElDescriptionsItem label="文件名">{{ fileDetailData.file_name }}</ElDescriptionsItem>
        <ElDescriptionsItem label="类型">{{ fileDetailData.file_type }}</ElDescriptionsItem>
        <ElDescriptionsItem label="大小">{{ fileDetailData.file_size }} 字节</ElDescriptionsItem>
        <ElDescriptionsItem label="上传时间">{{ formatTime(fileDetailData.created_time) }}</ElDescriptionsItem>
        <ElDescriptionsItem label="上传用户">
          <span v-if="fileDetailData.upload_user">
            {{ fileDetailData.upload_user.username }} (ID: {{ fileDetailData.upload_user.user_id }})
          </span>
        </ElDescriptionsItem>
      </ElDescriptions>
      <ElDivider content-position="left">描述信息</ElDivider>
      <div class="desc-json-area">
        <ElCollapse>
          <div class="desc-json-scroll">
            <pre class="desc-json-pre">{{ JSON.stringify(fileDetailData.description_json, null, 2) }}</pre>
          </div>
        </ElCollapse>
      </div>
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
        <ElTableColumn prop="upload_time" label="上传时间" show-overflow-tooltip>
          <template #default="scope">
            {{ formatTime(scope.row.upload_time) }}
          </template>
        </ElTableColumn>
      </ElTable>
      <div v-else style="color: #aaa; text-align: center">无子文件</div>
    </div>
    <div v-else style="color: #aaa; text-align: center">无详情数据</div>
    <template #footer>
      <ElButton type="primary" @click="closeDialog">关闭</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.file-detail-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 8px;
}

.file-detail-desc {
  margin-bottom: 16px;
}

.desc-json-area {
  margin-bottom: 16px;
}

.desc-json-scroll {
  max-height: 300px;
  overflow-y: auto;
  background-color: #f5f7fa;
  border-radius: 4px;
  padding: 12px;
}

.desc-json-pre {
  margin: 0;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
}

.file-detail-subfile-table {
  margin-top: 12px;
}

@media (prefers-color-scheme: dark) {
  .desc-json-scroll {
    background-color: var(--el-bg-color);
  }

  .desc-json-pre {
    color: var(--el-text-color-primary);
  }
}
</style>
