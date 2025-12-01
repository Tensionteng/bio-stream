<script lang="ts" setup>
import { ref } from 'vue';
import { Upload, CaretTop } from '@element-plus/icons-vue';
import { ElIcon, ElButton, ElProgress } from 'element-plus';

// Props
const props = defineProps<{
  tasks: any[];
}>();

// Emits
const emit = defineEmits<{
  'cancel-task': [taskId: string];
  'remove-task': [taskId: string];
}>();

const uploadTaskPanelCollapsed = ref(false);

function handleCancelTask(taskId: string) {
  emit('cancel-task', taskId);
}

function handleRemoveTask(taskId: string) {
  emit('remove-task', taskId);
}
</script>

<template>
  <div v-if="props.tasks.length > 0" class="upload-task-panel">
    <div class="task-panel-header" @click="uploadTaskPanelCollapsed = !uploadTaskPanelCollapsed">
      <div class="task-panel-title">
        <ElIcon class="task-icon"><Upload /></ElIcon>
        <span>正在上传文件数 ({{ props.tasks.filter(t => t.status === 'uploading').length }})</span>
      </div>
      <ElIcon class="collapse-icon" :style="{ transform: uploadTaskPanelCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }">
        <CaretTop />
      </ElIcon>
    </div>
    
    <div v-show="!uploadTaskPanelCollapsed" class="task-panel-content">
      <div v-for="task in props.tasks" :key="task.id" class="task-item">
        <div class="task-info">
          <span class="task-name">{{ task.fileName }}</span>
          <span class="task-status" :class="task.status">
            {{ task.status === 'uploading' ? (task.canceling ? '取消中...' : '上传中') : task.status === 'success' ? '成功' : '失败' }}
          </span>
        </div>
        <ElProgress 
          :percentage="task.progress" 
          :status="task.status === 'error' ? 'exception' : task.status === 'success' ? 'success' : ''"
          :show-text="false"
          class="task-progress"
        />
        <div v-if="task.error" class="task-error">{{ task.error }}</div>
        <div class="task-actions">
          <ElButton 
            v-if="task.status === 'uploading'" 
            size="small" 
            type="danger"
            :disabled="task.canceling"
            text
            @click="handleCancelTask(task.id)"
          >
            {{ task.canceling ? '取消中...' : '取消' }}
          </ElButton>
          <ElButton 
            v-if="task.status !== 'uploading'"
            size="small" 
            type="primary" 
            text
            @click="handleRemoveTask(task.id)"
          >
            移除
          </ElButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.upload-task-panel {
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: 400px;
  max-height: 500px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  z-index: 999;
  display: flex;
  flex-direction: column-reverse;
}

.task-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid #ebeef5;
  cursor: pointer;
  user-select: none;
  background: #f5f7fa;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
}

.task-panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: #303133;
}

.task-icon {
  font-size: 16px;
  color: #409eff;
}

.collapse-icon {
  font-size: 14px;
  transition: transform 0.3s;
}

.task-panel-content {
  flex: 1;
  overflow-y: auto;
  max-height: 450px;
  display: flex;
  flex-direction: column-reverse;
}

.task-item {
  padding: 12px 16px;
  border-top: 1px solid #ebeef5;
  border-bottom: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item:first-child {
  border-top: none;
}

.task-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.task-name {
  flex: 1;
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 3px;
  white-space: nowrap;
}

.task-status.uploading {
  background: #e6f7ff;
  color: #0050b3;
}

.task-status.success {
  background: #f6ffed;
  color: #274e0f;
}

.task-status.error {
  background: #fff1f0;
  color: #820014;
}

.task-progress {
  width: 100%;
}

.task-error {
  font-size: 12px;
  color: #f56c6c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .upload-task-panel {
    width: 320px;
    bottom: 10px;
    left: 10px;
  }

  .task-panel-content {
    max-height: 350px;
  }
}

@media (prefers-color-scheme: dark) {
  .upload-task-panel {
    background: var(--el-bg-color-overlay, #232324);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
  }

  .task-panel-header {
    border-top-color: var(--el-border-color);
    background: var(--el-bg-color);
  }

  .task-panel-title {
    color: var(--el-text-color-primary);
  }

  .task-item {
    border-top-color: var(--el-border-color);
  }

  .task-name {
    color: var(--el-text-color-regular);
  }
}
</style>
