<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { ElCard } from 'element-plus';

// 导入子组件
import StatsCard from './modules/StatsCard.vue';
import SchemaSelection from './modules/SchemaSelection.vue';
import FormSection from './modules/FormSection.vue';
import UploadTaskPanel from './modules/UploadTaskPanel.vue';
import FileList from './modules/FileList.vue';
import FileDetailDialog from './modules/FileDetailDialog.vue';
import LineageDialog from './modules/LineageDialog.vue';

// 导入上传功能
import { useFileUpload } from './modules/useFileUpload';

// 组件引用
const statsCardRef = ref();
const schemaSelectionRef = ref();
const formSectionRef = ref();
const fileListRef = ref();
const fileDetailDialogRef = ref();
const lineageDialogRef = ref();

// 上传功能
const { 
  uploadLoading, 
  uploadTaskList, 
  handleBatchSubmit, 
  cancelUploadTask, 
  removeUploadTask 
} = useFileUpload();

// 状态
const selectedSchemaId = ref('');
const selectedSchema = ref<any>(null);
const fileDetailDialogVisible = ref(false);
const lineageDialogVisible = ref(false);
const currentLineageRow = ref<any>(null);

// 处理Schema选择
function handleSchemaSelected(schema: any) {
  selectedSchema.value = schema;
}

// 处理提交
async function handleFormSubmit() {
  if (formSectionRef.value) {
    await handleBatchSubmit(
      formSectionRef.value.dynamicForm,
      selectedSchema.value,
      formSectionRef.value.textFields,
      formSectionRef.value.fileFields,
      formSectionRef.value.fileFieldGroupSizes,
      (field) => formSectionRef.value.getUploadedFilesForField(field),
      () => formSectionRef.value.validateFileFields(),
      () => formSectionRef.value.validateTextFields(),
      () => formSectionRef.value.resetForm(),
      () => {
        // 上传成功后刷新文件列表
        if (fileListRef.value) {
          fileListRef.value.fetchFileList();
        }
      }
    );
  }
}

// 处理文件详情
function handleShowDetail(fileId: number) {
  fileDetailDialogVisible.value = true;
  if (fileDetailDialogRef.value) {
    fileDetailDialogRef.value.openDialog(fileId);
  }
}

// 处理世系图
function handleShowLineage(row: any) {
  lineageDialogVisible.value = true;
  currentLineageRow.value = row;
  if (lineageDialogRef.value) {
    lineageDialogRef.value.showLineage(row);
  }
}

// 处理取消上传任务
function handleCancelTask(taskId: string) {
  cancelUploadTask(taskId);
}

// 处理移除上传任务
function handleRemoveTask(taskId: string) {
  removeUploadTask(taskId);
}

// 初始化
onMounted(() => {
  if (statsCardRef.value) {
    statsCardRef.value.fetchFileStats();
  }
  if (schemaSelectionRef.value) {
    schemaSelectionRef.value.init();
  }
  if (fileListRef.value) {
    fileListRef.value.init();
  }
});
</script>

<template>
  <div class="transfer-container equal-height-flex">
    <!-- 主功能区 -->
    <ElCard shadow="hover" class="transfer-card main-card">
      <!-- 统计信息 -->
      <StatsCard ref="statsCardRef" />

      <!-- 数据类型选择 -->
      <SchemaSelection
        ref="schemaSelectionRef"
        :model-value="selectedSchemaId"
        @update:model-value="selectedSchemaId = $event"
        @schema-selected="handleSchemaSelected"
      />

      <!-- 表单填写和文件上传 -->
      <FormSection
        ref="formSectionRef"
        :schema="selectedSchema"
        @upload-start="uploadLoading = true"
        @upload-complete="uploadLoading = false"
      />

      <!-- 未选择数据类型时的提示 -->
      <div v-if="!selectedSchema" class="empty-prompt">
        <div class="prompt-icon">📋</div>
        <div class="prompt-title">请选择数据类型</div>
        <div class="prompt-desc">选择数据类型后，将显示对应的表单字段和文件上传选项</div>
      </div>

      <!-- 提交按钮 -->
      <div v-if="selectedSchema" class="submit-button-area">
        <ElButton type="primary" :loading="uploadLoading" size="large" @click="handleFormSubmit">提交并上传</ElButton>
      </div>
    </ElCard>

    <!-- 文件列表区域 -->
    <div class="history-list-area">
      <ElCard shadow="hover" class="history-card">
        <FileList
          ref="fileListRef"
          @detail="handleShowDetail"
          @lineage="handleShowLineage"
        />
      </ElCard>
    </div>

    <!-- 上传任务面板 -->
    <UploadTaskPanel :tasks="uploadTaskList" @cancel-task="handleCancelTask" @remove-task="handleRemoveTask" />

    <!-- 文件详情弹窗 -->
    <FileDetailDialog
      ref="fileDetailDialogRef"
      :model-value="fileDetailDialogVisible"
      @update:model-value="fileDetailDialogVisible = $event"
    />

    <!-- 数据世系展示弹窗 -->
    <LineageDialog
      ref="lineageDialogRef"
      :model-value="lineageDialogVisible"
      :row="currentLineageRow"
      @update:model-value="lineageDialogVisible = $event"
    />
  </div>
</template>

<style scoped>
.equal-height-flex {
  padding: 1% 1% 1% 1%;
  display: flex;
  gap: 1%;
  align-items: stretch;
  flex-wrap: wrap;
}

.main-card {
  flex: 0 1 45%;
  min-width: 320px;
  max-width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: stretch;
  box-sizing: border-box;
  border-radius: 20px;
  box-shadow: 0 4px 24px 0 rgba(0, 0, 0, 0.1);
  padding: clamp(16px, 3vw, 38px) clamp(14px, 2.5vw, 32px) clamp(14px, 2.5vw, 32px) clamp(14px, 2.5vw, 32px);
  background: var(--el-bg-color, #fafcff);
  transition: background 0.3s;
}

.submit-button-area {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

.empty-prompt {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  min-height: 200px;
  margin-top: 20px;
  padding: 40px 20px;
  border: 2px dashed #c0c4cc;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.05) 0%, rgba(64, 158, 255, 0) 100%);
}

.prompt-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.7;
}

.prompt-title {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 8px;
}

.prompt-desc {
  font-size: 14px;
  color: #909399;
  text-align: center;
}

.history-list-area {
  flex: 0 1 54%;
  min-width: 320px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  height: 100%;
  margin-left: 0;
  box-sizing: border-box;
}

.history-card {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  overflow: visible;
  height: 100%;
  border-radius: 20px;
  box-shadow: 0 4px 24px 0 rgba(0, 0, 0, 0.1);
  padding: clamp(16px, 3vw, 38px) clamp(14px, 2.5vw, 32px) clamp(14px, 2.5vw, 32px) clamp(14px, 2.5vw, 32px);
  background: var(--el-bg-color, #fafcff);
}

@media (max-width: 768px) {
  .main-card,
  .history-card {
    flex: 0 1 100% !important;
    min-width: 100% !important;
  }

  .equal-height-flex {
    flex-direction: column;
  }
}

@media (prefers-color-scheme: dark) {
  .main-card,
  .history-card {
    background: var(--el-bg-color-overlay, #232324);
  }
}

:deep(.el-button[type='primary']) {
  border-radius: 6px;
  font-weight: 500;
  height: 2.25rem;
  line-height: 1;
}
</style>
